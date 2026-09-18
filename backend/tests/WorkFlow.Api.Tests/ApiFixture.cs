using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using WorkFlow.Api.Common;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Tests;

public sealed class CapturingEmailSender : IEmailSender
{
    public ConcurrentQueue<(string To, string Subject, string Body)> Sent { get; } = new();

    public Task SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        Sent.Enqueue((to, subject, body));
        return Task.CompletedTask;
    }
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new EnumTextConverterFactory() },
    };
}

/// <summary>
/// Boots the real API against a throwaway PostgreSQL database (migrations + seed data included) once per test run.
/// Point WORKFLOW_TEST_PG at a server; the default matches docker-compose.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string DemoPassword = "Password123!";

    private readonly string _server = Environment.GetEnvironmentVariable("WORKFLOW_TEST_PG")
        ?? "Host=localhost;Port=5432;Username=workflow;Password=workflow_dev";
    private readonly string _dbName = $"workflow_test_{Guid.NewGuid():N}";
    private readonly string _receipts = Path.Combine(Path.GetTempPath(), $"workflow_receipts_{Guid.NewGuid():N}");
    private readonly Dictionary<string, string> _tokens = new();
    private WebApplicationFactory<Program> _factory = null!;

    public CapturingEmailSender Emails { get; } = new();

    public Task InitializeAsync()
    {
        // Environment variables (not ConfigureAppConfiguration): Program.cs reads settings before the host is built.
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", $"{_server};Database={_dbName}");
        Environment.SetEnvironmentVariable("Jwt__Key", "integration-test-signing-key-0123456789abcdef");
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "true");
        Environment.SetEnvironmentVariable("Seed__Enabled", "true");
        Environment.SetEnvironmentVariable("Seed__DemoPassword", DemoPassword);
        Environment.SetEnvironmentVariable("Storage__ReceiptsPath", _receipts);
        Environment.SetEnvironmentVariable("RateLimiting__LoginPermitsPerMinute", "100000");

        Environment.SetEnvironmentVariable("Leave__AnnualDaysPerYear", "60"); // generous: many tests share the same few employees
        Environment.SetEnvironmentVariable("Frontend__BaseUrl", "http://frontend.test");

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
            b.ConfigureTestServices(s => s.AddSingleton<IEmailSender>(Emails)));
        _factory.CreateClient().Dispose(); // starts the host: migrates and seeds
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_server + ";Database=postgres");
        await connection.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_dbName}\" WITH (FORCE)", connection);
        await drop.ExecuteNonQueryAsync();
        if (Directory.Exists(_receipts)) Directory.Delete(_receipts, recursive: true);
    }

    public HttpClient Anonymous() => _factory.CreateClient();

    public async Task<HttpClient> As(string email, string password = DemoPassword)
    {
        var client = _factory.CreateClient();
        if (!_tokens.TryGetValue(email, out var token))
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password), Json.Options);
            response.EnsureSuccessStatusCode();
            token = (await response.Content.ReadFromJsonAsync<LoginResponse>(Json.Options))!.Token;
            _tokens[email] = token;
        }
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Demo users (seed data). Imane: Director, holds every permission. Karim: finance manager (approves).
    // Sara: HR, has emp_write but not sys_admin. Yassine and Mehdi: regular staff.
    public const string Imane = "imane.b@workflow-erp.ma";
    public const string Yassine = "yassine.m@workflow-erp.ma";
    public const string Karim = "karim.alami@workflow-erp.ma";
    public const string Sara = "sara.t@workflow-erp.ma";
    public const string Mehdi = "mehdi.c@workflow-erp.ma";
    public const string Salma = "salma.b@workflow-erp.ma";
}

[CollectionDefinition("api")]
public class ApiCollection : ICollectionFixture<ApiFixture>;

public static class HttpExtensions
{
    public static async Task<T> ReadAs<T>(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(body, Json.Options)
            ?? throw new InvalidOperationException($"Empty body: {body}");
    }

    public static Task<HttpResponseMessage> PostJson<T>(this HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, Json.Options);

    public static Task<HttpResponseMessage> PutJson<T>(this HttpClient client, string url, T body) =>
        client.PutAsJsonAsync(url, body, Json.Options);
}
