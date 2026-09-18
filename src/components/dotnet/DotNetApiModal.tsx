import React, { useState } from 'react';
import { X, Server, Database, ShieldCheck, Cloud, ExternalLink } from 'lucide-react';

interface DotNetApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'endpoints' | 'security' | 'data' | 'deploy';

// Kept in step with backend/README.md and the controllers under backend/src/WorkFlow.Api/Controllers.
const ENDPOINTS: { area: string; route: string; needs: string }[] = [
  { area: 'Auth', route: 'POST /api/auth/login · refresh · logout · change-password · forgot-password · reset-password, GET /me', needs: 'public / signed in' },
  { area: 'Employees', route: 'GET, POST /api/employees · GET, PUT /api/employees/{id}', needs: 'emp_read / emp_write' },
  { area: 'Lookups', route: 'GET /api/departments, /roles, /permissions · POST departments, roles', needs: 'signed in / sys_admin' },
  { area: 'Projects', route: 'GET, POST /api/projects · GET, PUT /api/projects/{id}', needs: 'prj_read / prj_write' },
  { area: 'Tasks', route: 'GET, POST /api/tasks · GET, PUT /api/tasks/{id} · PATCH /{id}/status', needs: 'prj_read / tsk_manage (assignee may move own task)' },
  { area: 'Leave', route: 'GET, POST /api/leaves · GET /{id} · GET /balance · POST /{id}/review', needs: 'lev_request / lev_approve' },
  { area: 'Expenses', route: 'GET, POST /api/expenses · PUT /{id} · POST /{id}/review · POST, GET /{id}/receipt', needs: 'exp_submit / exp_approve' },
  { area: 'Dashboard', route: 'GET /api/dashboard', needs: 'signed in (managers: organisation; others: own data)' },
  { area: 'Audit', route: 'GET /api/audit-logs (filters, paging) — read-only', needs: 'aud_view' },
];

const SECTIONS: Record<Exclude<Tab, 'endpoints'>, { title: string; items: string[] }> = {
  security: {
    title: 'Authentication & authorization',
    items: [
      'JWT access tokens (15 min) plus single-use rotating refresh tokens (7 days). Only a SHA-256 hash of each refresh token is stored; replaying a spent token revokes the whole session.',
      'One authorization policy per permission (emp_read, exp_approve, sys_admin…). Permissions are re-read from the database on every refresh, so role changes take effect within minutes.',
      'Separation of duties: nobody can review their own leave request or expense; each request can be reviewed exactly once (concurrent reviews are caught with PostgreSQL xmin row versions).',
      'No self-promotion: without sys_admin you can only grant or revoke permissions you hold yourself.',
      'Passwords hashed with BCrypt; login, refresh and password-reset endpoints are rate limited; unknown emails and wrong passwords are indistinguishable.',
      'Receipts: PDF/PNG/JPEG up to 5 MB, content-sniffed, stored under a generated key and served only to the owner and approvers.',
    ],
  },
  data: {
    title: 'Data model & audit trail',
    items: [
      'PostgreSQL via EF Core 8 migrations: Employees, Departments, Roles, Permissions, Projects (with members), Tasks, LeaveRequests, Expenses, AuditLogs, RefreshTokens, PasswordResetTokens.',
      'Human-readable codes (EMP-007, EXP-197…) come from PostgreSQL sequences, so concurrent inserts never collide.',
      'Every create / update / status change writes an AuditLog row — user, role, action, entity, old → new value, UTC timestamp, client IP — in the same transaction as the change.',
      'The audit table has no update or delete endpoint. Behind a proxy, set ForwardedHeaders__TrustAllProxies=true only if the API is reachable solely through it; otherwise clients could spoof the IP that gets recorded.',
      'Annual leave: 18 working days a year (configurable), counted Mon–Fri; the balance is enforced on request. Sick and exceptional leave count calendar days.',
    ],
  },
  deploy: {
    title: 'Docker, CI/CD and Azure',
    items: [
      'docker compose up --build starts PostgreSQL, the API (migrated and seeded) and Mailhog for reset emails.',
      'GitHub Actions: backend-ci.yml builds and runs the integration tests against a real PostgreSQL; deploy-azure.yml builds the image, applies infra/main.bicep and rolls out the API and this frontend.',
      'Azure: Container Apps (API, managed identity), PostgreSQL Flexible Server, Blob Storage for receipts, Static Web Apps for the frontend, Log Analytics for logs.',
      'Secrets (JWT key, database password) are supplied at deploy time — never committed. Seeding must be off in production.',
    ],
  },
};

export const DotNetApiModal: React.FC<DotNetApiModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('endpoints');
  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'endpoints', label: 'Endpoints', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Security', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'data', label: 'Data & Audit', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'deploy', label: 'Deployment', icon: <Cloud className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">.NET</div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-900">ASP.NET Core 8 Web API</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">EF Core 8</span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">PostgreSQL</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">The live backend behind this app. Full interactive reference: Swagger UI at /swagger.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center px-6 border-b border-slate-200 bg-white gap-2 text-xs font-medium text-slate-600">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === t.id ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-900'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-xs text-slate-700">
          {activeTab === 'endpoints' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Area</th>
                  <th className="py-2 pr-3 font-semibold">Routes</th>
                  <th className="py-2 font-semibold">Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ENDPOINTS.map((e) => (
                  <tr key={e.area}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap align-top">{e.area}</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] align-top">{e.route}</td>
                    <td className="py-2.5 align-top text-slate-600">{e.needs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-3">{SECTIONS[activeTab].title}</h4>
              <ul className="space-y-2.5 list-disc pl-5 leading-relaxed">
                {SECTIONS[activeTab].items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <a href="/swagger" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            Open Swagger UI
          </a>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
