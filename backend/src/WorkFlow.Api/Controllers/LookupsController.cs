using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;

namespace WorkFlow.Api.Controllers;

[Route("api")]
public class LookupsController(AppDbContext db) : ApiController
{
    [HttpGet("departments")]
    public async Task<IReadOnlyList<DepartmentDto>> Departments(CancellationToken ct) =>
        await db.Departments.AsNoTracking().OrderBy(d => d.Name).Select(d => new DepartmentDto(d.Id, d.Name)).ToListAsync(ct);

    [HttpPost("departments")]
    [Authorize(Policy = Perm.SysAdmin)]
    public async Task<ActionResult<DepartmentDto>> CreateDepartment(CreateDepartmentRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(d => d.Name == name, ct)) return ConflictDetail($"Department '{name}' already exists.");

        var department = new Department { Name = name };
        db.Departments.Add(department);
        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return Created($"api/departments/{department.Id}", new DepartmentDto(department.Id, department.Name));
    }

    [HttpGet("roles")]
    public async Task<IReadOnlyList<RoleDto>> Roles(CancellationToken ct)
    {
        var roles = await db.Roles.AsNoTracking().Include(r => r.DefaultPermissions).OrderBy(r => r.Name).ToListAsync(ct);
        return roles.Select(r => new RoleDto(r.Id, r.Name, r.DefaultPermissions.Select(p => p.Id).Order().ToList())).ToList();
    }

    [HttpPost("roles")]
    [Authorize(Policy = Perm.SysAdmin)]
    public async Task<ActionResult<RoleDto>> CreateRole(CreateRoleRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (await db.Roles.AnyAsync(r => r.Name == name, ct)) return ConflictDetail($"Role '{name}' already exists.");

        var ids = request.DefaultPermissions?.Distinct().ToList() ?? [];
        var permissions = await db.Permissions.Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        if (permissions.Count != ids.Count) return BadRequestDetail("One or more permissions do not exist.");

        var role = new Role { Name = name, DefaultPermissions = permissions };
        db.Roles.Add(role);
        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return Created($"api/roles/{role.Id}", new RoleDto(role.Id, role.Name, ids.Order().ToList()));
    }

    [HttpGet("permissions")]
    public async Task<IReadOnlyList<PermissionDto>> Permissions(CancellationToken ct) =>
        await db.Permissions.AsNoTracking().OrderBy(p => p.Category).ThenBy(p => p.Id)
            .Select(p => new PermissionDto(p.Id, p.Name, p.Category, p.Description)).ToListAsync(ct);
}
