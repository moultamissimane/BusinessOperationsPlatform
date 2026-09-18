namespace WorkFlow.Api.Domain;

public class Department
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
}

public class Permission
{
    /// <summary>Stable key such as "exp_approve"; also the authorization policy name.</summary>
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
}

public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    /// <summary>Permissions copied onto a new employee when none are given explicitly.</summary>
    public List<Permission> DefaultPermissions { get; set; } = [];
}

public class Employee
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Phone { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public string Title { get; set; } = "";
    public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;
    public DateOnly JoinDate { get; set; }
    public string Location { get; set; } = "";
    public Guid? ManagerId { get; set; }
    public Employee? Manager { get; set; }
    public List<Permission> Permissions { get; set; } = [];
}

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;
    public Guid LeadId { get; set; }
    public Employee Lead { get; set; } = null!;
    public decimal Budget { get; set; }
    public decimal Spent { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly Deadline { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Planning;
    public int Progress { get; set; }
    public List<Employee> Team { get; set; } = [];
}

public class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid AssignedToId { get; set; }
    public Employee AssignedTo { get; set; } = null!;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public TaskItemStatus Status { get; set; } = TaskItemStatus.Backlog;
    public DateOnly Deadline { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LeaveRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public LeaveType LeaveType { get; set; }
    public ExceptionalLeaveSubtype? ExceptionalSubtype { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int DaysCount { get; set; }
    public string Reason { get; set; } = "";
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public DateTime SubmittedAt { get; set; }
    public Guid? ReviewedById { get; set; }
    public Employee? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewComment { get; set; }
    /// <summary>Maps to PostgreSQL xmin; guards against two managers reviewing at once.</summary>
    public uint Version { get; set; }
}

public class Expense
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public ExpenseCategory Category { get; set; }
    public DateOnly Date { get; set; }
    public string? ReceiptUrl { get; set; }
    public string? ReceiptFileName { get; set; }
    /// <summary>Key inside <see cref="Services.IReceiptStorage"/>; null for receipts hosted elsewhere.</summary>
    public string? ReceiptStorageKey { get; set; }
    public ExpenseStatus Status { get; set; } = ExpenseStatus.Pending;
    public DateTime SubmittedAt { get; set; }
    public Guid? ReviewedById { get; set; }
    public Employee? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ManagerNotes { get; set; }
    public uint Version { get; set; }
}

/// <summary>Opaque, single-use refresh token. Only a SHA-256 hash is stored, so a database leak can't be replayed.</summary>
public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Guid? ReplacedById { get; set; }
    public string CreatedByIp { get; set; } = "";
}

public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

/// <summary>Append-only. There is deliberately no update or delete path for these rows.</summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = "";
    public string UserRole { get; set; } = "";
    public AuditAction Action { get; set; }
    public string Entity { get; set; } = "";
    public AuditEntityType EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string OldValue { get; set; } = "";
    public string NewValue { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public string IpAddress { get; set; } = "";
    public string? Notes { get; set; }
}
