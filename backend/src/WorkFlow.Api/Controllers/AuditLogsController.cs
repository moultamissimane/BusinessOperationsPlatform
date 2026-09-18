using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Api.Common;
using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;
using WorkFlow.Api.Dtos;

namespace WorkFlow.Api.Controllers;

/// <summary>Read-only by design: the audit trail has no create, update or delete endpoint.</summary>
[Route("api/audit-logs")]
[Authorize(Policy = Perm.AuditView)]
public class AuditLogsController(AppDbContext db) : ApiController
{
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> List(
        [FromQuery] string? entityType, [FromQuery] string? action, [FromQuery] Guid? userId,
        [FromQuery] Guid? entityId, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (page < 1) return BadRequestDetail("page must be 1 or greater.");
        if (pageSize is < 1 or > MaxPageSize) return BadRequestDetail($"pageSize must be between 1 and {MaxPageSize}.");

        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            if (!EnumText.TryParse<AuditEntityType>(entityType, out var parsed)) return BadRequestDetail($"Unknown entity type '{entityType}'.");
            query = query.Where(a => a.EntityType == parsed);
        }
        if (!string.IsNullOrWhiteSpace(action))
        {
            if (!EnumText.TryParse<AuditAction>(action, out var parsed)) return BadRequestDetail($"Unknown action '{action}'.");
            query = query.Where(a => a.Action == parsed);
        }
        if (userId is { } uid) query = query.Where(a => a.UserId == uid);
        if (entityId is { } eid) query = query.Where(a => a.EntityId == eid);
        if (from is { } f) query = query.Where(a => a.Timestamp >= f.ToUniversalTime());
        if (to is { } t) query = query.Where(a => a.Timestamp <= t.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            query = query.Where(a => EF.Functions.ILike(a.UserName, pattern) || EF.Functions.ILike(a.Entity, pattern) ||
                                     EF.Functions.ILike(a.OldValue, pattern) || EF.Functions.ILike(a.NewValue, pattern));
        }

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(a => a.Timestamp).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PagedResult<AuditLogDto>(rows.Select(a => a.ToDto()).ToList(), total, page, pageSize);
    }
}
