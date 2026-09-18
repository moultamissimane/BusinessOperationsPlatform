using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Controllers;

[Route("api/tasks")]
public class TasksController(AppDbContext db, IAuditService audit, ICodeGenerator codes, ICurrentUser current, TimeProvider clock) : ApiController
{
    [HttpGet]
    [Authorize(Policy = Perm.ProjectsRead)]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> List(
        [FromQuery] Guid? projectId, [FromQuery] Guid? assignedToId, [FromQuery] string? status, CancellationToken ct)
    {
        var query = db.Tasks.AsNoTracking();
        if (projectId is { } pid) query = query.Where(t => t.ProjectId == pid);
        if (assignedToId is { } aid) query = query.Where(t => t.AssignedToId == aid);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumText.TryParse<TaskItemStatus>(status, out var parsed)) return BadRequestDetail($"Unknown status '{status}'.");
            query = query.Where(t => t.Status == parsed);
        }
        var tasks = await query.OrderBy(t => t.Deadline).ThenBy(t => t.Code).ToListAsync(ct);
        return tasks.Select(t => t.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Perm.ProjectsRead)]
    public async Task<ActionResult<TaskDto>> Get(Guid id, CancellationToken ct)
    {
        var task = await db.Tasks.AsNoTracking().SingleOrDefaultAsync(t => t.Id == id, ct);
        return task is null ? NotFound() : task.ToDto();
    }

    [HttpPost]
    [Authorize(Policy = Perm.TasksManage)]
    public async Task<ActionResult<TaskDto>> Create(CreateTaskRequest request, CancellationToken ct)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct)) return BadRequestDetail("Project not found.");
        if (!await db.Employees.AnyAsync(e => e.Id == request.AssignedToId && e.Status != EmployeeStatus.Terminated, ct))
            return BadRequestDetail("Assignee not found or no longer active.");

        var task = new TaskItem
        {
            Code = await codes.NextAsync(CodeKind.Task, ct),
            ProjectId = request.ProjectId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? "",
            AssignedToId = request.AssignedToId,
            Priority = request.Priority,
            Status = TaskItemStatus.Backlog,
            Deadline = request.Deadline,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        db.Tasks.Add(task);

        audit.Record(AuditAction.Created, AuditEntityType.Task, task.Id, AuditService.Label("Task", task.Code),
            "N/A", $"Title: \"{task.Title}\" (Priority: {task.Priority.ToText()})", $"Created by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return CreatedAtAction(nameof(Get), new { id = task.Id }, task.ToDto());
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Perm.TasksManage)]
    public async Task<ActionResult<TaskDto>> Update(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        var task = await db.Tasks.SingleOrDefaultAsync(t => t.Id == id, ct);
        if (task is null) return NotFound();

        var changes = new List<(string Field, string Old, string New)>();

        if (request.Title is not null && request.Title.Trim() != task.Title) { changes.Add(("Title", task.Title, request.Title.Trim())); task.Title = request.Title.Trim(); }
        if (request.Description is not null) task.Description = request.Description.Trim();
        if (request.Priority is { } priority && priority != task.Priority) { changes.Add(("Priority", task.Priority.ToText(), priority.ToText())); task.Priority = priority; }
        if (request.Deadline is { } deadline && deadline != task.Deadline) { changes.Add(("Deadline", $"{task.Deadline:yyyy-MM-dd}", $"{deadline:yyyy-MM-dd}")); task.Deadline = deadline; }
        if (request.AssignedToId is { } assignee && assignee != task.AssignedToId)
        {
            if (!await db.Employees.AnyAsync(e => e.Id == assignee && e.Status != EmployeeStatus.Terminated, ct))
                return BadRequestDetail("Assignee not found or no longer active.");
            changes.Add(("Assignee", task.AssignedToId.ToString(), assignee.ToString()));
            task.AssignedToId = assignee;
        }

        if (changes.Count > 0)
        {
            audit.Record(AuditAction.Updated, AuditEntityType.Task, task.Id, AuditService.Label("Task", task.Code),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.Old}")),
                string.Join("; ", changes.Select(c => $"{c.Field}: {c.New}")),
                $"Updated by {current.Name}");
        }

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return task.ToDto();
    }

    /// <summary>The assignee can move their own task along the board; anyone else needs tsk_manage.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<TaskDto>> UpdateStatus(Guid id, UpdateTaskStatusRequest request, CancellationToken ct)
    {
        var task = await db.Tasks.SingleOrDefaultAsync(t => t.Id == id, ct);
        if (task is null) return NotFound();

        if (task.AssignedToId != current.Id && !current.Has(Perm.TasksManage))
            return ForbidDetail("Only the assignee or a task manager can change this task's status.");

        if (task.Status == request.Status) return task.ToDto();

        var oldStatus = task.Status;
        task.Status = request.Status;

        audit.Record(AuditAction.StatusChanged, AuditEntityType.Task, task.Id, AuditService.Label("Task", task.Code),
            $"Status: {oldStatus.ToText()}", $"Status: {task.Status.ToText()}", $"Updated by {current.Name}");

        if (await TrySaveAsync(db, ct) is { } failure) return failure;
        return task.ToDto();
    }
}
