using System.Net;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using static WorkFlow.Api.Tests.ApiFixture;

namespace WorkFlow.Api.Tests;

[Collection("api")]
public class LeaveTests(ApiFixture api)
{
    [Fact]
    public async Task Manager_approval_updates_the_request_and_writes_an_audit_entry()
    {
        var yassine = await api.As(Yassine);
        var karim = await api.As(Karim);
        var leave = await TestData.CreateLeave(yassine);
        Assert.Equal(LeaveStatus.Pending, leave.Status);

        var review = await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Approved, "Enjoy"));
        Assert.Equal(HttpStatusCode.OK, review.StatusCode);
        var reviewed = await review.ReadAs<LeaveDto>();
        Assert.Equal(LeaveStatus.Approved, reviewed.Status);
        Assert.Equal("Karim Alami", reviewed.ReviewedBy);
        Assert.NotNull(reviewed.ReviewedAt);

        var audit = await TestData.AuditFor(await api.As(Imane), leave.Id);
        Assert.Equal(2, audit.Total); // Created + Approved
        var approved = Assert.Single(audit.Items, a => a.Action == AuditAction.Approved);
        Assert.Equal("Karim Alami", approved.UserName);
        Assert.Equal("Department Manager", approved.UserRole);
        Assert.Equal(AuditEntityType.Leave, approved.EntityType);
        Assert.Equal($"Leave #{leave.Code[4..]}", approved.Entity);
        Assert.Equal("Status: Pending", approved.OldValue);
        Assert.Equal("Status: Approved", approved.NewValue);
        Assert.False(string.IsNullOrEmpty(approved.IpAddress));
        Assert.True(approved.Timestamp > DateTime.UtcNow.AddMinutes(-5));
    }

    [Fact]
    public async Task Staff_cannot_review_leave()
    {
        var leave = await TestData.CreateLeave(await api.As(Yassine));
        var response = await (await api.As(Mehdi)).PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Approved, null));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Managers_cannot_review_their_own_leave()
    {
        var karim = await api.As(Karim);
        var leave = await TestData.CreateLeave(karim);
        var response = await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Approved, null));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_request_can_only_be_reviewed_once()
    {
        var leave = await TestData.CreateLeave(await api.As(Yassine));
        var karim = await api.As(Karim);
        Assert.Equal(HttpStatusCode.OK, (await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Approved, null))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Rejected, "changed my mind"))).StatusCode);
    }

    [Fact]
    public async Task Rejecting_requires_a_comment()
    {
        var leave = await TestData.CreateLeave(await api.As(Yassine));
        var karim = await api.As(Karim);
        Assert.Equal(HttpStatusCode.BadRequest, (await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Rejected, "  "))).StatusCode);

        var rejected = await karim.PostJson($"/api/leaves/{leave.Id}/review", new ReviewLeaveRequest(LeaveDecision.Rejected, "Release freeze"));
        Assert.Equal(LeaveStatus.Rejected, (await rejected.ReadAs<LeaveDto>()).Status);
    }

    [Fact]
    public async Task Annual_leave_counts_working_days_while_sick_leave_counts_calendar_days()
    {
        var start = TestData.NextFreeMonday();
        var end = start.AddDays(7); // Monday to the following Monday

        var annual = await (await api.As(Mehdi)).PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, start, end, "Holiday", null));
        Assert.Equal(6, (await annual.ReadAs<LeaveDto>()).DaysCount);

        var sick = await (await api.As(Salma)).PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Sick, start, end, "Flu", null));
        Assert.Equal(8, (await sick.ReadAs<LeaveDto>()).DaysCount);
    }

    [Fact]
    public async Task Invalid_leave_requests_are_rejected()
    {
        var yassine = await api.As(Yassine);
        var start = TestData.NextFreeMonday();

        var backwards = await yassine.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, start.AddDays(3), start, "x", null));
        Assert.Equal(HttpStatusCode.BadRequest, backwards.StatusCode);

        var past = await yassine.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, new DateOnly(2020, 1, 6), new DateOnly(2020, 1, 7), "x", null));
        Assert.Equal(HttpStatusCode.BadRequest, past.StatusCode);

        var noSubtype = await yassine.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Exceptional, start, start.AddDays(1), "x", null));
        Assert.Equal(HttpStatusCode.BadRequest, noSubtype.StatusCode);

        var weekendOnly = await yassine.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, start.AddDays(5), start.AddDays(6), "x", null));
        Assert.Equal(HttpStatusCode.BadRequest, weekendOnly.StatusCode);

        var noReason = await yassine.PostJson("/api/leaves", new CreateLeaveRequest(LeaveType.Annual, start, start.AddDays(1), "", null));
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);
    }

    [Fact]
    public async Task Overlapping_leave_conflicts_unless_the_earlier_one_was_rejected()
    {
        var yassine = await api.As(Yassine);
        var first = await TestData.CreateLeave(yassine, extraDays: 4);

        var overlap = await yassine.PostJson("/api/leaves",
            new CreateLeaveRequest(LeaveType.Annual, first.StartDate.AddDays(2), first.EndDate.AddDays(2), "x", null));
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);

        await (await api.As(Karim)).PostJson($"/api/leaves/{first.Id}/review", new ReviewLeaveRequest(LeaveDecision.Rejected, "No"));
        var retry = await yassine.PostJson("/api/leaves",
            new CreateLeaveRequest(LeaveType.Annual, first.StartDate, first.EndDate, "again", null));
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
    }

    [Fact]
    public async Task Staff_only_see_their_own_leave_but_managers_see_everyone()
    {
        var yassineLeave = await TestData.CreateLeave(await api.As(Yassine));

        var mehdiView = await (await (await api.As(Mehdi)).GetAsync("/api/leaves")).ReadAs<List<LeaveDto>>();
        Assert.All(mehdiView, l => Assert.Equal("Mehdi Chraibi", l.EmployeeName));
        Assert.Equal(HttpStatusCode.NotFound, (await (await api.As(Mehdi)).GetAsync($"/api/leaves/{yassineLeave.Id}")).StatusCode);

        var managerView = await (await (await api.As(Karim)).GetAsync("/api/leaves")).ReadAs<List<LeaveDto>>();
        Assert.Contains(managerView, l => l.Id == yassineLeave.Id);
    }
}
