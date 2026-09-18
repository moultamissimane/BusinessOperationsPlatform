using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WorkFlow.Api.Domain;

namespace WorkFlow.Api.Services;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "workflow-erp";
    public string Audience { get; set; } = "workflow-erp-web";
    /// <summary>Access tokens are short-lived; the refresh token keeps the session going.</summary>
    public int ExpiryMinutes { get; set; } = 15;
    public int RefreshDays { get; set; } = 7;
}

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) Create(Employee employee, IEnumerable<string> permissions);
}

public sealed class TokenService(Microsoft.Extensions.Options.IOptions<JwtOptions> options, TimeProvider clock) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public (string Token, DateTime ExpiresAt) Create(Employee employee, IEnumerable<string> permissions)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(_options.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, employee.Id.ToString()),
            new(JwtRegisteredClaimNames.Name, employee.Name),
            new(JwtRegisteredClaimNames.Email, employee.Email),
            new(CurrentUser.RoleClaim, employee.Role.Name),
        };
        claims.AddRange(permissions.Select(p => new Claim(CurrentUser.PermissionClaim, p)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(_options.Issuer, _options.Audience, claims, now, expires, credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
