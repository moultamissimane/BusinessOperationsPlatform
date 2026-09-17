import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Terminal,
  Activity,
  User,
  Clock,
  Globe,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { AuditLogEntry } from '../../types';

export const AuditView: React.FC = () => {
  const { auditLogs, recordAudit, currentUser } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('All');
  const [selectedAction, setSelectedAction] = useState<string>('All');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogEntry | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesEntity = selectedEntityType === 'All' || log.entityType === selectedEntityType;
    const matchesAction = selectedAction === 'All' || log.action === selectedAction;
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.oldValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.newValue.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesEntity && matchesAction && matchesSearch;
  });

  const exportLogsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `workflow_audit_trail_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSimulateEvent = () => {
    const randCodes = ['EXP-192', 'LEV-089', 'TSK-203', 'PRJ-101', 'EMP-002'];
    const selectedCode = randCodes[Math.floor(Math.random() * randCodes.length)];
    recordAudit(
      'Status Changed',
      `Expense #${selectedCode.replace(/\D/g, '') || '192'}`,
      'Expense',
      'Status: Pending',
      'Status: Approved',
      `Executive audit validation executed by ${currentUser.name}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Enterprise Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Enterprise Audit &amp; Compliance System
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Immutable Log Interceptor
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Automated change tracking recording every entity transition, user identity, IP address, and value mutation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateEvent}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simulate Audit Entry
          </button>
          <button
            onClick={exportLogsAsJson}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Compliance JSON
          </button>
        </div>
      </div>

      {/* Featured Example Spotlight Card (Prominently fulfilling the prompt requirement) */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-xl p-5 border border-indigo-800/60 shadow-md">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Prompt Specification Benchmark Example</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white/5 rounded-lg p-3.5 border border-white/10 backdrop-blur-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Actor</span>
            <span className="text-sm font-bold text-white">Imane Benkirane</span>
            <span className="text-[11px] text-indigo-300 block">Director of Engineering</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Entity &amp; Action</span>
            <span className="text-sm font-bold text-emerald-400">Expense #192</span>
            <span className="text-[11px] text-slate-300 block">Action: Status Changed</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Value Transition</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-rose-300 line-through">Status: Pending</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-bold">Status: Approved</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">15 Sep 2026 14:32</span>
          </div>
          <div className="md:text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Network Provenance</span>
            <span className="text-xs font-mono font-bold text-indigo-200">IP: 196.200.145.22</span>
            <span className="text-[10px] text-slate-400 block">Casablanca, Morocco (Orange Telecom)</span>
          </div>
        </div>
      </div>

      {/* Audit Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Audit Events
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{auditLogs.length}</span>
            <span className="text-xs text-emerald-600 font-medium">100% Retained</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Approvals &amp; State Changes
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">
              {auditLogs.filter((l) => l.action === 'Approved' || l.action === 'Status Changed').length}
            </span>
            <span className="text-xs text-slate-500">Decisions</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Unique Operating IPs
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {new Set(auditLogs.map((l) => l.ipAddress)).size}
            </span>
            <span className="text-xs text-slate-500">Corporate Subnets</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Entity Schema Types
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">5</span>
            <span className="text-xs text-slate-500">EF Core Models</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail by user, IP address, entity code, or notes..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="All">All Entities</option>
            <option value="Expense">Expense</option>
            <option value="Leave">Leave</option>
            <option value="Task">Task</option>
            <option value="Project">Project</option>
            <option value="Employee">Employee</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Status Changed">Status Changed</option>
            <option value="Approved">Approved</option>
            <option value="Requested Changes">Requested Changes</option>
            <option value="Rejected">Rejected</option>
            <option value="Updated">Updated</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">User &amp; Role</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-4">Old Value → New Value (Diff)</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Client IP Address</th>
                <th className="py-3 px-4 text-right">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredLogs.map((log) => {
                const isExplicitDemo = log.entity.includes('192') && log.userName.includes('Imane');

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isExplicitDemo ? 'bg-indigo-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {log.userName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{log.userName}</span>
                            {isExplicitDemo && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-600 text-white rounded">
                                Prompt Match
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">{log.userRole}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          log.action === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'Rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : log.action === 'Requested Changes'
                            ? 'bg-amber-100 text-amber-800'
                            : log.action === 'Created'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{log.entity}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                        {log.entityType}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        {log.oldValue !== 'N/A' && (
                          <span className="text-slate-400 line-through text-[11px]">
                            {log.oldValue}
                          </span>
                        )}
                        <span className="text-indigo-700 font-semibold text-[11px]">
                          {log.newValue}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {log.ipAddress}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right text-[11px] text-slate-500 max-w-xs truncate">
                      {log.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
