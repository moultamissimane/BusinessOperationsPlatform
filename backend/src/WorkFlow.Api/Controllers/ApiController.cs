using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using WorkFlow.Api.Data;

namespace WorkFlow.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
public abstract class ApiController : ControllerBase
{
    protected ObjectResult Fail(int status, string detail) => Problem(detail: detail, statusCode: status);

    protected ObjectResult BadRequestDetail(string detail) => Fail(StatusCodes.Status400BadRequest, detail);
    protected ObjectResult ConflictDetail(string detail) => Fail(StatusCodes.Status409Conflict, detail);
    protected ObjectResult ForbidDetail(string detail) => Fail(StatusCodes.Status403Forbidden, detail);

    /// <summary>Saves and turns concurrency / unique-index races into a 409 instead of a 500. Null means success.</summary>
    protected async Task<ObjectResult?> TrySaveAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConflictDetail("This record was changed by someone else. Reload it and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return ConflictDetail("A record with the same unique value already exists.");
        }
    }
}
