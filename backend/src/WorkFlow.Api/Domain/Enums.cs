using System.Runtime.Serialization;

namespace WorkFlow.Api.Domain;

// EnumMember values are the exact strings the React frontend uses (see src/types.ts).

public enum EmployeeStatus
{
    Active,
    [EnumMember(Value = "On Leave")] OnLeave,
    Terminated,
}

public enum ProjectStatus
{
    Planning,
    [EnumMember(Value = "In Progress")] InProgress,
    [EnumMember(Value = "In Review")] InReview,
    Completed,
    [EnumMember(Value = "On Hold")] OnHold,
}

public enum TaskPriority { Low, Medium, High, Critical }

public enum TaskItemStatus
{
    Backlog,
    [EnumMember(Value = "In Progress")] InProgress,
    [EnumMember(Value = "In Review")] InReview,
    Completed,
}

public enum LeaveType
{
    [EnumMember(Value = "Annual leave")] Annual,
    [EnumMember(Value = "Sick leave")] Sick,
    [EnumMember(Value = "Exceptional leave")] Exceptional,
}

public enum ExceptionalLeaveSubtype
{
    Marriage,
    [EnumMember(Value = "Paternity/Maternity")] PaternityMaternity,
    Bereavement,
    Relocation,
    Other,
}

public enum LeaveStatus { Pending, Approved, Rejected }

public enum Currency { MAD, USD, EUR }

public enum ExpenseCategory
{
    [EnumMember(Value = "Travel & Lodging")] TravelLodging,
    [EnumMember(Value = "Software & Subscriptions")] SoftwareSubscriptions,
    [EnumMember(Value = "Office Supplies")] OfficeSupplies,
    [EnumMember(Value = "Client Dining")] ClientDining,
    [EnumMember(Value = "Hardware & Equipment")] HardwareEquipment,
    [EnumMember(Value = "Training & Conferences")] TrainingConferences,
}

public enum ExpenseStatus
{
    Pending,
    Approved,
    Rejected,
    [EnumMember(Value = "Changes Requested")] ChangesRequested,
}

public enum ExpenseDecision
{
    Approved,
    Rejected,
    [EnumMember(Value = "Changes Requested")] ChangesRequested,
}

public enum LeaveDecision { Approved, Rejected }

public enum AuditAction
{
    Created,
    [EnumMember(Value = "Status Changed")] StatusChanged,
    Updated,
    Deleted,
    Approved,
    Rejected,
    [EnumMember(Value = "Requested Changes")] RequestedChanges,
}

public enum AuditEntityType { Expense, Leave, Task, Project, Employee }
