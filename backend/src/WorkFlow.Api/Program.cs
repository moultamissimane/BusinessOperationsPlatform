using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---- Configuration (fail fast: a misconfigured secret should stop startup, not surface as 500s later) ----
var jwtKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Jwt:Key must be set to a secret of at least 32 bytes (env var Jwt__Key).");

var connectionString = config.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

builder.Services.Configure<JwtOptions>(config.GetSection("Jwt"));
builder.Services.Configure<StorageOptions>(config.GetSection("Storage"));
builder.Services.Configure<EmailOptions>(config.GetSection("Email"));

// ---- Data & services ----
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<ICodeGenerator, CodeGenerator>();
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddScoped<SessionService>();

if (string.Equals(config["Storage:Provider"], "AzureBlob", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IReceiptStorage, AzureBlobReceiptStorage>();
else
    builder.Services.AddSingleton<IReceiptStorage, LocalReceiptStorage>();

if (!string.IsNullOrWhiteSpace(config["Email:Smtp:Host"]))
    builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
else
    builder.Services.AddSingleton<IEmailSender, UnconfiguredEmailSender>();

// ---- Authentication & authorization ----
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // keep "sub", "role", "permission" as issued
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = config["Jwt:Issuer"] ?? "workflow-erp",
            ValidateAudience = true,
            ValidAudience = config["Jwt:Audience"] ?? "workflow-erp-web",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "name",
            RoleClaimType = CurrentUser.RoleClaim,
        };
    });

builder.Services.AddAuthorization(o =>
{
    // One policy per permission, named after it: [Authorize(Policy = Perm.ExpenseApprove)].
    foreach (var permission in Perm.All)
        o.AddPolicy(permission, p => p.RequireAuthenticatedUser().RequireClaim(CurrentUser.PermissionClaim, permission));
});

// ---- Rate limiting (login only: slows password guessing) ----
var loginLimit = config.GetValue("RateLimiting:LoginPermitsPerMinute", 10);
var refreshLimit = config.GetValue("RateLimiting:RefreshPermitsPerMinute", 60);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    string Client(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // Password guessing: tight. Everything that takes a password or a reset link goes through this one.
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(Client(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = loginLimit, Window = TimeSpan.FromMinutes(1) }));

    // Refresh tokens are 256-bit secrets, so guessing isn't the threat; this only curbs abuse. It must be generous
    // enough that a normal session (and everyone behind one office NAT) never gets refused.
    o.AddPolicy("refresh", ctx => RateLimitPartition.GetFixedWindowLimiter(Client(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = refreshLimit, Window = TimeSpan.FromMinutes(1) }));
});

// ---- Behind a reverse proxy (Azure Container Apps ingress) the socket IP is the proxy's, not the user's ----
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (config.GetValue("ForwardedHeaders:TrustAllProxies", false))
    {
        // Only enable when the app is reachable exclusively through the proxy; otherwise clients can spoof their IP in the audit log.
        o.KnownNetworks.Clear();
        o.KnownProxies.Clear();
    }
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"])
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new EnumTextConverterFactory()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "WorkFlow ERP API", Version = "v1" });
    o.SchemaFilter<EnumTextSchemaFilter>();
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste the token returned by POST /api/auth/login.",
    });
    o.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [],
    });
});

var app = builder.Build();

// ---- Database bootstrap ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (config.GetValue("Database:MigrateOnStartup", false)) await db.Database.MigrateAsync();
    if (config.GetValue("Seed:Enabled", false))
    {
        await DbSeeder.SeedAsync(db, config["Seed:DemoPassword"] ?? throw new InvalidOperationException("Seed:DemoPassword is required when Seed:Enabled is true."));
    }
    else if (!string.IsNullOrWhiteSpace(config["Bootstrap:AdminEmail"]))
    {
        // Fresh production database: create the first administrator (a no-op once any employee exists).
        await DbSeeder.BootstrapAdminAsync(db, config["Bootstrap:AdminEmail"]!,
            config["Bootstrap:AdminPassword"] ?? throw new InvalidOperationException("Bootstrap:AdminPassword is required with Bootstrap:AdminEmail."));
    }
}

// ---- Pipeline ----
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment() || config.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

// Exposed so WebApplicationFactory<Program> can host the API in integration tests.
public partial class Program;
