import React from 'react';
import {
  Users,
  Briefcase,
  CalendarDays,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  Calendar,
  Layers,
  ChevronRight,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { Expense, LeaveRequest } from '../../types';

interface DashboardViewProps {
  onNavigate: (nav: string) => void;
  onOpenReviewExpense?: (exp: Expense) => void;
  onOpenReviewLeave?: (leave: LeaveRequest) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenReviewExpense,
  onOpenReviewLeave,
}) => {
  const {
    employees,
    projects,
    tasks,
    leaves,
    expenses,
    auditLogs,
    currentUser,
    reviewExpense,
    reviewLeave,
    currency,
  } = useErp();

  // Metrics computation
  const activeEmployees = employees.filter((e) => e.status === 'Active').length;
  const onLeaveEmployees = employees.filter((e) => e.status === 'On Leave').length;

  const pendingLeaves = leaves.filter((l) => l.status === 'Pending');
  const pendingExpenses = expenses.filter((e) => e.status === 'Pending');
  const totalPendingRequests = pendingLeaves.length + pendingExpenses.length;

  const totalApprovedExpenses = expenses
    .filter((e) => e.status === 'Approved')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingExpensesAmount = pendingExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const activeProjects = projects.filter((p) => p.status === 'In Progress');
  const completedProjects = projects.filter((p) => p.status === 'Completed');

  const openTasks = tasks.filter((t) => t.status !== 'Completed');
  const criticalTasks = tasks.filter((t) => t.priority === 'Critical' || t.priority === 'High');

  // Upcoming deadlines sorted
  const upcomingTasks = [...tasks]
    .filter((t) => t.status !== 'Completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const recentAudits = auditLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner: Role Context */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                WorkFlow Operations Cockpit
              </span>
              <span className="text-xs text-slate-400">
                Live ASP.NET Core 9 / EF Core Sync
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Welcome back, {currentUser.name}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              {currentUser.isManager
                ? `You are in Executive Manager mode. You have ${totalPendingRequests} items requiring decision (Leaves & Expenses), across ${activeProjects.length} active initiatives.`
                : `You are in Contributor mode (${currentUser.role}). Review your assigned milestones, submitted claims, and leave allocations.`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('leaves')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium backdrop-blur-xs transition-colors"
            >
              Request Leave
            </button>
            <button
              onClick={() => onNavigate('expenses')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Submit Expense Claim
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Employees */}
        <div
          onClick={() => onNavigate('employees')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Workforce
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{employees.length}</span>
            <span className="text-xs text-emerald-600 font-medium">
              {activeEmployees} Active
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{onLeaveEmployees} currently on approved leave</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </div>
        </div>

        {/* Card 2: Pending Requests */}
        <div
          onClick={() => (pendingLeaves.length > 0 ? onNavigate('leaves') : onNavigate('expenses'))}
          className={`bg-white rounded-xl p-5 border shadow-xs transition-all cursor-pointer group ${
            totalPendingRequests > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{totalPendingRequests}</span>
            <span className="text-xs text-slate-500">
              Needs Manager Action
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{pendingLeaves.length} leaves • {pendingExpenses.length} expenses</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
          </div>
        </div>

        {/* Card 3: Expenses */}
        <div
          onClick={() => onNavigate('expenses')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved Expenses
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {totalApprovedExpenses.toLocaleString()} {currency}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{pendingExpensesAmount.toLocaleString()} {currency} pending audit</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
          </div>
        </div>

        {/* Card 4: Active Projects */}
        <div
          onClick={() => onNavigate('projects')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Projects & Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{activeProjects.length}</span>
            <span className="text-xs text-indigo-600 font-medium">
              {openTasks.length} open tasks
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{criticalTasks.length} high/critical priority</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Approval Queue & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Manager Quick Decision Queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Manager Action Items — Pending Approvals
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Approve, reject, or request adjustments on submitted staff records
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {totalPendingRequests} Queue Items
            </span>
          </div>

          {totalPendingRequests === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-800">Inbox Zero!</p>
              <p className="text-xs text-slate-500 mt-1">All employee leave and expense claims are settled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending Leaves */}
              {pendingLeaves.map((leave) => {
                const emp = employees.find((e) => e.id === leave.employeeId);
                return (
                  <div
                    key={leave.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{emp?.name || 'Staff'}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {leave.leaveType}
                          </span>
                          <span className="text-xs text-slate-400">• {leave.daysCount} days</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          <span className="font-medium text-slate-700">{leave.startDate} to {leave.endDate}</span>: {leave.reason}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Submitted {leave.submittedAt} • Code: {leave.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => reviewLeave(leave.id, 'Approved', 'Approved via manager dashboard')}
                        className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => reviewLeave(leave.id, 'Rejected', 'Declined per current department bandwidth')}
                        className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pending Expenses */}
              {pendingExpenses.map((exp) => {
                const emp = employees.find((e) => e.id === exp.employeeId);
                return (
                  <div
                    key={exp.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{emp?.name || 'Staff'}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            {exp.category}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {exp.amount.toLocaleString()} {exp.currency}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{exp.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">
                            Date: {exp.date} • Code: {exp.code}
                          </span>
                          {exp.receiptFileName && (
                            <span className="text-[10px] text-indigo-600 flex items-center gap-0.5 font-medium">
                              <FileText className="w-2.5 h-2.5" />
                              {exp.receiptFileName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => reviewExpense(exp.id, 'Approved', 'Approved in executive queue')}
                        className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          reviewExpense(exp.id, 'Changes Requested', 'Please supply invoice with tax identification number')
                        }
                        className="px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-medium transition-colors"
                      >
                        Req. Changes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Urgent Deadlines Radar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Upcoming Deadlines
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Project milestones & critical tasks</p>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs text-indigo-600 font-medium hover:underline flex items-center"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {upcomingTasks.map((task) => {
                const assigned = employees.find((e) => e.id === task.assignedToId);
                const project = projects.find((p) => p.id === task.projectId);
                return (
                  <div key={task.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 line-clamp-1">{task.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          task.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : task.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{project?.name || 'Project'}</span>
                      <span className="font-semibold text-slate-700">Due {task.deadline}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <img src={assigned?.avatar} className="w-3.5 h-3.5 rounded-full object-cover" />
                      <span>{assigned?.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs text-indigo-900">
            <span className="font-bold block mb-0.5">Projects Delivery Status</span>
            <div className="space-y-1.5 mt-2">
              {projects.slice(0, 2).map((p) => (
                <div key={p.id}>
                  <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                    <span className="font-medium truncate">{p.name}</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="w-full bg-indigo-200/50 rounded-full h-1.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      style={{ width: `${p.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Audit Trail Banner (Direct Reference to Prompt Requirement) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Live Enterprise Audit Trail
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                ISO / SOC-2 Compliance
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Every state change, approval, and task edit is immutably logged with user, IP address, and value diffs.
            </p>
          </div>
          <button
            onClick={() => onNavigate('audit')}
            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
          >
            Open Full Audit System <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2 px-3">User & Identity</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Entity</th>
                <th className="py-2 px-3">Value Transition</th>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3 text-right">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAudits.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                        {log.userName.charAt(0)}
                      </div>
                      <div>
                        <span>{log.userName}</span>
                        <span className="block text-[10px] text-slate-400">{log.userRole}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        log.action === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'Rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : log.action === 'Requested Changes'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{log.entity}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-slate-400 line-through text-[11px] mr-1.5">{log.oldValue}</span>
                    <span className="text-indigo-600 font-semibold text-[11px]">→ {log.newValue}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
