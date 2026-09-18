using WorkFlow.Api.Data;
using WorkFlow.Api.Domain;

namespace WorkFlow.Api.Services;

public interface IAuditService
{
    /// <summary>
    /// Stages an audit row on the current DbContext. It is written by the caller's next SaveChanges,
    /// in the same transaction as the change it describes, so a change can never be saved without its audit entry.
    /// </summary>
    void Record(AuditAction action, AuditEntityType type, Guid entityId, string entity,
        string oldValue, string newValue, string? notes = null);
}

public sealed class AuditService(AppDbContext db, ICurrentUser user, TimeProvider clock) : IAuditService
{
    public void Record(AuditAction action, AuditEntityType type, Guid entityId, string entity,
        string oldValue, string newValue, string? notes = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            UserName = user.Name,
            UserRole = user.Role,
            Action = action,
            EntityType = type,
            EntityId = entityId,
            Entity = entity,
            OldValue = Truncate(oldValue),
            NewValue = Truncate(newValue),
            Timestamp = clock.GetUtcNow().UtcDateTime,
            IpAddress = user.IpAddress,
            Notes = notes is null ? null : Truncate(notes),
        });
    }

    private static string Truncate(string value) => value.Length <= 1000 ? value : value[..997] + "...";

    /// <summary>"EXP-192" becomes "Expense #192", matching how the UI displays entities.</summary>
    public static string Label(string entityName, string code) => $"{entityName} #{code[(code.IndexOf('-') + 1)..]}";
}
