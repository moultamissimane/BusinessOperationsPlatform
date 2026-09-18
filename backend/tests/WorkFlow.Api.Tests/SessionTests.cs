using System.Net;
using System.Text.RegularExpressions;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using static WorkFlow.Api.Tests.ApiFixture;

namespace WorkFlow.Api.Tests;

[Collection("api")]
public class SessionTests(ApiFixture api)
{
    // Each test signs up its own employee so revoking sessions never disturbs the shared demo users.
    private async Task<string> NewEmployee(string password = "StartPass1!")
    {
        var email = $"sess-{Guid.NewGuid():N}@workflow-erp.ma";
        var created = await (await api.As(Sara)).PostJson("/api/employees",
            new CreateEmployeeRequest("Session Tester", email, null, null, "Engineering", "Associate", "Tester",
                new DateOnly(2026, 9, 1), null, null, null, password));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        return email;
    }

    private async Task<LoginResponse> Login(string email, string password)
    {
        var response = await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAs<LoginResponse>();
    }

    private Task<HttpResponseMessage> Refresh(string token) =>
        api.Anonymous().PostJson("/api/auth/refresh", new RefreshRequest(token));

    [Fact]
    public async Task Refresh_rotates_the_token_and_the_old_one_stops_working()
    {
        var email = await NewEmployee();
        var first = await Login(email, "StartPass1!");
        Assert.False(string.IsNullOrEmpty(first.RefreshToken));

        var refreshed = await Refresh(first.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var second = await refreshed.ReadAs<LoginResponse>();
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
        Assert.Equal(email, second.User.Email);

        // The new access token works.
        var client = api.Anonymous();
        client.DefaultRequestHeaders.Authorization = new("Bearer", second.Token);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Reusing_a_spent_refresh_token_revokes_the_whole_session_family()
    {
        var email = await NewEmployee();
        var first = await Login(email, "StartPass1!");
        var second = await (await Refresh(first.RefreshToken)).ReadAs<LoginResponse>();

        // Replaying the first token looks like theft...
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(first.RefreshToken)).StatusCode);
        // ...so the legitimate newer token is dead too.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(second.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Garbage_and_logged_out_refresh_tokens_are_rejected()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh("not-a-token")).StatusCode);

        var session = await Login(await NewEmployee(), "StartPass1!");
        var logout = await api.Anonymous().PostJson("/api/auth/logout", new RefreshRequest(session.RefreshToken));
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(session.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Refresh_picks_up_permission_changes_and_termination()
    {
        var email = await NewEmployee();
        var session = await Login(email, "StartPass1!");
        Assert.DoesNotContain("exp_approve", session.User.Permissions);

        var imane = await api.As(Imane);
        var employee = (await (await imane.GetAsync($"/api/employees?search={email}")).ReadAs<List<EmployeeDto>>())[0];
        await imane.PutJson($"/api/employees/{employee.Id}", new UpdateEmployeeRequest(null, null, null, null, null, null, null, null, null, [.. employee.Permissions, "exp_approve"]));

        var refreshed = await (await Refresh(session.RefreshToken)).ReadAs<LoginResponse>();
        Assert.Contains("exp_approve", refreshed.User.Permissions);
        Assert.True(refreshed.User.IsManager);

        await imane.PutJson($"/api/employees/{employee.Id}", new UpdateEmployeeRequest(null, null, null, null, null, null, EmployeeStatus.Terminated, null, null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(refreshed.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Changing_password_requires_the_current_one_enforces_policy_and_signs_out_other_sessions()
    {
        var email = await NewEmployee();
        var laptop = await Login(email, "StartPass1!");
        var phone = await Login(email, "StartPass1!");

        var client = api.Anonymous();
        client.DefaultRequestHeaders.Authorization = new("Bearer", laptop.Token);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJson("/api/auth/change-password", new ChangePasswordRequest("wrong", "NewPass123"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJson("/api/auth/change-password", new ChangePasswordRequest("StartPass1!", "short1"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJson("/api/auth/change-password", new ChangePasswordRequest("StartPass1!", "onlyletters"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJson("/api/auth/change-password", new ChangePasswordRequest("StartPass1!", "StartPass1!"))).StatusCode);

        var changed = await client.PostJson("/api/auth/change-password", new ChangePasswordRequest("StartPass1!", "BrandNew123"));
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var fresh = await changed.ReadAs<LoginResponse>();

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(phone.RefreshToken)).StatusCode);   // other device signed out
        Assert.Equal(HttpStatusCode.OK, (await Refresh(fresh.RefreshToken)).StatusCode);              // this device continues
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.Anonymous().PostJson("/api/auth/login", new LoginRequest(email, "StartPass1!"))).StatusCode);
        await Login(email, "BrandNew123");

        // The change is on the audit trail, without the password itself.
        var audit = await TestData.AuditFor(await api.As(Imane), fresh.User.Id);
        var entry = Assert.Single(audit.Items, a => a.NewValue == "Password: changed");
        Assert.Equal("Session Tester", entry.UserName);
        Assert.DoesNotContain("BrandNew123", entry.OldValue + entry.NewValue + entry.Notes);
    }

    [Fact]
    public async Task Forgot_and_reset_password_flow()
    {
        var email = await NewEmployee();
        var session = await Login(email, "StartPass1!");

        var forgot = await api.Anonymous().PostJson("/api/auth/forgot-password", new ForgotPasswordRequest(email));
        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);

        var mail = api.Emails.Sent.Last(m => m.To == email);
        var token = Uri.UnescapeDataString(Regex.Match(mail.Body, @"reset=([^&\s]+)").Groups[1].Value);
        Assert.StartsWith("http://frontend.test/?reset=", Regex.Match(mail.Body, @"http\S+").Value);
        Assert.False(string.IsNullOrEmpty(token));

        // Bad token, weak password, wrong email: all refused.
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(email, "garbage", "ResetPass123")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(email, token, "weak")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset("someone@else.ma", token, "ResetPass123")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Reset(email, token, "ResetPass123")).StatusCode);

        await Login(email, "ResetPass123");
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(session.RefreshToken)).StatusCode); // old sessions revoked
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(email, token, "AnotherPass123")).StatusCode); // single use
    }

    [Fact]
    public async Task Only_the_newest_reset_link_works_and_unknown_emails_get_the_same_answer()
    {
        var email = await NewEmployee();
        await api.Anonymous().PostJson("/api/auth/forgot-password", new ForgotPasswordRequest(email));
        await api.Anonymous().PostJson("/api/auth/forgot-password", new ForgotPasswordRequest(email));
        var tokens = api.Emails.Sent.Where(m => m.To == email)
            .Select(m => Uri.UnescapeDataString(Regex.Match(m.Body, @"reset=([^&\s]+)").Groups[1].Value)).ToList();
        Assert.Equal(2, tokens.Count);

        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(email, tokens[0], "ResetPass123")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(email, tokens[1], "ResetPass123")).StatusCode);

        var before = api.Emails.Sent.Count;
        var unknown = await api.Anonymous().PostJson("/api/auth/forgot-password", new ForgotPasswordRequest("nobody@workflow-erp.ma"));
        Assert.Equal(HttpStatusCode.Accepted, unknown.StatusCode);
        Assert.Equal(before, api.Emails.Sent.Count);
    }

    [Fact]
    public async Task Annual_leave_balance_is_tracked_and_enforced()
    {
        var mehdi = await api.As(Mehdi);
        var start = TestData.NextFreeMonday();

        var before = await (await mehdi.GetAsync($"/api/leaves/balance?year={start.Year}")).ReadAs<LeaveBalanceDto>();
        Assert.Equal(before.Entitlement - before.Used - before.Pending, before.Remaining);

        var leave = await mehdi.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, start, start.AddDays(2), "Trip", null));
        Assert.Equal(HttpStatusCode.Created, leave.StatusCode);
        var after = await (await mehdi.GetAsync($"/api/leaves/balance?year={start.Year}")).ReadAs<LeaveBalanceDto>();
        Assert.Equal(before.Pending + 3, after.Pending);
        Assert.Equal(before.Remaining - 3, after.Remaining);

        // Asking for more than what's left is refused; sick leave doesn't touch the balance.
        var far = TestData.NextFreeMonday();
        var tooMuch = await mehdi.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, far, far.AddDays(7 * 40), "Sabbatical", null));
        Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);
        Assert.Contains("Not enough annual leave", await tooMuch.Content.ReadAsStringAsync());
        var sickStart = TestData.NextFreeMonday();
        Assert.Equal(HttpStatusCode.Created,
            (await mehdi.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Sick, sickStart, sickStart.AddDays(2), "Flu", null))).StatusCode);
        Assert.Equal(after.Remaining, (await (await mehdi.GetAsync($"/api/leaves/balance?year={start.Year}")).ReadAs<LeaveBalanceDto>()).Remaining);

        // Rejected requests give the days back.
        var created = await leave.ReadAs<LeaveDto>();
        await (await api.As(Karim)).PostJson($"/api/leaves/{created.Id}/review", new ReviewLeaveRequest(LeaveDecision.Rejected, "Busy"));
        Assert.Equal(before.Remaining, (await (await mehdi.GetAsync($"/api/leaves/balance?year={start.Year}")).ReadAs<LeaveBalanceDto>()).Remaining);
    }

    [Fact]
    public async Task Balances_of_other_people_are_visible_to_approvers_only()
    {
        var yassine = (await (await (await api.As(Imane)).GetAsync("/api/employees?search=Yassine")).ReadAs<List<EmployeeDto>>())[0];

        Assert.Equal(HttpStatusCode.Forbidden, (await (await api.As(Mehdi)).GetAsync($"/api/leaves/balance?employeeId={yassine.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await api.As(Karim)).GetAsync($"/api/leaves/balance?employeeId={yassine.Id}")).StatusCode);
    }

    private Task<HttpResponseMessage> Reset(string email, string token, string password) =>
        api.Anonymous().PostJson("/api/auth/reset-password", new ResetPasswordRequest(email, token, password));
}
