using System.Net;
using System.Net.Http.Headers;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;

namespace WorkFlow.Api.Tests;

public static class TestData
{
    // Every call hands out a fresh two-week window (a leave of up to 13 days fits), so requests from different tests never overlap.
    private static int _week = 30;

    public static DateOnly NextFreeMonday()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monday = today.AddDays(((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7);
        return monday.AddDays(7 * Interlocked.Add(ref _week, 2));
    }

    public static async Task<LeaveDto> CreateLeave(HttpClient client, LeaveType type = LeaveType.Annual, int extraDays = 2)
    {
        var start = NextFreeMonday();
        var response = await client.PostJson("/api/leaves",
            new CreateLeaveRequest(type, start, start.AddDays(extraDays), "Integration test", type == LeaveType.Exceptional ? ExceptionalLeaveSubtype.Other : null));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAs<LeaveDto>();
    }

    public static async Task<ExpenseDto> CreateExpense(HttpClient client, decimal amount = 250m)
    {
        var response = await client.PostJson("/api/expenses",
            new CreateExpenseRequest("Integration test expense", amount, Currency.MAD, ExpenseCategory.OfficeSupplies,
                DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAs<ExpenseDto>();
    }

    // Smallest valid PNG (1x1 pixel).
    public static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    public static Task<HttpResponseMessage> UploadReceipt(HttpClient client, Guid expenseId, byte[] content, string fileName)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var form = new MultipartFormDataContent { { file, "file", fileName } };
        return client.PostAsync($"/api/expenses/{expenseId}/receipt", form);
    }

    public static async Task<ExpenseDto> CreateExpenseWithReceipt(HttpClient client, decimal amount = 250m)
    {
        var expense = await CreateExpense(client, amount);
        var upload = await UploadReceipt(client, expense.Id, Png, "receipt.png");
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        return await upload.ReadAs<ExpenseDto>();
    }

    public static async Task<PagedResult<AuditLogDto>> AuditFor(HttpClient auditor, Guid entityId)
    {
        var response = await auditor.GetAsync($"/api/audit-logs?entityId={entityId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAs<PagedResult<AuditLogDto>>();
    }
}
