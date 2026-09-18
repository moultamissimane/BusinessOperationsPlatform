using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/expenses")]
public class ExpensesController(
    AppDbContext db, IAuditService audit, ICodeGenerator codes, ICurrentUser current,
    IReceiptStorage receipts, TimeProvider clock) : ApiController
{
    private const long MaxReceiptBytes = 5 * 1024 * 1024;

    // Extension -> (content type, magic-byte check). The bytes are checked so a renamed .exe can't pass as a receipt.
    private static readonly Dictionary<string, (string ContentType, Func<byte[], bool> Matches)> AllowedReceipts = new()
    {
        [".pdf"] = ("application/pdf", b => b.AsSpan().StartsWith("%PDF-"u8)),
        [".png"] = ("image/png", b => b.AsSpan().StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })),
        [".jpg"] = ("image/jpeg", b => b.AsSpan().StartsWith(new byte[] { 0xFF, 0xD8, 0xFF })),
        [".jpeg"] = ("image/jpeg", b => b.AsSpan().StartsWith(new byte[] { 0xFF, 0xD8, 0xFF })),
    };

    private IQueryable<Expense> WithRelations => db.Expenses.Include(e => e.Employee).Include(e => e.ReviewedBy);

    private IQueryable<Expense> Visible(IQueryable<Expense> query) =>
        current.Has(Perm.ExpenseApprove) ? query : query.Where(e => e.EmployeeId == current.Id);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExpenseDto>>> List(
        [FromQuery] string? status, [FromQuery] string? category, [FromQuery] Guid? employeeId, CancellationToken ct)
    {
        var query = Visible(WithRelations.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumText.TryParse<ExpenseStatus>(status, out var parsed)) return BadRequestDetail($"Unknown status '{status}'.");
            query = query.Where(e => e.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            if (!EnumText.TryParse<ExpenseCategory>(category, out var parsed)) return BadRequestDetail($"Unknown category '{category}'.");
            query = query.Where(e => e.Category == parsed);
        }
        if (employeeId is { } id) query = query.Where(e => e.EmployeeId == id);

        var expenses = await query.OrderByDescending(e => e.SubmittedAt).ToListAsync(ct);
        return expenses.Select(e => e.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExpenseDto>> Get(Guid id, CancellationToken ct)
    {
        var expense = await Visible(WithRelations.AsNoTracking()).SingleOrDefaultAsync(e => e.Id == id, ct);
        return expense is null ? NotFound() : expense.ToDto();
    }

    [HttpPost]
    [Authorize(Policy = Perm.ExpenseSubmit)]
    public async Task<ActionResult<ExpenseDto>> Create(CreateExpenseRequest request, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        if (request.Date > DateOnly.FromDateTime(now)) return BadRequestDetail("The expense date cannot be in the future.");

        var expense = new Expense
        {
            Code = await codes.NextAsync(CodeKind.Expense, ct),
            EmployeeId = current.Id,
            Title = request.Title.Trim(),
            Amount = decimal.Round(request.Amount, 2),
            Currency = request.Currency,
            Category = request.Category,
            Date = request.Date,
            Status = ExpenseStatus.Pending,
            SubmittedAt = now,
        };
        db.Expenses.Add(expense);

        audit.Record(AuditAction.Created, AuditEntityType.Expense, expense.Id, AuditService.Label("Expense", expense.Code),
            "N/A", $"{expense.Amount:0.##} {expense.Currency.ToText()} - {expense.Title}", $"Claim submitted by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;

        var created = await WithRelations.AsNoTracking().SingleAsync(e => e.Id == expense.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = expense.Id }, created.ToDto());
    }

    /// <summary>Employees fix their own claim after "Changes Requested" (or while still pending). A fixed claim goes back to Pending.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Perm.ExpenseSubmit)]
    public async Task<ActionResult<ExpenseDto>> Update(Guid id, UpdateExpenseRequest request, CancellationToken ct)
    {
        var expense = await WithRelations.SingleOrDefaultAsync(e => e.Id == id && e.EmployeeId == current.Id, ct);
        if (expense is null) return NotFound();
        if (expense.Status is not (ExpenseStatus.Pending or ExpenseStatus.ChangesRequested))
            return ConflictDetail($"A {expense.Status.ToText().ToLowerInvariant()} expense can no longer be edited.");
        if (request.Date is { } date && date > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime))
            return BadRequestDetail("The expense date cannot be in the future.");

        var oldStatus = expense.Status;
        var changes = new List<(string Field, string Old, string New)>();

        if (request.Title is not null && request.Title.Trim() != expense.Title) { changes.Add(("Title", expense.Title, request.Title.Trim())); expense.Title = request.Title.Trim(); }
        if (request.Amount is { } amount && decimal.Round(amount, 2) != expense.Amount) { changes.Add(("Amount", $"{expense.Amount:0.##}", $"{amount:0.##}")); expense.Amount = decimal.Round(amount, 2); }
        if (request.Currency is { } currency && currency != expense.Currency) { changes.Add(("Currency", expense.Currency.ToText(), currency.ToText())); expense.Currency = currency; }
        if (request.Category is { } category && category != expense.Category) { changes.Add(("Category", expense.Category.ToText(), category.ToText())); expense.Category = category; }
        if (request.Date is { } newDate && newDate != expense.Date) { changes.Add(("Date", $"{expense.Date:yyyy-MM-dd}", $"{newDate:yyyy-MM-dd}")); expense.Date = newDate; }

        if (oldStatus == ExpenseStatus.ChangesRequested)
        {
            expense.Status = ExpenseStatus.Pending;
            changes.Add(("Status", oldStatus.ToText(), ExpenseStatus.Pending.ToText()));
        }

        if (changes.Count > 0)
        {
            audit.Record(oldStatus == ExpenseStatus.ChangesRequested ? AuditAction.StatusChanged : AuditAction.Updated,
                AuditEntityType.Expense, expense.Id, AuditService.Label("Expense", expense.Code),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.Old}")),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.New}")),
                $"Updated by {current.Name}");
        }

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return expense.ToDto();
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = Perm.ExpenseApprove)]
    public async Task<ActionResult<ExpenseDto>> Review(Guid id, ReviewExpenseRequest request, CancellationToken ct)
    {
        var expense = await WithRelations.SingleOrDefaultAsync(e => e.Id == id, ct);
        if (expense is null) return NotFound();

        if (expense.EmployeeId == current.Id) return ForbidDetail("You cannot review your own expense.");
        if (expense.Status != ExpenseStatus.Pending) return ConflictDetail($"This expense is already {expense.Status.ToText().ToLowerInvariant()}.");
        if (request.Decision != ExpenseDecision.Approved && string.IsNullOrWhiteSpace(request.Notes))
            return BadRequestDetail("A note is required when rejecting an expense or requesting changes.");
        if (request.Decision == ExpenseDecision.Approved && expense.ReceiptUrl is null)
            return BadRequestDetail("An expense cannot be approved without a receipt.");

        var oldStatus = expense.Status;
        (expense.Status, var action) = request.Decision switch
        {
            ExpenseDecision.Approved => (ExpenseStatus.Approved, AuditAction.Approved),
            ExpenseDecision.Rejected => (ExpenseStatus.Rejected, AuditAction.Rejected),
            _ => (ExpenseStatus.ChangesRequested, AuditAction.RequestedChanges),
        };
        expense.ReviewedById = current.Id;
        expense.ReviewedAt = clock.GetUtcNow().UtcDateTime;
        expense.ManagerNotes = request.Notes?.Trim();

        audit.Record(action, AuditEntityType.Expense, expense.Id, AuditService.Label("Expense", expense.Code),
            $"Status: {oldStatus.ToText()}", $"Status: {expense.Status.ToText()}",
            string.IsNullOrEmpty(expense.ManagerNotes) ? $"Reviewed by {current.Name}" : $"Manager note: \"{expense.ManagerNotes}\"");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;

        await db.Entry(expense).Reference(e => e.ReviewedBy).LoadAsync(ct);
        return expense.ToDto();
    }

    [HttpPost("{id:guid}/receipt")]
    [Authorize(Policy = Perm.ExpenseSubmit)]
    [RequestSizeLimit(MaxReceiptBytes + 64 * 1024)] // file limit plus multipart overhead
    public async Task<ActionResult<ExpenseDto>> UploadReceipt(Guid id, IFormFile file, CancellationToken ct)
    {
        var expense = await WithRelations.SingleOrDefaultAsync(e => e.Id == id && e.EmployeeId == current.Id, ct);
        if (expense is null) return NotFound();
        if (expense.Status is not (ExpenseStatus.Pending or ExpenseStatus.ChangesRequested))
            return ConflictDetail("A receipt can only be attached while the expense is pending or awaiting changes.");

        if (file.Length is 0 or > MaxReceiptBytes) return BadRequestDetail("Receipt must be between 1 byte and 5 MB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedReceipts.TryGetValue(extension, out var allowed)) return BadRequestDetail("Receipt must be a PDF, PNG or JPEG file.");

        var header = new byte[8];
        await using (var probe = file.OpenReadStream())
        {
            var read = await probe.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
            if (!allowed.Matches(header[..read])) return BadRequestDetail("The file content does not match its extension.");
        }

        string key;
        await using (var stream = file.OpenReadStream())
            key = await receipts.SaveAsync(expense.Id, extension, stream, ct);

        var previousKey = expense.ReceiptStorageKey;
        expense.ReceiptStorageKey = key;
        expense.ReceiptUrl = $"/api/expenses/{expense.Id}/receipt";
        expense.ReceiptFileName = Path.GetFileName(file.FileName);

        audit.Record(AuditAction.Updated, AuditEntityType.Expense, expense.Id, AuditService.Label("Expense", expense.Code),
            previousKey is null ? "Receipt: none" : "Receipt: previous file",
            $"Receipt: {expense.ReceiptFileName}", $"Receipt uploaded by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure)
        {
            await receipts.DeleteAsync(key, CancellationToken.None);
            return failure;
        }

        if (previousKey is not null) await receipts.DeleteAsync(previousKey, ct);
        return expense.ToDto();
    }

    [HttpGet("{id:guid}/receipt")]
    public async Task<IActionResult> DownloadReceipt(Guid id, CancellationToken ct)
    {
        var expense = await Visible(db.Expenses.AsNoTracking()).SingleOrDefaultAsync(e => e.Id == id, ct);
        if (expense?.ReceiptStorageKey is null) return NotFound();

        var stream = await receipts.OpenAsync(expense.ReceiptStorageKey, ct);
        if (stream is null) return NotFound();

        var contentType = AllowedReceipts.GetValueOrDefault(Path.GetExtension(expense.ReceiptStorageKey)).ContentType
                          ?? "application/octet-stream";
        // Served inline from an API origin; nosniff stops the browser second-guessing the type we declared.
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(stream, contentType, expense.ReceiptFileName);
    }
}
