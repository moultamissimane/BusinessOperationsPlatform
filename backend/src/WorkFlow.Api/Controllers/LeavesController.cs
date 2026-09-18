using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/leaves")]
public class LeavesController(AppDbContext db, IAuditService audit, ICodeGenerator codes, ICurrentUser current,
    TimeProvider clock, IConfiguration config) : ApiController
{
    /// <summary>Moroccan Code du travail: 1.5 working days per month, i.e. 18 a year. Configurable via Leave:AnnualDaysPerYear.</summary>
    private int AnnualEntitlement => config.GetValue("Leave:AnnualDaysPerYear", 18);

    /// <summary>Annual leave balance for a calendar year. Own balance by default; approvers can look up anyone's.</summary>
    [HttpGet("balance")]
    public async Task<ActionResult<LeaveBalanceDto>> Balance([FromQuery] Guid? employeeId, [FromQuery] int? year, CancellationToken ct)
    {
        var target = employeeId ?? current.Id;
        if (target != current.Id && !current.Has(Perm.LeaveApprove)) return ForbidDetail("You can only view your own leave balance.");
        if (!await db.Employees.AnyAsync(e => e.Id == target, ct)) return NotFound();

        return await BalanceFor(target, year ?? clock.GetUtcNow().Year, ct);
    }

    private async Task<LeaveBalanceDto> BalanceFor(Guid employeeId, int year, CancellationToken ct)
    {
        var start = new DateOnly(year, 1, 1);
        var end = new DateOnly(year, 12, 31);
        // A request counts towards the year it starts in.
        var rows = await db.LeaveRequests.AsNoTracking()
            .Where(l => l.EmployeeId == employeeId && l.LeaveType == LeaveType.Annual &&
                        l.StartDate >= start && l.StartDate <= end &&
                        (l.Status == LeaveStatus.Approved || l.Status == LeaveStatus.Pending))
            .GroupBy(l => l.Status).Select(g => new { Status = g.Key, Days = g.Sum(l => l.DaysCount) }).ToListAsync(ct);

        var used = rows.FirstOrDefault(r => r.Status == LeaveStatus.Approved)?.Days ?? 0;
        var pending = rows.FirstOrDefault(r => r.Status == LeaveStatus.Pending)?.Days ?? 0;
        return new LeaveBalanceDto(employeeId, year, AnnualEntitlement, used, pending, Math.Max(0, AnnualEntitlement - used - pending));
    }

    private IQueryable<LeaveRequest> WithRelations => db.LeaveRequests.Include(l => l.Employee).Include(l => l.ReviewedBy);

    /// <summary>Approvers see everyone's requests; everyone else sees only their own.</summary>
    private IQueryable<LeaveRequest> Visible(IQueryable<LeaveRequest> query) =>
        current.Has(Perm.LeaveApprove) ? query : query.Where(l => l.EmployeeId == current.Id);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LeaveDto>>> List(
        [FromQuery] string? status, [FromQuery] Guid? employeeId, CancellationToken ct)
    {
        var query = Visible(WithRelations.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumText.TryParse<LeaveStatus>(status, out var parsed)) return BadRequestDetail($"Unknown status '{status}'.");
            query = query.Where(l => l.Status == parsed);
        }
        if (employeeId is { } id) query = query.Where(l => l.EmployeeId == id);

        var leaves = await query.OrderByDescending(l => l.SubmittedAt).ToListAsync(ct);
        return leaves.Select(l => l.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LeaveDto>> Get(Guid id, CancellationToken ct)
    {
        var leave = await Visible(WithRelations.AsNoTracking()).SingleOrDefaultAsync(l => l.Id == id, ct);
        return leave is null ? NotFound() : leave.ToDto();
    }

    [HttpPost]
    [Authorize(Policy = Perm.LeaveRequest)]
    public async Task<ActionResult<LeaveDto>> Create(CreateLeaveRequest request, CancellationToken ct)
    {
        if (request.EndDate < request.StartDate) return BadRequestDetail("End date cannot be before the start date.");

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        // Sick and exceptional leave are often filed after the fact; annual leave must be planned ahead.
        if (request.LeaveType == LeaveType.Annual && request.StartDate < today)
            return BadRequestDetail("Annual leave cannot start in the past.");
        if (request.LeaveType == LeaveType.Exceptional && request.ExceptionalSubtype is null)
            return BadRequestDetail("Exceptional leave requires an exceptional subtype.");

        var days = CountDays(request.LeaveType, request.StartDate, request.EndDate);
        if (days == 0) return BadRequestDetail("The selected period contains no leave days.");

        if (request.LeaveType == LeaveType.Annual)
        {
            var balance = await BalanceFor(current.Id, request.StartDate.Year, ct);
            if (days > balance.Remaining)
                return BadRequestDetail($"Not enough annual leave: {days} day(s) requested but only {balance.Remaining} of {balance.Entitlement} remain for {balance.Year}.");
        }

        var overlaps = await db.LeaveRequests.AnyAsync(l =>
            l.EmployeeId == current.Id &&
            (l.Status == LeaveStatus.Pending || l.Status == LeaveStatus.Approved) &&
            l.StartDate <= request.EndDate && l.EndDate >= request.StartDate, ct);
        if (overlaps) return ConflictDetail("You already have a pending or approved leave overlapping these dates.");

        var leave = new LeaveRequest
        {
            Code = await codes.NextAsync(CodeKind.Leave, ct),
            EmployeeId = current.Id,
            LeaveType = request.LeaveType,
            ExceptionalSubtype = request.LeaveType == LeaveType.Exceptional ? request.ExceptionalSubtype : null,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            DaysCount = days,
            Reason = request.Reason.Trim(),
            Status = LeaveStatus.Pending,
            SubmittedAt = clock.GetUtcNow().UtcDateTime,
        };
        db.LeaveRequests.Add(leave);

        audit.Record(AuditAction.Created, AuditEntityType.Leave, leave.Id, AuditService.Label("Leave", leave.Code),
            "N/A", $"{leave.LeaveType.ToText()} ({days} days: {leave.StartDate:yyyy-MM-dd} to {leave.EndDate:yyyy-MM-dd})",
            $"Submitted by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;

        var created = await WithRelations.AsNoTracking().SingleAsync(l => l.Id == leave.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = leave.Id }, created.ToDto());
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = Perm.LeaveApprove)]
    public async Task<ActionResult<LeaveDto>> Review(Guid id, ReviewLeaveRequest request, CancellationToken ct)
    {
        var leave = await WithRelations.SingleOrDefaultAsync(l => l.Id == id, ct);
        if (leave is null) return NotFound();

        if (leave.EmployeeId == current.Id) return ForbidDetail("You cannot review your own leave request.");
        if (leave.Status != LeaveStatus.Pending) return ConflictDetail($"This request is already {leave.Status.ToText().ToLowerInvariant()}.");
        if (request.Decision == LeaveDecision.Rejected && string.IsNullOrWhiteSpace(request.Comment))
            return BadRequestDetail("A comment is required when rejecting a leave request.");

        var oldStatus = leave.Status;
        leave.Status = request.Decision == LeaveDecision.Approved ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.ReviewedById = current.Id;
        leave.ReviewedAt = clock.GetUtcNow().UtcDateTime;
        leave.ReviewComment = request.Comment?.Trim();

        audit.Record(
            request.Decision == LeaveDecision.Approved ? AuditAction.Approved : AuditAction.Rejected,
            AuditEntityType.Leave, leave.Id, AuditService.Label("Leave", leave.Code),
            $"Status: {oldStatus.ToText()}", $"Status: {leave.Status.ToText()}",
            string.IsNullOrEmpty(leave.ReviewComment) ? $"Action by {current.Name}" : $"Review comment: \"{leave.ReviewComment}\"");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;

        // Reload so ReviewedBy is populated for the response.
        await db.Entry(leave).Reference(l => l.ReviewedBy).LoadAsync(ct);
        return leave.ToDto();
    }

    /// <summary>Annual leave counts working days (Mon–Fri); sick and exceptional leave count calendar days.</summary>
    internal static int CountDays(LeaveType type, DateOnly start, DateOnly end)
    {
        var calendar = end.DayNumber - start.DayNumber + 1;
        if (type != LeaveType.Annual) return calendar;

        var workdays = 0;
        for (var d = start; d <= end; d = d.AddDays(1))
            if (d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) workdays++;
        return workdays;
    }
}
