using System.Net;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using static WorkFlow.Api.Tests.ApiFixture;

namespace WorkFlow.Api.Tests;

[Collection("api")]
public class WorkTests(ApiFixture api)
{
    private async Task<(ProjectDto Project, EmployeeDto Lead)> CreateProject(HttpClient imane)
    {
        var employees = await (await imane.GetAsync("/api/employees?search=Yassine")).ReadAs<List<EmployeeDto>>();
        var lead = employees[0];
        var response = await imane.PostJson("/api/projects", new CreateProjectRequest(
            "Integration Test Project", "desc", "Engineering", lead.Id, 10_000m,
            new DateOnly(2026, 10, 1), new DateOnly(2026, 12, 1), null, null));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.ReadAs<ProjectDto>(), lead);
    }

    [Fact]
    public async Task Creating_a_project_needs_prj_write_and_puts_the_lead_on_the_team()
    {
        var forbidden = await (await api.As(Sara)).PostJson("/api/projects", new CreateProjectRequest(
            "Nope", null, "Engineering", Guid.NewGuid(), 1m, new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1), null, null));
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        var (project, lead) = await CreateProject(await api.As(Imane));
        Assert.StartsWith("PRJ-", project.Code);
        Assert.Equal(ProjectStatus.Planning, project.Status);
        Assert.Contains(lead.Id, project.TeamIds);
    }

    [Fact]
    public async Task Project_validation_rules()
    {
        var imane = await api.As(Imane);
        var lead = (await (await imane.GetAsync("/api/employees?search=Yassine")).ReadAs<List<EmployeeDto>>())[0];

        var backwards = await imane.PostJson("/api/projects", new CreateProjectRequest(
            "Bad dates", null, "Engineering", lead.Id, 1m, new DateOnly(2026, 12, 1), new DateOnly(2026, 10, 1), null, null));
        Assert.Equal(HttpStatusCode.BadRequest, backwards.StatusCode);

        var ghostLead = await imane.PostJson("/api/projects", new CreateProjectRequest(
            "Ghost", null, "Engineering", Guid.NewGuid(), 1m, new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1), null, null));
        Assert.Equal(HttpStatusCode.BadRequest, ghostLead.StatusCode);

        var (project, _) = await CreateProject(imane);
        var badProgress = await imane.PutJson($"/api/projects/{project.Id}", new UpdateProjectRequest(null, null, null, null, null, null, null, 150, null));
        Assert.Equal(HttpStatusCode.BadRequest, badProgress.StatusCode);
    }

    [Fact]
    public async Task Project_status_change_is_audited_as_a_status_change()
    {
        var imane = await api.As(Imane);
        var (project, _) = await CreateProject(imane);

        var update = await imane.PutJson($"/api/projects/{project.Id}", new UpdateProjectRequest(null, null, null, null, null, null, ProjectStatus.InProgress, null, null));
        Assert.Equal(ProjectStatus.InProgress, (await update.ReadAs<ProjectDto>()).Status);

        var audit = await TestData.AuditFor(imane, project.Id);
        var entry = Assert.Single(audit.Items, a => a.Action == AuditAction.StatusChanged);
        Assert.Equal("Status: Planning", entry.OldValue);
        Assert.Equal("Status: In Progress", entry.NewValue);
    }

    [Fact]
    public async Task Assignee_can_move_their_own_task_but_other_staff_cannot()
    {
        var imane = await api.As(Imane);
        var (project, lead) = await CreateProject(imane);

        var create = await imane.PostJson("/api/tasks", new CreateTaskRequest(project.Id, "Write tests", "d", lead.Id, TaskPriority.High, new DateOnly(2026, 11, 1)));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var task = await create.ReadAs<TaskDto>();
        Assert.Equal(TaskItemStatus.Backlog, task.Status);

        var salma = await api.As(Salma); // no tsk_manage, not the assignee
        Assert.Equal(HttpStatusCode.Forbidden, (await salma.PatchAsync($"/api/tasks/{task.Id}/status", JsonBody(TaskItemStatus.Completed))).StatusCode);

        var yassine = await api.As(Yassine);
        var move = await yassine.PatchAsync($"/api/tasks/{task.Id}/status", JsonBody(TaskItemStatus.InProgress));
        Assert.Equal(HttpStatusCode.OK, move.StatusCode);
        Assert.Equal(TaskItemStatus.InProgress, (await move.ReadAs<TaskDto>()).Status);

        var audit = await TestData.AuditFor(imane, task.Id);
        var entry = Assert.Single(audit.Items, a => a.Action == AuditAction.StatusChanged);
        Assert.Equal("Yassine Mansouri", entry.UserName);
        Assert.Equal("Status: Backlog", entry.OldValue);
        Assert.Equal("Status: In Progress", entry.NewValue);

        // Setting the same status again is a no-op, not a second audit row.
        await yassine.PatchAsync($"/api/tasks/{task.Id}/status", JsonBody(TaskItemStatus.InProgress));
        Assert.Equal(2, (await TestData.AuditFor(imane, task.Id)).Total);
    }

    [Fact]
    public async Task Tasks_can_be_filtered_by_project_and_status()
    {
        var imane = await api.As(Imane);
        var projects = await (await imane.GetAsync("/api/projects")).ReadAs<List<ProjectDto>>();
        var azure = projects.Single(p => p.Code == "PRJ-101");

        var tasks = await (await imane.GetAsync($"/api/tasks?projectId={azure.Id}&status=In%20Progress")).ReadAs<List<TaskDto>>();
        Assert.NotEmpty(tasks);
        Assert.All(tasks, t =>
        {
            Assert.Equal(azure.Id, t.ProjectId);
            Assert.Equal(TaskItemStatus.InProgress, t.Status);
        });
    }

    [Fact]
    public async Task Dashboard_for_a_manager_is_organisation_wide_and_matches_the_lists()
    {
        var imane = await api.As(Imane);
        var dashboard = await (await imane.GetAsync("/api/dashboard")).ReadAs<DashboardDto>();
        var employees = await (await imane.GetAsync("/api/employees")).ReadAs<List<EmployeeDto>>();
        var leaves = await (await imane.GetAsync("/api/leaves")).ReadAs<List<LeaveDto>>();
        var expenses = await (await imane.GetAsync("/api/expenses")).ReadAs<List<ExpenseDto>>();
        var projects = await (await imane.GetAsync("/api/projects")).ReadAs<List<ProjectDto>>();

        Assert.Equal("organization", dashboard.Scope);
        Assert.Equal(employees.Count, dashboard.Employees.Total);
        Assert.Equal(leaves.Count(l => l.Status == LeaveStatus.Pending), dashboard.PendingRequests.Leaves);
        Assert.Equal(expenses.Count(e => e.Status == ExpenseStatus.Pending), dashboard.PendingRequests.Expenses);
        Assert.Equal(dashboard.PendingRequests.Leaves + dashboard.PendingRequests.Expenses, dashboard.PendingRequests.Total);
        Assert.Equal(projects.Count, dashboard.Projects.Total);
        Assert.Equal(expenses.Count, dashboard.Expenses.ByStatus.Sum(s => s.Count));

        var pendingMad = expenses.Where(e => e.Status == ExpenseStatus.Pending && e.Currency == Currency.MAD).Sum(e => e.Amount);
        Assert.Equal(pendingMad, dashboard.Expenses.PendingAmount.Single(a => a.Currency == Currency.MAD).Amount);
    }

    [Fact]
    public async Task Dashboard_for_staff_is_scoped_to_their_own_requests_and_tasks()
    {
        var mehdi = await api.As(Mehdi);
        var dashboard = await (await mehdi.GetAsync("/api/dashboard")).ReadAs<DashboardDto>();
        var ownExpenses = await (await mehdi.GetAsync("/api/expenses")).ReadAs<List<ExpenseDto>>();

        Assert.Equal("personal", dashboard.Scope);
        Assert.Equal(ownExpenses.Count, dashboard.Expenses.ByStatus.Sum(s => s.Count));
        Assert.Equal(ownExpenses.Count(e => e.Status == ExpenseStatus.Pending), dashboard.PendingRequests.Expenses);
    }

    [Fact]
    public async Task Audit_log_requires_aud_view_is_paged_and_filterable()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await (await api.As(Yassine)).GetAsync("/api/audit-logs")).StatusCode);

        var imane = await api.As(Imane);
        var page = await (await imane.GetAsync("/api/audit-logs?pageSize=2")).ReadAs<PagedResult<AuditLogDto>>();
        Assert.Equal(2, page.Items.Count);
        Assert.True(page.Total >= 6);
        Assert.True(page.Items[0].Timestamp >= page.Items[1].Timestamp, "newest first");

        var tasksOnly = await (await imane.GetAsync("/api/audit-logs?entityType=Task&pageSize=100")).ReadAs<PagedResult<AuditLogDto>>();
        Assert.NotEmpty(tasksOnly.Items);
        Assert.All(tasksOnly.Items, a => Assert.Equal(AuditEntityType.Task, a.EntityType));

        Assert.Equal(HttpStatusCode.BadRequest, (await imane.GetAsync("/api/audit-logs?pageSize=1000")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await imane.GetAsync("/api/audit-logs?entityType=Banana")).StatusCode);
    }

    [Fact]
    public async Task Audit_log_has_no_write_endpoints()
    {
        var imane = await api.As(Imane);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await imane.PostJson("/api/audit-logs", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await imane.DeleteAsync("/api/audit-logs")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await imane.DeleteAsync($"/api/audit-logs/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await imane.PutJson($"/api/audit-logs/{Guid.NewGuid()}", new { })).StatusCode);
    }

    [Fact]
    public async Task Lookups_expose_departments_roles_and_permissions()
    {
        var yassine = await api.As(Yassine);
        var departments = await (await yassine.GetAsync("/api/departments")).ReadAs<List<DepartmentDto>>();
        var roles = await (await yassine.GetAsync("/api/roles")).ReadAs<List<RoleDto>>();
        var permissions = await (await yassine.GetAsync("/api/permissions")).ReadAs<List<PermissionDto>>();

        Assert.Contains(departments, d => d.Name == "Finance & Accounting");
        Assert.Contains(roles, r => r.Name == "Department Manager" && r.DefaultPermissions.Contains("exp_approve"));
        Assert.Equal(11, permissions.Count);

        // Creating lookup data is admin-only.
        Assert.Equal(HttpStatusCode.Forbidden, (await yassine.PostJson("/api/departments", new CreateDepartmentRequest("Legal"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await (await api.As(Imane)).PostJson("/api/departments", new CreateDepartmentRequest($"Legal {Guid.NewGuid():N}"))).StatusCode);
    }

    private static StringContent JsonBody(TaskItemStatus status) =>
        new(System.Text.Json.JsonSerializer.Serialize(new UpdateTaskStatusRequest(status), Json.Options), System.Text.Encoding.UTF8, "application/json");
}
