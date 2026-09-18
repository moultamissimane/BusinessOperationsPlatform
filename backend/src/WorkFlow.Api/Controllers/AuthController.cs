using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/auth")]
public class AuthController(
    AppDbContext db, SessionService sessions, ICurrentUser current, IAuditService audit,
    IEmailSender email, IConfiguration config, TimeProvider clock) : ApiController
{
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromMinutes(30);

    // Verified against this when the email is unknown, so response time doesn't reveal which emails exist.
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("not-a-real-password");

    private IQueryable<Employee> WithRelations => db.Employees
        .Include(e => e.Department).Include(e => e.Role).Include(e => e.Permissions).AsSplitQuery();

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var address = request.Email.Trim().ToLowerInvariant();
        var employee = await WithRelations.SingleOrDefaultAsync(e => e.Email == address, ct);

        var valid = BCrypt.Net.BCrypt.Verify(request.Password, employee?.PasswordHash ?? DummyHash);
        if (employee is null || !valid || employee.Status == EmployeeStatus.Terminated)
            return Unauthorized(new ProblemDetails { Status = 401, Title = "Invalid email or password." });

        return await sessions.IssueAsync(employee, current.IpAddress, replacing: null, ct);
    }

    /// <summary>
    /// Swaps a refresh token for a new access + refresh pair. Each refresh token works once; presenting one that was
    /// already used means it leaked (or a client raced itself), so every session for that user is revoked.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("refresh")]
    public async Task<ActionResult<LoginResponse>> Refresh(RefreshRequest request, CancellationToken ct)
    {
        var hash = SecureToken.Hash(request.RefreshToken);
        var token = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null) return InvalidSession();

        if (token.RevokedAt is not null)
        {
            // Only a token that was already swapped for a newer one signals theft. Tokens revoked by logout or a
            // password change are simply dead; treating those as theft would sign out the user's other devices.
            if (token.ReplacedById is not null) await sessions.RevokeAllAsync(token.EmployeeId, ct);
            return InvalidSession();
        }
        if (token.ExpiresAt <= clock.GetUtcNow().UtcDateTime) return InvalidSession();

        // Permissions are re-read here, so role changes take effect within one access-token lifetime.
        var employee = await WithRelations.SingleOrDefaultAsync(e => e.Id == token.EmployeeId, ct);
        if (employee is null || employee.Status == EmployeeStatus.Terminated)
        {
            await sessions.RevokeAllAsync(token.EmployeeId, ct);
            return InvalidSession();
        }

        return await sessions.IssueAsync(employee, current.IpAddress, replacing: token, ct);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken ct)
    {
        var hash = SecureToken.Hash(request.RefreshToken);
        var token = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null, ct);
        if (token is not null)
        {
            token.RevokedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
    {
        var employee = await WithRelations.AsNoTracking().SingleOrDefaultAsync(e => e.Id == current.Id, ct);

        // Terminated accounts are cut off immediately, not only when their token expires.
        if (employee is null || employee.Status == EmployeeStatus.Terminated) return Unauthorized();
        return employee.ToCurrentUser(current.IpAddress);
    }

    /// <summary>Changes the caller's password, signs out every other session and returns a fresh one for this device.</summary>
    [HttpPost("change-password")]
    public async Task<ActionResult<LoginResponse>> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        var employee = await WithRelations.SingleOrDefaultAsync(e => e.Id == current.Id, ct);
        if (employee is null || employee.Status == EmployeeStatus.Terminated) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, employee.PasswordHash))
            return BadRequestDetail("The current password is incorrect.");
        if (request.NewPassword == request.CurrentPassword) return BadRequestDetail("The new password must be different from the current one.");
        if (PasswordPolicy.Check(request.NewPassword) is { } problem) return BadRequestDetail(problem);

        employee.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        audit.Record(AuditAction.Updated, AuditEntityType.Employee, employee.Id, AuditService.Label("Employee", employee.Code),
            "Password: (hidden)", "Password: changed", $"Changed by {employee.Name}");
        await db.SaveChangesAsync(ct);

        await sessions.RevokeAllAsync(employee.Id, ct);
        return await sessions.IssueAsync(employee, current.IpAddress, replacing: null, ct);
    }

    /// <summary>Always answers 202, whether or not the address exists, so it can't be used to discover accounts.</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        var address = request.Email.Trim().ToLowerInvariant();
        var employee = await db.Employees.SingleOrDefaultAsync(e => e.Email == address && e.Status != EmployeeStatus.Terminated, ct);

        if (employee is not null)
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var plain = SecureToken.New();

            // Only the newest link works.
            await db.PasswordResetTokens.Where(t => t.EmployeeId == employee.Id && t.UsedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);
            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                EmployeeId = employee.Id,
                TokenHash = SecureToken.Hash(plain),
                CreatedAt = now,
                ExpiresAt = now.Add(ResetTokenLifetime),
            });
            await db.SaveChangesAsync(ct);

            var baseUrl = (config["Frontend:BaseUrl"] ?? "http://localhost:3000").TrimEnd('/');
            var link = $"{baseUrl}/?reset={Uri.EscapeDataString(plain)}&email={Uri.EscapeDataString(employee.Email)}";
            try
            {
                await email.SendAsync(employee.Email, "Reset your WorkFlow ERP password",
                    $"Hello {employee.Name},\n\nUse this link within {ResetTokenLifetime.TotalMinutes:0} minutes to choose a new password:\n{link}\n\n" +
                    "If you did not ask for this, ignore this email; your password has not changed.", ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Same response either way, or a mail outage would reveal which addresses exist.
                HttpContext.RequestServices.GetRequiredService<ILogger<AuthController>>()
                    .LogError(ex, "Could not send password reset email.");
            }
        }
        return Accepted();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        if (PasswordPolicy.Check(request.NewPassword) is { } problem) return BadRequestDetail(problem);

        var address = request.Email.Trim().ToLowerInvariant();
        var hash = SecureToken.Hash(request.Token);
        var now = clock.GetUtcNow().UtcDateTime;

        var token = await db.PasswordResetTokens.Include(t => t.Employee)
            .SingleOrDefaultAsync(t => t.TokenHash == hash && t.Employee.Email == address, ct);
        if (token is null || token.UsedAt is not null || token.ExpiresAt <= now || token.Employee.Status == EmployeeStatus.Terminated)
            return BadRequestDetail("This reset link is invalid or has expired.");

        token.UsedAt = now;
        token.Employee.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        db.AuditLogs.Add(new AuditLog
        {
            UserId = token.Employee.Id,
            UserName = token.Employee.Name,
            UserRole = "(password reset)",
            Action = AuditAction.Updated,
            EntityType = AuditEntityType.Employee,
            EntityId = token.Employee.Id,
            Entity = AuditService.Label("Employee", token.Employee.Code),
            OldValue = "Password: (hidden)",
            NewValue = "Password: reset via email link",
            Timestamp = now,
            IpAddress = current.IpAddress,
            Notes = "Reset by the account owner using an emailed link.",
        });
        await db.SaveChangesAsync(ct);

        await sessions.RevokeAllAsync(token.EmployeeId, ct);
        return NoContent();
    }

    private ObjectResult InvalidSession() => Fail(StatusCodes.Status401Unauthorized, "The session is no longer valid. Please sign in again.");
}
