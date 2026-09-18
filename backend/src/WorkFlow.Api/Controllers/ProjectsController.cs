using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/projects")]
public class ProjectsController(AppDbContext db, IAuditService audit, ICodeGenerator codes, ICurrentUser current) : ApiController
{
    private IQueryable<Project> WithRelations => db.Projects.Include(p => p.Department).Include(p => p.Team).AsSplitQuery();

    [HttpGet]
    [Authorize(Policy = Perm.ProjectsRead)]
    public async Task<ActionResult<IReadOnlyList<ProjectDto>>> List([FromQuery] string? status, CancellationToken ct)
    {
        var query = WithRelations.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumText.TryParse<ProjectStatus>(status, out var parsed)) return BadRequestDetail($"Unknown status '{status}'.");
            query = query.Where(p => p.Status == parsed);
        }
        var projects = await query.OrderBy(p => p.Code).ToListAsync(ct);
        return projects.Select(p => p.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Perm.ProjectsRead)]
    public async Task<ActionResult<ProjectDto>> Get(Guid id, CancellationToken ct)
    {
        var project = await WithRelations.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
        return project is null ? NotFound() : project.ToDto();
    }

    [HttpPost]
    [Authorize(Policy = Perm.ProjectsWrite)]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectRequest request, CancellationToken ct)
    {
        if (request.Deadline < request.StartDate) return BadRequestDetail("Deadline cannot be before the start date.");

        var department = await db.Departments.SingleOrDefaultAsync(d => d.Name == request.Department, ct);
        if (department is null) return BadRequestDetail($"Unknown department '{request.Department}'.");

        // The lead is always part of the team.
        var teamIds = (request.TeamIds ?? []).Append(request.LeadId).Distinct().ToList();
        var team = await db.Employees.Where(e => teamIds.Contains(e.Id)).ToListAsync(ct);
        if (team.Count != teamIds.Count) return BadRequestDetail("One or more team members (or the lead) do not exist.");

        var project = new Project
        {
            Code = await codes.NextAsync(CodeKind.Project, ct),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? "",
            Department = department,
            LeadId = request.LeadId,
            Budget = request.Budget,
            StartDate = request.StartDate,
            Deadline = request.Deadline,
            Status = request.Status ?? ProjectStatus.Planning,
            Team = team,
        };
        db.Projects.Add(project);

        audit.Record(AuditAction.Created, AuditEntityType.Project, project.Id, AuditService.Label("Project", project.Code),
            "N/A", $"{project.Name} (Budget: {project.Budget:0.##} MAD)", $"Project initiated by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return CreatedAtAction(nameof(Get), new { id = project.Id }, project.ToDto());
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Perm.ProjectsWrite)]
    public async Task<ActionResult<ProjectDto>> Update(Guid id, UpdateProjectRequest request, CancellationToken ct)
    {
        var project = await WithRelations.SingleOrDefaultAsync(p => p.Id == id, ct);
        if (project is null) return NotFound();

        var changes = new List<(string Field, string Old, string New)>();

        if (request.Name is not null && request.Name.Trim() != project.Name) { changes.Add(("Name", project.Name, request.Name.Trim())); project.Name = request.Name.Trim(); }
        if (request.Description is not null) project.Description = request.Description.Trim();
        if (request.Budget is { } budget && budget != project.Budget) { changes.Add(("Budget", $"{project.Budget:0.##}", $"{budget:0.##}")); project.Budget = budget; }
        if (request.Spent is { } spent && spent != project.Spent) { changes.Add(("Spent", $"{project.Spent:0.##}", $"{spent:0.##}")); project.Spent = spent; }
        if (request.Progress is { } progress && progress != project.Progress) { changes.Add(("Progress", $"{project.Progress}%", $"{progress}%")); project.Progress = progress; }
        if (request.Status is { } status && status != project.Status) { changes.Add(("Status", project.Status.ToText(), status.ToText())); project.Status = status; }
        if (request.Deadline is { } deadline && deadline != project.Deadline)
        {
            if (deadline < project.StartDate) return BadRequestDetail("Deadline cannot be before the start date.");
            changes.Add(("Deadline", $"{project.Deadline:yyyy-MM-dd}", $"{deadline:yyyy-MM-dd}"));
            project.Deadline = deadline;
        }
        if (request.LeadId is { } leadId && leadId != project.LeadId)
        {
            if (!await db.Employees.AnyAsync(e => e.Id == leadId, ct)) return BadRequestDetail("Lead not found.");
            changes.Add(("Lead", project.LeadId.ToString(), leadId.ToString()));
            project.LeadId = leadId;
        }
        if (request.TeamIds is not null)
        {
            var teamIds = request.TeamIds.Append(project.LeadId).Distinct().ToList();
            var team = await db.Employees.Where(e => teamIds.Contains(e.Id)).ToListAsync(ct);
            if (team.Count != teamIds.Count) return BadRequestDetail("One or more team members do not exist.");
            if (!team.Select(t => t.Id).ToHashSet().SetEquals(project.Team.Select(t => t.Id)))
            {
                changes.Add(("Team size", project.Team.Count.ToString(), team.Count.ToString()));
                project.Team = team;
            }
        }

        if (changes.Count > 0)
        {
            var onlyStatus = changes is [{ Field: "Status" }];
            audit.Record(onlyStatus ? AuditAction.StatusChanged : AuditAction.Updated, AuditEntityType.Project, project.Id,
                AuditService.Label("Project", project.Code),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.Old}")),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.New}")),
                $"Updated by {current.Name}");
        }

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return project.ToDto();
    }
}
