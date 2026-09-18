using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace WorkFlow.Api.Services;

public interface ICurrentUser
{
    Guid Id { get; }
    string Name { get; }
    string Role { get; }
    /// <summary>Client address as seen by the API (honours X-Forwarded-For only when explicitly trusted).</summary>
    string IpAddress { get; }
    IReadOnlySet<string> Permissions { get; }
    bool Has(string permission);
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public const string PermissionClaim = "permission";
    public const string RoleClaim = "role";

    private HttpContext Context => accessor.HttpContext ?? throw new InvalidOperationException("No active HTTP request.");
    private ClaimsPrincipal Principal => Context.User;

    public Guid Id => Guid.TryParse(Principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id)
        ? id
        : throw new InvalidOperationException("Request is not authenticated.");

    public string Name => Principal.FindFirstValue(JwtRegisteredClaimNames.Name) ?? "";
    public string Role => Principal.FindFirstValue(RoleClaim) ?? "";

    public string IpAddress
    {
        get
        {
            var ip = Context.Connection.RemoteIpAddress;
            if (ip is null) return "unknown";
            return (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip).ToString();
        }
    }

    public IReadOnlySet<string> Permissions =>
        Principal.FindAll(PermissionClaim).Select(c => c.Value).ToHashSet();

    public bool Has(string permission) => Principal.HasClaim(PermissionClaim, permission);
}
