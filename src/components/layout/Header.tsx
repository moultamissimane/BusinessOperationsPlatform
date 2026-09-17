import React, { useState } from 'react';
import {
  Search,
  Bell,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Code,
  Shield,
  Layers,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { CurrentUser } from '../../types';

interface HeaderProps {
  onOpenDotNetModal: () => void;
  activeNav: string;
  onNavigate: (nav: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDotNetModal, activeNav, onNavigate }) => {
  const {
    currentUser,
    setCurrentUser,
    availableUsers,
    expenses,
    leaves,
    resetDemoData,
    currency,
    setCurrency,
  } = useErp();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const pendingLeaves = leaves.filter((l) => l.status === 'Pending');
  const pendingExpenses = expenses.filter((e) => e.status === 'Pending');
  const totalPending = pendingLeaves.length + pendingExpenses.length;

  const handleSelectUser = (u: CurrentUser) => {
    setCurrentUser(u);
    setUserDropdownOpen(false);
  };

  const getBreadcrumbTitle = (nav: string) => {
    switch (nav) {
      case 'dashboard':
        return 'Executive & Operations Dashboard';
      case 'employees':
        return 'Employee Directory & Permissions';
      case 'projects':
        return 'Projects, Tasks & Deadlines';
      case 'leaves':
        return 'Leave Management & Approvals';
      case 'expenses':
        return 'Expense Claims & Reimbursements';
      case 'audit':
        return 'Enterprise Audit Trail & Compliance';
      default:
        return 'Overview';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Breadcrumbs & Context */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>WorkFlow ERP</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold capitalize">{activeNav}</span>
          </div>
          <h1 className="text-sm font-semibold text-slate-900 mt-0.5">
            {getBreadcrumbTitle(activeNav)}
          </h1>
        </div>
      </div>

      {/* Center: System Architecture pill */}
      <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-indigo-600 font-semibold">.NET 9</span>
          <span className="text-slate-400">•</span>
          <span>PostgreSQL</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">Casablanca Region</span>
        </div>
        <button
          onClick={onOpenDotNetModal}
          className="ml-1 text-indigo-600 hover:text-indigo-700 font-medium hover:underline flex items-center gap-0.5 text-xs"
        >
          <Code className="w-3 h-3" />
          API Spec
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Currency Selector */}
        <div className="flex items-center border border-slate-200 rounded-lg p-0.5 text-xs font-medium bg-slate-50">
          {(['MAD', 'USD', 'EUR'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-2 py-1 rounded-md transition-colors ${
                currency === c
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Notifications / Pending Queue Button */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 relative transition-colors"
            title="Pending approvals queue"
          >
            <Bell className="w-4 h-4" />
            {totalPending > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                {totalPending}
              </span>
            )}
          </button>

          {/* Pending Approvals Popover */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-semibold text-slate-900">Manager Approval Queue</span>
                <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {totalPending} pending
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {totalPending === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">All requests approved or resolved!</p>
                ) : (
                  <>
                    {pendingLeaves.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => {
                          onNavigate('leaves');
                          setNotificationsOpen(false);
                        }}
                        className="p-2 bg-slate-50 hover:bg-indigo-50/60 rounded-lg cursor-pointer text-xs border border-slate-100 transition-colors"
                      >
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-0.5">
                          <span className="font-semibold text-indigo-700">{l.code} • Leave</span>
                          <span>{l.daysCount} days</span>
                        </div>
                        <p className="font-medium text-slate-800 line-clamp-1">{l.reason}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{l.submittedAt}</span>
                      </div>
                    ))}
                    {pendingExpenses.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => {
                          onNavigate('expenses');
                          setNotificationsOpen(false);
                        }}
                        className="p-2 bg-slate-50 hover:bg-amber-50/60 rounded-lg cursor-pointer text-xs border border-slate-100 transition-colors"
                      >
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-0.5">
                          <span className="font-semibold text-amber-700">{e.code} • Expense</span>
                          <span className="font-bold text-slate-800">{e.amount.toLocaleString()} {e.currency}</span>
                        </div>
                        <p className="font-medium text-slate-800 line-clamp-1">{e.title}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{e.submittedAt}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-slate-300"
            />
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900 leading-none">{currentUser.name}</span>
                {currentUser.isManager ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                    Manager
                  </span>
                ) : (
                  <span className="text-[9px] font-medium px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                    Employee
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                {currentUser.role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {/* User Switcher Menu */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Switch Persona to Test Workflows
              </div>
              <div className="space-y-1 mt-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
                      currentUser.id === u.id ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 truncate">{u.name}</span>
                        {currentUser.id === u.id && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{u.role} • {u.department}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between px-1">
                <span className="text-[10px] text-slate-400">Client IP: {currentUser.ip}</span>
                <button
                  onClick={resetDemoData}
                  className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Reset Demo State
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
