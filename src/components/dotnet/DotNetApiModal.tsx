import React, { useState } from 'react';
import { X, Code2, Server, Database, ShieldCheck, Copy, Check } from 'lucide-react';

interface DotNetApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DotNetApiModal: React.FC<DotNetApiModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'controllers' | 'efcore' | 'dto' | 'architecture'>('controllers');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const controllerCode = `// WorkFlow ERP — ASP.NET Core 9 Web API
// Controllers/ExpensesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkFlow.Domain.Entities;
using WorkFlow.Infrastructure.Data;

namespace WorkFlow.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ExpensesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ICurrentUserService _currentUser;

    public ExpensesController(ApplicationDbContext context, IAuditService auditService, ICurrentUserService currentUser)
    {
        _context = context;
        _auditService = auditService;
        _currentUser = currentUser;
    }

    // GET: api/v1/expenses
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExpenseDto>>> GetExpenses([FromQuery] string? status, [FromQuery] string? category)
    {
        var query = _context.Expenses.Include(e => e.Employee).AsNoTracking();
        if (!string.IsNullOrEmpty(status)) query = query.Where(e => e.Status == status);
        return Ok(await query.OrderByDescending(e => e.SubmittedAt).ToListAsync());
    }

    // PATCH: api/v1/expenses/{id}/status
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Director,DepartmentManager,Administrator")]
    public async Task<IActionResult> UpdateExpenseStatus(Guid id, [FromBody] UpdateExpenseStatusRequest request)
    {
        var expense = await _context.Expenses.FindAsync(id);
        if (expense == null) return NotFound();

        var oldStatus = expense.Status;
        expense.Status = request.NewStatus;
        expense.ReviewedBy = _currentUser.FullName;
        expense.ReviewedAt = DateTime.UtcNow;
        expense.ManagerNotes = request.Notes;

        // Enterprise Audit Trail Interceptor
        await _auditService.LogAsync(new AuditLogEntry
        {
            UserId = _currentUser.UserId,
            UserName = _currentUser.FullName,
            Action = request.NewStatus == "Approved" ? AuditAction.Approved : AuditAction.StatusChanged,
            Entity = $"Expense #{expense.Code}",
            EntityType = EntityType.Expense,
            OldValue = $"Status: {oldStatus}",
            NewValue = $"Status: {request.NewStatus}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            Timestamp = DateTime.UtcNow,
            Notes = request.Notes
        });

        await _context.SaveChangesAsync();
        return Ok(expense);
    }
}`;

  const efCoreCode = `// Infrastructure/Data/ApplicationDbContext.cs
using Microsoft.EntityFrameworkCore;
using WorkFlow.Domain.Entities;

namespace WorkFlow.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // PostgreSQL UUID and JSONB configuration
        modelBuilder.Entity<Expense>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.Code).HasMaxLength(32).IsRequired();
            b.Property(e => e.Amount).HasPrecision(18, 2);
            b.HasIndex(e => e.Code).IsUnique();
            b.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
        });

        modelBuilder.Entity<AuditLog>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.IpAddress).HasMaxLength(45);
            b.HasIndex(a => a.Timestamp);
        });
    }
}`;

  const dtoCode = `// Application/Common/DTOs/ExpenseDtos.cs
namespace WorkFlow.Application.Common.DTOs;

public record ExpenseDto(
    Guid Id,
    string Code,
    Guid EmployeeId,
    string EmployeeName,
    string Title,
    decimal Amount,
    string Currency,
    string Category,
    DateOnly Date,
    string? ReceiptUrl,
    string Status,
    DateTime SubmittedAt,
    string? ReviewedBy,
    string? ManagerNotes
);

public record UpdateExpenseStatusRequest(
    string NewStatus, // "Approved" | "Rejected" | "Changes Requested"
    string? Notes
);

public record CreateLeaveRequestDto(
    Guid EmployeeId,
    string LeaveType, // Annual, Sick, Exceptional
    DateOnly StartDate,
    DateOnly EndDate,
    int DaysCount,
    string Reason,
    string? ExceptionalSubtype
);`;

  const architectureInfo = `WorkFlow ERP — Enterprise Microsoft .NET Ecosystem Architecture:

1. Backend Technology Stack:
   • .NET 9.0 (ASP.NET Core Web API)
   • Entity Framework Core 9 (PostgreSQL via Npgsql.EntityFrameworkCore.PostgreSQL)
   • FluentValidation & MediatR (CQRS pattern)
   • Serilog with Elasticsearch/Seq structured logging
   • Microsoft.AspNetCore.Authentication.JwtBearer

2. Production Infrastructure:
   • Multi-stage Dockerfile (SDK build -> distroless/runtime-deps container)
   • PostgreSQL 16 hosted on Azure Database for PostgreSQL (Flexible Server)
   • Azure Container Apps with Managed Identity
   • GitHub Actions CI/CD pipeline (dotnet test, SonarQube quality gate, Docker push)

3. API Contracts:
   • RESTful endpoints matching the React Frontend services
   • Strict audit interceptor logging every state transition with client IP & user identity`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              .NET
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-900">ASP.NET Core 9 Web API Specification</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                  .NET 9 + EF Core
                </span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full-stack C# backend contracts & database architecture integrated with this React frontend
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-white gap-2 text-xs font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('controllers')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'controllers'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Controllers & Endpoints
          </button>
          <button
            onClick={() => setActiveTab('efcore')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'efcore'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            EF Core & DbContext
          </button>
          <button
            onClick={() => setActiveTab('dto')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'dto'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            C# DTOs & Records
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'architecture'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Enterprise Deployment (Azure / Docker)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900 text-slate-100 font-mono text-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-400">
              {activeTab === 'controllers' && 'ExpensesController.cs — Status & Audit Dispatch'}
              {activeTab === 'efcore' && 'ApplicationDbContext.cs — PostgreSQL Mapping'}
              {activeTab === 'dto' && 'ExpenseDtos.cs — Strongly-Typed Contracts'}
              {activeTab === 'architecture' && 'WorkFlow.Architecture.md'}
            </span>
            <button
              onClick={() => {
                const text =
                  activeTab === 'controllers'
                    ? controllerCode
                    : activeTab === 'efcore'
                    ? efCoreCode
                    : activeTab === 'dto'
                    ? dtoCode
                    : architectureInfo;
                copyCode(text);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-lg overflow-x-auto text-slate-200 border border-slate-800 leading-relaxed">
            {activeTab === 'controllers' && controllerCode}
            {activeTab === 'efcore' && efCoreCode}
            {activeTab === 'dto' && dtoCode}
            {activeTab === 'architecture' && architectureInfo}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>REST API Endpoint status: Mock connected with live C# spec synchronization</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
