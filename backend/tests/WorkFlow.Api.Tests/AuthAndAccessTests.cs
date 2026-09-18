using System.Net;
using System.Net.Http.Json;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using static WorkFlow.Api.Tests.ApiFixture;

namespace WorkFlow.Api.Tests;

[Collection("api")]
public class AuthAndAccessTests(ApiFixture api)
{
    [Fact]
    public async Task Health_endpoint_reports_database_ok()
    {
        var response = await api.Anonymous().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_with_valid_credentials_returns_token_and_profile()
    {
        var response = await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(Imane, DemoPassword));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.ReadAs<LoginResponse>();
        Assert.False(string.IsNullOrEmpty(login.Token));
        Assert.Equal("Imane Benkirane", login.User.Name);
        Assert.Equal("Director", login.User.Role);
        Assert.True(login.User.IsManager);
        Assert.Contains("exp_approve", login.User.Permissions);
    }

    [Fact]
    public async Task Login_is_case_insensitive_on_email()
    {
        var response = await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(Yassine.ToUpperInvariant(), DemoPassword));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await response.ReadAs<LoginResponse>()).User.IsManager);
    }

    [Theory]
    [InlineData(Imane, "wrong-password")]
    [InlineData("nobody@workflow-erp.ma", DemoPassword)]
    public async Task Login_with_bad_credentials_is_401(string email, string password)
    {
        var response = await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/employees")]
    [InlineData("/api/expenses")]
    [InlineData("/api/leaves")]
    [InlineData("/api/projects")]
    [InlineData("/api/audit-logs")]
    [InlineData("/api/dashboard")]
    public async Task Endpoints_require_a_token(string url)
    {
        var response = await api.Anonymous().GetAsync(url);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_returns_the_caller()
    {
        var karim = await api.As(Karim);
        var me = await (await karim.GetAsync("/api/auth/me")).ReadAs<CurrentUserDto>();
        Assert.Equal("Karim Alami", me.Name);
        Assert.Equal("Finance & Accounting", me.Department);
    }

    [Fact]
    public async Task Terminated_employee_cannot_log_in_or_keep_using_their_token()
    {
        var sara = await api.As(Sara);
        var email = $"leaver-{Guid.NewGuid():N}@workflow-erp.ma";
        var created = await sara.PostJson("/api/employees", NewEmployee(email, role: "Associate"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var employee = await created.ReadAs<EmployeeDto>();

        var leaver = await api.As(email, "InitialPass1!");
        Assert.Equal(HttpStatusCode.OK, (await leaver.GetAsync("/api/auth/me")).StatusCode);

        var terminate = await sara.PutJson($"/api/employees/{employee.Id}", new UpdateEmployeeRequest(null, null, null, null, null, null, EmployeeStatus.Terminated, null, null, null));
        Assert.Equal(HttpStatusCode.OK, terminate.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await leaver.GetAsync("/api/auth/me")).StatusCode);
        var relogin = await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(email, "InitialPass1!"));
        Assert.Equal(HttpStatusCode.Unauthorized, relogin.StatusCode);
    }

    [Fact]
    public async Task Staff_without_emp_write_cannot_create_employees()
    {
        var yassine = await api.As(Yassine);
        var response = await yassine.PostJson("/api/employees", NewEmployee($"x-{Guid.NewGuid():N}@workflow-erp.ma"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Hr_cannot_grant_permissions_they_do_not_hold()
    {
        var sara = await api.As(Sara); // has emp_write, but not sys_admin or exp_approve

        // Explicitly asking for sys_admin.
        var explicitGrant = await sara.PostJson("/api/employees",
            NewEmployee($"a-{Guid.NewGuid():N}@workflow-erp.ma", role: "Associate", permissions: ["emp_read", "sys_admin"]));
        Assert.Equal(HttpStatusCode.Forbidden, explicitGrant.StatusCode);

        // Sneaking it in through a role whose defaults include it.
        var viaRole = await sara.PostJson("/api/employees", NewEmployee($"b-{Guid.NewGuid():N}@workflow-erp.ma", role: "Director"));
        Assert.Equal(HttpStatusCode.Forbidden, viaRole.StatusCode);

        // Promoting an existing colleague.
        var mehdi = await (await (await api.As(Imane)).GetAsync("/api/employees?search=Mehdi")).ReadAs<List<EmployeeDto>>();
        var promote = await sara.PutJson($"/api/employees/{mehdi[0].Id}",
            new UpdateEmployeeRequest(null, null, null, null, null, null, null, null, null, [.. mehdi[0].Permissions, "exp_approve"]));
        Assert.Equal(HttpStatusCode.Forbidden, promote.StatusCode);
    }

    [Fact]
    public async Task Hr_can_create_an_employee_with_role_defaults_and_duplicate_email_conflicts()
    {
        var sara = await api.As(Sara);
        var email = $"new-{Guid.NewGuid():N}@workflow-erp.ma";

        var created = await sara.PostJson("/api/employees", NewEmployee(email, role: "Specialist"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var employee = await created.ReadAs<EmployeeDto>();
        Assert.StartsWith("EMP-", employee.Code);
        Assert.Equal(["emp_read", "exp_submit", "lev_request"], employee.Permissions);

        var duplicate = await sara.PostJson("/api/employees", NewEmployee(email.ToUpperInvariant(), role: "Specialist"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Changing_a_role_and_department_is_audited_with_old_and_new_values()
    {
        var imane = await api.As(Imane);
        var email = $"mover-{Guid.NewGuid():N}@workflow-erp.ma";
        var employee = await (await imane.PostJson("/api/employees", NewEmployee(email, role: "Associate", department: "Operations"))).ReadAs<EmployeeDto>();

        var update = await imane.PutJson($"/api/employees/{employee.Id}",
            new UpdateEmployeeRequest(null, null, null, "Finance & Accounting", "Specialist", null, null, null, null, null));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.ReadAs<EmployeeDto>();
        Assert.Equal("Specialist", updated.Role);
        Assert.Equal("Finance & Accounting", updated.Department);

        var audit = await TestData.AuditFor(imane, employee.Id);
        var entry = Assert.Single(audit.Items, a => a.Action == AuditAction.Updated);
        Assert.Contains("Role: Associate", entry.OldValue);
        Assert.Contains("Role: Specialist", entry.NewValue);
        Assert.Contains("Department: Operations", entry.OldValue);
        Assert.Contains("Department: Finance & Accounting", entry.NewValue);
    }

    [Fact]
    public async Task Unknown_enum_values_are_rejected_with_400()
    {
        var yassine = await api.As(Yassine);
        var response = await yassine.PostAsync("/api/expenses", JsonContent.Create(new
        {
            title = "x", amount = 10, currency = "MAD", category = "Yachts", date = "2026-01-01",
        }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static CreateEmployeeRequest NewEmployee(string email, string role = "Associate", string department = "Engineering",
        IReadOnlyList<string>? permissions = null) =>
        new("Test Person", email, "+212 600-000000", null, department, role, "Tester", new DateOnly(2026, 9, 1), "Casablanca", null,
            permissions, "InitialPass1!");
}
