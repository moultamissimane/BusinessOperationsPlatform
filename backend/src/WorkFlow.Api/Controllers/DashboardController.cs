using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/dashboard")]
public class DashboardController(AppDbContext db, ICurrentUser current, TimeProvider clock) : ApiController
{
    private const int DeadlineWindowDays = 14;

    /// <summary>
    /// Managers (anyone who can approve leave or expenses) get the organisation-wide picture.
    /// Everyone else gets the same shape scoped to their own requests and tasks.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get(CancellationToken ct)
    {
        var isManager = current.Has(Perm.LeaveApprove) || current.Has(Perm.ExpenseApprove);
        var now = clock.GetUtcNow().UtcDateTime;
        var today = DateOnly.FromDateTime(now);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var leaves = db.LeaveRequests.AsNoTracking().AsQueryable();
        var expenses = db.Expenses.AsNoTracking().AsQueryable();
        var tasks = db.Tasks.AsNoTracking().AsQueryable();
        if (!isManager)
        {
            leaves = leaves.Where(l => l.EmployeeId == current.Id);
            expenses = expenses.Where(e => e.EmployeeId == current.Id);
            tasks = tasks.Where(t => t.AssignedToId == current.Id);
        }

        // Queries run one after another: a DbContext does not allow concurrent operations.
        var employeeCounts = await db.Employees.AsNoTracking().GroupBy(e => e.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(ct);

        var pendingLeaves = await leaves.CountAsync(l => l.Status == LeaveStatus.Pending, ct);
        var pendingExpenses = await expenses.CountAsync(e => e.Status == ExpenseStatus.Pending, ct);

        var pendingAmount = await expenses.Where(e => e.Status == ExpenseStatus.Pending)
            .GroupBy(e => e.Currency).Select(g => new AmountByCurrency(g.Key, g.Sum(e => e.Amount))).ToListAsync(ct);
        var approvedThisMonth = await expenses.Where(e => e.Status == ExpenseStatus.Approved && e.ReviewedAt >= monthStart)
            .GroupBy(e => e.Currency).Select(g => new AmountByCurrency(g.Key, g.Sum(e => e.Amount))).ToListAsync(ct);
        var expensesByStatus = await expenses.GroupBy(e => e.Status)
            .Select(g => new { Key = g.Key, Count = g.Count() }).ToListAsync(ct);
        var expensesByCategory = await expenses.Where(e => e.Status != ExpenseStatus.Rejected)
            .GroupBy(e => new { e.Category, e.Currency })
            .Select(g => new AmountByCategory(g.Key.Category, g.Key.Currency, g.Sum(e => e.Amount))).ToListAsync(ct);

        var projectsByStatus = await db.Projects.AsNoTracking().GroupBy(p => p.Status)
            .Select(g => new { Key = g.Key, Count = g.Count() }).ToListAsync(ct);
        var tasksByStatus = await tasks.GroupBy(t => t.Status)
            .Select(g => new { Key = g.Key, Count = g.Count() }).ToListAsync(ct);
        var overdueTasks = await tasks.CountAsync(t => t.Status != TaskItemStatus.Completed && t.Deadline < today, ct);

        var horizon = today.AddDays(DeadlineWindowDays);
        var taskDeadlines = await tasks
            .Where(t => t.Status != TaskItemStatus.Completed && t.Deadline <= horizon)
            .Select(t => new { t.Id, t.Code, t.Title, t.Deadline, t.Status }).ToListAsync(ct);
        var projectDeadlines = await db.Projects.AsNoTracking()
            .Where(p => p.Status != ProjectStatus.Completed && p.Deadline <= horizon)
            .Select(p => new { p.Id, p.Code, p.Name, p.Deadline, p.Status }).ToListAsync(ct);

        // Overdue items stay in the list (negative DaysLeft) until they are completed.
        var deadlines = taskDeadlines
            .Select(t => new DeadlineItem("Task", t.Id, t.Code, t.Title, t.Deadline, t.Deadline.DayNumber - today.DayNumber, t.Status.ToText()))
            .Concat(projectDeadlines.Select(p => new DeadlineItem("Project", p.Id, p.Code, p.Name, p.Deadline, p.Deadline.DayNumber - today.DayNumber, p.Status.ToText())))
            .OrderBy(d => d.Deadline).Take(10).ToList();

        int Count(EmployeeStatus s) => employeeCounts.FirstOrDefault(c => c.Status == s)?.Count ?? 0;

        return new DashboardDto(
            Scope: isManager ? "organization" : "personal",
            Employees: new EmployeeStats(employeeCounts.Sum(c => c.Count), Count(EmployeeStatus.Active), Count(EmployeeStatus.OnLeave), Count(EmployeeStatus.Terminated)),
            PendingRequests: new PendingStats(pendingLeaves, pendingExpenses, pendingLeaves + pendingExpenses),
            Expenses: new ExpenseStats(pendingAmount, approvedThisMonth,
                expensesByStatus.Select(c => Mapping.Label(c.Key, c.Count)).ToList(), expensesByCategory),
            Projects: new ProjectStats(projectsByStatus.Sum(c => c.Count), projectsByStatus.Select(c => Mapping.Label(c.Key, c.Count)).ToList()),
            Tasks: new TaskStats(tasksByStatus.Sum(c => c.Count), overdueTasks, tasksByStatus.Select(c => Mapping.Label(c.Key, c.Count)).ToList()),
            Deadlines: deadlines);
    }
}
