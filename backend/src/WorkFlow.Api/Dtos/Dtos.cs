using System.ComponentModel.DataAnnotations;
using WorkFlow.Api.Common;
using WorkFlow.Api.Domain;

namespace WorkFlow.Api.Dtos;

// Response shapes mirror the frontend's src/types.ts so the React app can swap its mock context for API calls.

// ---- Auth ----
public record LoginRequest([Required] string Email, [Required] string Password);
public record CurrentUserDto(Guid Id, string Name, string Email, string Role, string Department, bool IsManager, string Avatar, string Ip, IReadOnlyList<string> Permissions);
public record LoginResponse(string Token, DateTime ExpiresAt, string RefreshToken, CurrentUserDto User);
public record RefreshRequest([Required] string RefreshToken);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(128)] string NewPassword);
public record ForgotPasswordRequest([Required, EmailAddress] string Email);
public record ResetPasswordRequest([Required, EmailAddress] string Email, [Required] string Token, [Required, StringLength(128)] string NewPassword);
public record LeaveBalanceDto(Guid EmployeeId, int Year, int Entitlement, int Used, int Pending, int Remaining);

// ---- Lookups ----
public record DepartmentDto(Guid Id, string Name);
public record RoleDto(Guid Id, string Name, IReadOnlyList<string> DefaultPermissions);
public record PermissionDto(string Id, string Name, string Category, string Description);
public record CreateDepartmentRequest([Required, StringLength(100)] string Name);
public record CreateRoleRequest([Required, StringLength(100)] string Name, IReadOnlyList<string>? DefaultPermissions);

// ---- Employees ----
public record EmployeeDto(Guid Id, string Code, string Name, string Email, string Phone, string Avatar,
    string Department, string Role, string Title, EmployeeStatus Status, DateOnly JoinDate, string Location,
    Guid? ManagerId, IReadOnlyList<string> Permissions);

public record CreateEmployeeRequest(
    [Required, StringLength(120)] string Name,
    [Required, EmailAddress, StringLength(254)] string Email,
    [StringLength(40)] string? Phone,
    [StringLength(500)] string? Avatar,
    [Required] string Department,
    [Required] string Role,
    [Required, StringLength(150)] string Title,
    DateOnly JoinDate,
    [StringLength(150)] string? Location,
    Guid? ManagerId,
    IReadOnlyList<string>? Permissions,
    [Required, StringLength(128, MinimumLength = 8)] string InitialPassword);

/// <summary>Every field is optional; only the ones sent are changed.</summary>
public record UpdateEmployeeRequest(
    [StringLength(120)] string? Name,
    [StringLength(40)] string? Phone,
    [StringLength(500)] string? Avatar,
    string? Department,
    string? Role,
    [StringLength(150)] string? Title,
    EmployeeStatus? Status,
    [StringLength(150)] string? Location,
    Guid? ManagerId,
    IReadOnlyList<string>? Permissions);

// ---- Projects & tasks ----
public record ProjectDto(Guid Id, string Code, string Name, string Description, string Department, Guid LeadId,
    decimal Budget, decimal Spent, DateOnly StartDate, DateOnly Deadline, ProjectStatus Status,
    IReadOnlyList<Guid> TeamIds, int Progress);

public record CreateProjectRequest(
    [Required, StringLength(200)] string Name,
    [StringLength(2000)] string? Description,
    [Required] string Department,
    Guid LeadId,
    [Range(0, 1_000_000_000)] decimal Budget,
    DateOnly StartDate,
    DateOnly Deadline,
    ProjectStatus? Status,
    IReadOnlyList<Guid>? TeamIds);

public record UpdateProjectRequest(
    [StringLength(200)] string? Name,
    [StringLength(2000)] string? Description,
    Guid? LeadId,
    [Range(0, 1_000_000_000)] decimal? Budget,
    [Range(0, 1_000_000_000)] decimal? Spent,
    DateOnly? Deadline,
    ProjectStatus? Status,
    [Range(0, 100)] int? Progress,
    IReadOnlyList<Guid>? TeamIds);

public record TaskDto(Guid Id, string Code, Guid ProjectId, string Title, string Description, Guid AssignedToId,
    TaskPriority Priority, TaskItemStatus Status, DateOnly Deadline, DateTime CreatedAt);

public record CreateTaskRequest(
    Guid ProjectId,
    [Required, StringLength(250)] string Title,
    [StringLength(2000)] string? Description,
    Guid AssignedToId,
    TaskPriority Priority,
    DateOnly Deadline);

public record UpdateTaskRequest(
    [StringLength(250)] string? Title,
    [StringLength(2000)] string? Description,
    Guid? AssignedToId,
    TaskPriority? Priority,
    DateOnly? Deadline);

public record UpdateTaskStatusRequest(TaskItemStatus Status);

// ---- Leave ----
public record LeaveDto(Guid Id, string Code, Guid EmployeeId, string EmployeeName, LeaveType LeaveType,
    DateOnly StartDate, DateOnly EndDate, int DaysCount, string Reason, LeaveStatus Status, DateTime SubmittedAt,
    string? ReviewedBy, DateTime? ReviewedAt, string? ReviewComment, ExceptionalLeaveSubtype? ExceptionalSubtype);

public record CreateLeaveRequest(
    LeaveType LeaveType,
    DateOnly StartDate,
    DateOnly EndDate,
    [Required, StringLength(1000)] string Reason,
    ExceptionalLeaveSubtype? ExceptionalSubtype);

