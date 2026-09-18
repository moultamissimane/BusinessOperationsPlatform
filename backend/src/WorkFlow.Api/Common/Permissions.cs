namespace WorkFlow.Api.Common;

/// <summary>Permission keys. Each one is also registered as an authorization policy of the same name.</summary>
public static class Perm
{
    public const string EmployeesRead = "emp_read";
    public const string EmployeesWrite = "emp_write";
    public const string ProjectsRead = "prj_read";
    public const string ProjectsWrite = "prj_write";
    public const string TasksManage = "tsk_manage";
    public const string LeaveRequest = "lev_request";
    public const string LeaveApprove = "lev_approve";
    public const string ExpenseSubmit = "exp_submit";
    public const string ExpenseApprove = "exp_approve";
    public const string AuditView = "aud_view";
    public const string SysAdmin = "sys_admin";

    public static readonly string[] All =
    [
        EmployeesRead, EmployeesWrite, ProjectsRead, ProjectsWrite, TasksManage,
        LeaveRequest, LeaveApprove, ExpenseSubmit, ExpenseApprove, AuditView, SysAdmin,
    ];
}
