using System.Net;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using static WorkFlow.Api.Tests.ApiFixture;

namespace WorkFlow.Api.Tests;

[Collection("api")]
public class ExpenseTests(ApiFixture api)
{
    [Fact]
    public async Task Seed_data_contains_the_expense_192_audit_trail_from_the_spec()
    {
        var imane = await api.As(Imane);
        var audit = await (await imane.GetAsync("/api/audit-logs?search=Expense%20%23192&entityType=Expense")).ReadAs<PagedResult<AuditLogDto>>();

        var approval = Assert.Single(audit.Items, a => a.Action == AuditAction.StatusChanged);
        Assert.Equal("Imane Benkirane", approval.UserName);
        Assert.Equal("Status: Pending", approval.OldValue);
        Assert.Equal("Status: Approved", approval.NewValue);
        Assert.Equal(new DateTime(2026, 9, 15, 14, 32, 0, DateTimeKind.Utc), approval.Timestamp);
    }

    [Fact]
    public async Task Full_approval_flow_with_receipt_and_audit_trail()
    {
        var yassine = await api.As(Yassine);
        var imane = await api.As(Imane);

        var expense = await TestData.CreateExpense(yassine, 199.99m);
        Assert.Equal(ExpenseStatus.Pending, expense.Status);
        Assert.Equal(199.99m, expense.Amount);
        Assert.Null(expense.ReceiptUrl);

        // No receipt, no approval.
        var early = await imane.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Approved, null));
        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);

        var upload = await TestData.UploadReceipt(yassine, expense.Id, TestData.Png, "facture.png");
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var withReceipt = await upload.ReadAs<ExpenseDto>();
        Assert.Equal("facture.png", withReceipt.ReceiptFileName);
        Assert.Equal($"/api/expenses/{expense.Id}/receipt", withReceipt.ReceiptUrl);

        var approve = await imane.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Approved, "Looks good"));
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
        var approved = await approve.ReadAs<ExpenseDto>();
        Assert.Equal(ExpenseStatus.Approved, approved.Status);
        Assert.Equal("Imane Benkirane", approved.ReviewedBy);

        var audit = await TestData.AuditFor(imane, expense.Id);
        var entry = Assert.Single(audit.Items, a => a.Action == AuditAction.Approved);
        Assert.Equal("Status: Pending", entry.OldValue);
        Assert.Equal("Status: Approved", entry.NewValue);
        Assert.Equal($"Expense #{expense.Code[4..]}", entry.Entity);
        Assert.Contains(audit.Items, a => a.Action == AuditAction.Created && a.UserName == "Yassine Mansouri");

        // Approved is final.
        var again = await imane.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Rejected, "Oops"));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task Owner_can_download_the_receipt_but_unrelated_staff_cannot()
    {
        var yassine = await api.As(Yassine);
        var expense = await TestData.CreateExpenseWithReceipt(yassine);

        var download = await yassine.GetAsync(expense.ReceiptUrl!);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(TestData.Png, await download.Content.ReadAsByteArrayAsync());

        Assert.Equal(HttpStatusCode.OK, (await (await api.As(Karim)).GetAsync(expense.ReceiptUrl!)).StatusCode); // approver
        Assert.Equal(HttpStatusCode.NotFound, (await (await api.As(Mehdi)).GetAsync(expense.ReceiptUrl!)).StatusCode);
    }

    [Fact]
    public async Task Receipts_must_be_real_pdf_or_image_files()
    {
        var yassine = await api.As(Yassine);
        var expense = await TestData.CreateExpense(yassine);

        var fakePng = "MZ this is actually an executable"u8.ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await TestData.UploadReceipt(yassine, expense.Id, fakePng, "receipt.png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await TestData.UploadReceipt(yassine, expense.Id, TestData.Png, "receipt.exe")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await TestData.UploadReceipt(yassine, expense.Id, [], "empty.png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await TestData.UploadReceipt(yassine, expense.Id, new byte[5 * 1024 * 1024 + 1], "big.pdf")).StatusCode);

        var pdf = "%PDF-1.4 minimal"u8.ToArray();
        Assert.Equal(HttpStatusCode.OK, (await TestData.UploadReceipt(yassine, expense.Id, pdf, "../../evil/../receipt.pdf")).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_can_attach_a_receipt()
    {
        var expense = await TestData.CreateExpense(await api.As(Yassine));
        var response = await TestData.UploadReceipt(await api.As(Mehdi), expense.Id, TestData.Png, "receipt.png");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Managers_cannot_approve_their_own_expense()
    {
        var karim = await api.As(Karim);
        var expense = await TestData.CreateExpenseWithReceipt(karim);
        var response = await karim.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Approved, null));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Staff_cannot_approve_expenses()
    {
        var expense = await TestData.CreateExpenseWithReceipt(await api.As(Yassine));
        var response = await (await api.As(Mehdi)).PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Approved, null));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Request_changes_then_employee_fixes_and_resubmits()
    {
        var yassine = await api.As(Yassine);
        var imane = await api.As(Imane);
        var expense = await TestData.CreateExpenseWithReceipt(yassine, 100m);

        // A note is mandatory for anything other than approval.
        var noNote = await imane.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.ChangesRequested, null));
        Assert.Equal(HttpStatusCode.BadRequest, noNote.StatusCode);

        var request = await imane.PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.ChangesRequested, "Amount does not match the receipt"));
        var requested = await request.ReadAs<ExpenseDto>();
        Assert.Equal(ExpenseStatus.ChangesRequested, requested.Status);
        Assert.Equal("Amount does not match the receipt", requested.ManagerNotes);

        var fix = await yassine.PutJson($"/api/expenses/{expense.Id}", new UpdateExpenseRequest(null, 95.5m, null, null, null));
        Assert.Equal(HttpStatusCode.OK, fix.StatusCode);
        var fixedExpense = await fix.ReadAs<ExpenseDto>();
        Assert.Equal(ExpenseStatus.Pending, fixedExpense.Status);
        Assert.Equal(95.5m, fixedExpense.Amount);

        var audit = await TestData.AuditFor(imane, expense.Id);
        Assert.Contains(audit.Items, a => a.Action == AuditAction.RequestedChanges && a.NewValue == "Status: Changes Requested");
        var resubmit = Assert.Single(audit.Items, a => a.Action == AuditAction.StatusChanged);
        Assert.Contains("Amount: 100", resubmit.OldValue);
        Assert.Contains("Amount: 95.5", resubmit.NewValue);
        Assert.Contains("Status: Pending", resubmit.NewValue);
    }

    [Fact]
    public async Task Rejected_and_approved_expenses_cannot_be_edited()
    {
        var yassine = await api.As(Yassine);
        var expense = await TestData.CreateExpenseWithReceipt(yassine);
        await (await api.As(Imane)).PostJson($"/api/expenses/{expense.Id}/review", new ReviewExpenseRequest(ExpenseDecision.Rejected, "Not reimbursable"));

        var edit = await yassine.PutJson($"/api/expenses/{expense.Id}", new UpdateExpenseRequest(null, 1m, null, null, null));
        Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);
    }

    [Fact]
    public async Task Staff_only_see_their_own_expenses_and_can_filter_by_status_text()
    {
        var yassineExpense = await TestData.CreateExpense(await api.As(Yassine));

        var mehdiView = await (await (await api.As(Mehdi)).GetAsync("/api/expenses")).ReadAs<List<ExpenseDto>>();
        Assert.NotEmpty(mehdiView);
        Assert.All(mehdiView, e => Assert.Equal("Mehdi Chraibi", e.EmployeeName));

        var managerView = await (await (await api.As(Imane)).GetAsync("/api/expenses?status=Changes%20Requested")).ReadAs<List<ExpenseDto>>();
        Assert.NotEmpty(managerView);
        Assert.All(managerView, e => Assert.Equal(ExpenseStatus.ChangesRequested, e.Status));

        var all = await (await (await api.As(Imane)).GetAsync("/api/expenses")).ReadAs<List<ExpenseDto>>();
        Assert.Contains(all, e => e.Id == yassineExpense.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await (await api.As(Imane)).GetAsync("/api/expenses?status=Bogus")).StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task Non_positive_amounts_are_rejected(double amount)
    {
        var response = await (await api.As(Yassine)).PostJson("/api/expenses",
            new CreateExpenseRequest("Bad", (decimal)amount, Currency.MAD, ExpenseCategory.OfficeSupplies, DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Future_dated_expenses_are_rejected()
    {
        var response = await (await api.As(Yassine)).PostJson("/api/expenses",
            new CreateExpenseRequest("Time traveller", 10m, Currency.EUR, ExpenseCategory.TravelLodging, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3))));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Codes_are_unique_and_increasing_under_concurrent_submissions()
    {
        var yassine = await api.As(Yassine);
        var created = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => TestData.CreateExpense(yassine)));

        Assert.Equal(8, created.Select(e => e.Code).Distinct().Count());
        Assert.All(created, e => Assert.Matches(@"^EXP-\d{3,}$", e.Code));
    }
}
