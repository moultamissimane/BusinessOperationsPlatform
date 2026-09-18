using Microsoft.EntityFrameworkCore;
using Npgsql;
using WorkFlow.Api.Data;

namespace WorkFlow.Api.Tests;

/// <summary>The production first-run path: an empty database gets reference data and exactly one working administrator.</summary>
public class BootstrapTests
{
    private static readonly string Server = Environment.GetEnvironmentVariable("WORKFLOW_TEST_PG")
        ?? "Host=localhost;Port=5432;Username=workflow;Password=workflow_dev";

    [Fact]
    public async Task Bootstrap_creates_one_admin_with_all_permissions_and_is_idempotent()
    {
        var dbName = $"workflow_bootstrap_{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql($"{Server};Database={dbName}").Options;

        try
        {
            await using var db = new AppDbContext(options);
            await db.Database.MigrateAsync();

            await DbSeeder.BootstrapAdminAsync(db, "  Admin@Example.MA ", "FirstAdmin123");
            await DbSeeder.BootstrapAdminAsync(db, "second@example.ma", "AnotherAdmin123"); // ignored: an employee exists

            var admin = await db.Employees.Include(e => e.Role).Include(e => e.Permissions).SingleAsync();
            Assert.Equal("admin@example.ma", admin.Email);
            Assert.Equal("Administrator", admin.Role.Name);
            Assert.Equal(11, admin.Permissions.Count);
            Assert.True(BCrypt.Net.BCrypt.Verify("FirstAdmin123", admin.PasswordHash));
            Assert.StartsWith("EMP-", admin.Code);

            Assert.Equal(11, await db.Permissions.CountAsync());
            Assert.Equal(6, await db.Departments.CountAsync());
            Assert.Equal(7, await db.Roles.CountAsync());
            Assert.Equal(0, await db.Projects.CountAsync()); // no demo data
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var connection = new NpgsqlConnection(Server + ";Database=postgres");
            await connection.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Bootstrap_refuses_a_weak_password()
    {
        var dbName = $"workflow_bootstrap_{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql($"{Server};Database={dbName}").Options;

        try
        {
            await using var db = new AppDbContext(options);
            await db.Database.MigrateAsync();
            await Assert.ThrowsAsync<InvalidOperationException>(() => DbSeeder.BootstrapAdminAsync(db, "a@b.ma", "weak"));
            Assert.Equal(0, await db.Employees.CountAsync());
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var connection = new NpgsqlConnection(Server + ";Database=postgres");
            await connection.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
