using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;

namespace WorkFlow.Api.Services;

public static class SecureToken
{
    /// <summary>256 random bits, URL-safe. This is what the client holds.</summary>
    public static string New() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    /// <summary>What the database holds. The tokens are high-entropy, so a fast hash is appropriate (unlike passwords).</summary>
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}

public static class PasswordPolicy
{
    /// <summary>Returns an error message, or null when the password is acceptable.</summary>
    public static string? Check(string password)
    {
        if (password.Length < 8 || password.Length > 128) return "Password must be between 8 and 128 characters.";
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit)) return "Password must contain at least one letter and one digit.";
        return null;
    }
}

public sealed class SessionService(AppDbContext db, ITokenService tokens, IOptions<JwtOptions> jwt, TimeProvider clock)
{
    /// <summary>Employee must be loaded with Department, Role and Permissions.</summary>
    public async Task<LoginResponse> IssueAsync(Employee employee, string ip, RefreshToken? replacing, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var permissions = employee.Permissions.Select(p => p.Id).Order().ToList();
        var (access, expiresAt) = tokens.Create(employee, permissions);

        var plain = SecureToken.New();
        var refresh = new RefreshToken
        {
            EmployeeId = employee.Id,
            TokenHash = SecureToken.Hash(plain),
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwt.Value.RefreshDays),
            CreatedByIp = ip,
        };
        db.RefreshTokens.Add(refresh);
        if (replacing is not null)
        {
            replacing.RevokedAt = now;
            replacing.ReplacedById = refresh.Id;
        }
        await db.SaveChangesAsync(ct);

        return new LoginResponse(access, expiresAt, plain, employee.ToCurrentUser(ip));
    }

    public async Task RevokeAllAsync(Guid employeeId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        await db.RefreshTokens
            .Where(t => t.EmployeeId == employeeId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }
}
