using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/employees")]
public class EmployeesController(AppDbContext db, IAuditService audit, ICodeGenerator codes, ICurrentUser current) : ApiController
{
    private IQueryable<Employee> WithRelations => db.Employees
        .Include(e => e.Department).Include(e => e.Role).Include(e => e.Permissions).AsSplitQuery();

    [HttpGet]
    [Authorize(Policy = Perm.EmployeesRead)]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> List(
        [FromQuery] string? department, [FromQuery] string? status, [FromQuery] string? search, CancellationToken ct)
    {
        var query = WithRelations.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(department)) query = query.Where(e => e.Department.Name == department);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumText.TryParse<EmployeeStatus>(status, out var parsed)) return BadRequestDetail($"Unknown status '{status}'.");
            query = query.Where(e => e.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            query = query.Where(e => EF.Functions.ILike(e.Name, pattern) || EF.Functions.ILike(e.Email, pattern) || EF.Functions.ILike(e.Code, pattern));
        }

        var employees = await query.OrderBy(e => e.Code).ToListAsync(ct);
        return employees.Select(e => e.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Perm.EmployeesRead)]
    public async Task<ActionResult<EmployeeDto>> Get(Guid id, CancellationToken ct)
    {
        var employee = await WithRelations.AsNoTracking().SingleOrDefaultAsync(e => e.Id == id, ct);
        return employee is null ? NotFound() : employee.ToDto();
    }

    [HttpPost]
    [Authorize(Policy = Perm.EmployeesWrite)]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeRequest request, CancellationToken ct)
    {
        if (PasswordPolicy.Check(request.InitialPassword) is { } passwordProblem) return BadRequestDetail(passwordProblem);

        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Employees.AnyAsync(e => e.Email == email, ct)) return ConflictDetail($"An employee with email '{email}' already exists.");

        var department = await db.Departments.SingleOrDefaultAsync(d => d.Name == request.Department, ct);
        if (department is null) return BadRequestDetail($"Unknown department '{request.Department}'.");

        var role = await db.Roles.Include(r => r.DefaultPermissions).SingleOrDefaultAsync(r => r.Name == request.Role, ct);
        if (role is null) return BadRequestDetail($"Unknown role '{request.Role}'.");

        if (request.ManagerId is { } managerId && !await db.Employees.AnyAsync(e => e.Id == managerId, ct))
            return BadRequestDetail("Manager not found.");

        var permissionIds = (request.Permissions ?? role.DefaultPermissions.Select(p => p.Id).ToList()).Distinct().ToList();
        var permissions = await db.Permissions.Where(p => permissionIds.Contains(p.Id)).ToListAsync(ct);
        if (permissions.Count != permissionIds.Count) return BadRequestDetail("One or more permissions do not exist.");
        if (CannotGrant(permissionIds)) return ForbidDetail("You can only grant permissions that you hold yourself.");

        var employee = new Employee
        {
            Code = await codes.NextAsync(CodeKind.Employee, ct),
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.InitialPassword),
            Phone = request.Phone?.Trim() ?? "",
            AvatarUrl = request.Avatar?.Trim() ?? "",
            Department = department,
            Role = role,
            Title = request.Title.Trim(),
            JoinDate = request.JoinDate,
            Location = request.Location?.Trim() ?? "",
            ManagerId = request.ManagerId,
            Permissions = permissions,
        };
        db.Employees.Add(employee);

        audit.Record(AuditAction.Created, AuditEntityType.Employee, employee.Id, AuditService.Label("Employee", employee.Code),
            "N/A", $"{employee.Name} ({role.Name} - {department.Name})", $"Added by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return CreatedAtAction(nameof(Get), new { id = employee.Id }, employee.ToDto());
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Perm.EmployeesWrite)]
    public async Task<ActionResult<EmployeeDto>> Update(Guid id, UpdateEmployeeRequest request, CancellationToken ct)
    {
        var employee = await WithRelations.SingleOrDefaultAsync(e => e.Id == id, ct);
        if (employee is null) return NotFound();

        var changes = new List<(string Field, string Old, string New)>();

        if (request.Name is not null && request.Name.Trim() != employee.Name)
        {
            changes.Add(("Name", employee.Name, request.Name.Trim()));
            employee.Name = request.Name.Trim();
        }
        if (request.Phone is not null && request.Phone.Trim() != employee.Phone)
        {
            changes.Add(("Phone", employee.Phone, request.Phone.Trim()));
            employee.Phone = request.Phone.Trim();
        }
        if (request.Avatar is not null) employee.AvatarUrl = request.Avatar.Trim();
        if (request.Title is not null && request.Title.Trim() != employee.Title)
        {
            changes.Add(("Title", employee.Title, request.Title.Trim()));
            employee.Title = request.Title.Trim();
        }
        if (request.Location is not null && request.Location.Trim() != employee.Location)
        {
            changes.Add(("Location", employee.Location, request.Location.Trim()));
            employee.Location = request.Location.Trim();
        }
        if (request.Status is { } status && status != employee.Status)
        {
            changes.Add(("Status", employee.Status.ToText(), status.ToText()));
            employee.Status = status;
        }
        if (request.Role is not null && request.Role != employee.Role.Name)
        {
            var role = await db.Roles.SingleOrDefaultAsync(r => r.Name == request.Role, ct);
            if (role is null) return BadRequestDetail($"Unknown role '{request.Role}'.");
            changes.Add(("Role", employee.Role.Name, role.Name));
            employee.Role = role;
        }
        if (request.Department is not null && request.Department != employee.Department.Name)
        {
            var department = await db.Departments.SingleOrDefaultAsync(d => d.Name == request.Department, ct);
            if (department is null) return BadRequestDetail($"Unknown department '{request.Department}'.");
            changes.Add(("Department", employee.Department.Name, department.Name));
            employee.Department = department;
        }
        if (request.ManagerId is { } managerId && managerId != employee.ManagerId)
        {
            if (managerId == employee.Id) return BadRequestDetail("An employee cannot be their own manager.");
            if (!await db.Employees.AnyAsync(e => e.Id == managerId, ct)) return BadRequestDetail("Manager not found.");
            changes.Add(("Manager", employee.ManagerId?.ToString() ?? "none", managerId.ToString()));
            employee.ManagerId = managerId;
        }
        if (request.Permissions is not null)
        {
            var wanted = request.Permissions.Distinct().ToList();
            var currentIds = employee.Permissions.Select(p => p.Id).ToHashSet();
            var permissions = await db.Permissions.Where(p => wanted.Contains(p.Id)).ToListAsync(ct);
            if (permissions.Count != wanted.Count) return BadRequestDetail("One or more permissions do not exist.");

            var changed = wanted.Except(currentIds).Concat(currentIds.Except(wanted)).ToList();
            if (changed.Count > 0)
            {
                if (CannotGrant(changed)) return ForbidDetail("You can only grant or revoke permissions that you hold yourself.");
                changes.Add(("Permissions", string.Join(", ", currentIds.Order()), string.Join(", ", wanted.Order())));
                employee.Permissions = permissions;
            }
        }

        if (changes.Count > 0)
        {
            audit.Record(AuditAction.Updated, AuditEntityType.Employee, employee.Id, AuditService.Label("Employee", employee.Code),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.Old}")),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.New}")),
                $"Updated by {current.Name}");
        }

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return employee.ToDto();
    }

    /// <summary>
    /// Stops someone with only emp_write (e.g. HR) from promoting themselves or a friend to admin:
    /// unless the caller is a system admin, every permission they touch must be one they hold.
    /// </summary>
    private bool CannotGrant(IEnumerable<string> permissionIds) =>
        !current.Has(Perm.SysAdmin) && permissionIds.Any(p => !current.Has(p));
}
