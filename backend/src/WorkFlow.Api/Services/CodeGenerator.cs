using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Data;

namespace WorkFlow.Api.Services;

public enum CodeKind { Employee, Project, Task, Leave, Expense }

public interface ICodeGenerator
{
    Task<string> NextAsync(CodeKind kind, CancellationToken ct);
}

public sealed class CodeGenerator(AppDbContext db) : ICodeGenerator
{
    // Literal SQL per kind: sequence names are never built from input. Keep these in sync with CodeSequences.
    private const string EmployeeSql = "SELECT nextval('seq_employee_code')::int AS \"Value\"";
    private const string ProjectSql = "SELECT nextval('seq_project_code')::int AS \"Value\"";
    private const string TaskSql = "SELECT nextval('seq_task_code')::int AS \"Value\"";
    private const string LeaveSql = "SELECT nextval('seq_leave_code')::int AS \"Value\"";
    private const string ExpenseSql = "SELECT nextval('seq_expense_code')::int AS \"Value\"";

    public async Task<string> NextAsync(CodeKind kind, CancellationToken ct)
    {
        var (sql, prefix) = kind switch
        {
            CodeKind.Employee => (EmployeeSql, "EMP"),
            CodeKind.Project => (ProjectSql, "PRJ"),
            CodeKind.Task => (TaskSql, "TSK"),
            CodeKind.Leave => (LeaveSql, "LEV"),
            CodeKind.Expense => (ExpenseSql, "EXP"),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

        var next = await db.Database.SqlQueryRaw<int>(sql).SingleAsync(ct);
        return $"{prefix}-{next:000}";
    }
}