public record ReviewLeaveRequest(LeaveDecision Decision, [StringLength(1000)] string? Comment);

// ---- Expenses ----
public record ExpenseDto(Guid Id, string Code, Guid EmployeeId, string EmployeeName, string Title, decimal Amount,
    Currency Currency, ExpenseCategory Category, DateOnly Date, string? ReceiptUrl, string? ReceiptFileName,
    ExpenseStatus Status, DateTime SubmittedAt, string? ReviewedBy, DateTime? ReviewedAt, string? ManagerNotes);

public record CreateExpenseRequest(
    [Required, StringLength(250)] string Title,
    [Range(0.01, 100_000_000)] decimal Amount,
    Currency Currency,
    ExpenseCategory Category,
    DateOnly Date);

public record UpdateExpenseRequest(
    [StringLength(250)] string? Title,
    [Range(0.01, 100_000_000)] decimal? Amount,
    Currency? Currency,
    ExpenseCategory? Category,
    DateOnly? Date);

public record ReviewExpenseRequest(ExpenseDecision Decision, [StringLength(1000)] string? Notes);

// ---- Audit ----
public record AuditLogDto(Guid Id, Guid? UserId, string UserName, string UserRole, AuditAction Action, string Entity,
    AuditEntityType EntityType, string OldValue, string NewValue, DateTime Timestamp, string IpAddress, string? Notes);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// ---- Dashboard ----
public record CountByLabel(string Label, int Count);
public record AmountByCurrency(Currency Currency, decimal Amount);
public record AmountByCategory(ExpenseCategory Category, Currency Currency, decimal Amount);
public record DeadlineItem(string Type, Guid Id, string Code, string Title, DateOnly Deadline, int DaysLeft, string Status);

public record DashboardDto(
    string Scope,
    EmployeeStats Employees,
    PendingStats PendingRequests,
    ExpenseStats Expenses,
    ProjectStats Projects,
    TaskStats Tasks,
    IReadOnlyList<DeadlineItem> Deadlines);

public record EmployeeStats(int Total, int Active, int OnLeave, int Terminated);
public record PendingStats(int Leaves, int Expenses, int Total);
public record ExpenseStats(IReadOnlyList<AmountByCurrency> PendingAmount, IReadOnlyList<AmountByCurrency> ApprovedThisMonth,
    IReadOnlyList<CountByLabel> ByStatus, IReadOnlyList<AmountByCategory> ByCategory);
public record ProjectStats(int Total, IReadOnlyList<CountByLabel> ByStatus);
public record TaskStats(int Total, int Overdue, IReadOnlyList<CountByLabel> ByStatus);

// ---- Mapping ----
public static class Mapping
{
    public static EmployeeDto ToDto(this Employee e) => new(
        e.Id, e.Code, e.Name, e.Email, e.Phone, e.AvatarUrl, e.Department.Name, e.Role.Name, e.Title, e.Status,
        e.JoinDate, e.Location, e.ManagerId, e.Permissions.Select(p => p.Id).Order().ToList());

    public static ProjectDto ToDto(this Project p) => new(
        p.Id, p.Code, p.Name, p.Description, p.Department.Name, p.LeadId, p.Budget, p.Spent, p.StartDate, p.Deadline,
        p.Status, p.Team.Select(t => t.Id).ToList(), p.Progress);

    public static TaskDto ToDto(this TaskItem t) => new(
        t.Id, t.Code, t.ProjectId, t.Title, t.Description, t.AssignedToId, t.Priority, t.Status, t.Deadline, t.CreatedAt);

    public static LeaveDto ToDto(this LeaveRequest l) => new(
        l.Id, l.Code, l.EmployeeId, l.Employee.Name, l.LeaveType, l.StartDate, l.EndDate, l.DaysCount, l.Reason,
        l.Status, l.SubmittedAt, l.ReviewedBy?.Name, l.ReviewedAt, l.ReviewComment, l.ExceptionalSubtype);

    public static ExpenseDto ToDto(this Expense e) => new(
        e.Id, e.Code, e.EmployeeId, e.Employee.Name, e.Title, e.Amount, e.Currency, e.Category, e.Date, e.ReceiptUrl,
        e.ReceiptFileName, e.Status, e.SubmittedAt, e.ReviewedBy?.Name, e.ReviewedAt, e.ManagerNotes);

    public static AuditLogDto ToDto(this AuditLog a) => new(
        a.Id, a.UserId, a.UserName, a.UserRole, a.Action, a.Entity, a.EntityType, a.OldValue, a.NewValue, a.Timestamp,
        a.IpAddress, a.Notes);

    /// <summary>Employee must be loaded with Department, Role and Permissions.</summary>
    public static CurrentUserDto ToCurrentUser(this Employee e, string ip)
    {
        var permissions = e.Permissions.Select(p => p.Id).Order().ToList();
        return new CurrentUserDto(e.Id, e.Name, e.Email, e.Role.Name, e.Department.Name,
            IsManager: permissions.Contains(Perm.LeaveApprove) || permissions.Contains(Perm.ExpenseApprove),
            e.AvatarUrl, ip, permissions);
    }

    public static CountByLabel Label<T>(T value, int count) where T : struct, Enum => new(value.ToText(), count);
}
