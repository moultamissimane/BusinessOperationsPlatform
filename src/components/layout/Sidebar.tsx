import React from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  Receipt,
  FileCheck2,
  Code2,
  Building2,
  ShieldCheck,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';

interface SidebarProps {
  activeNav: string;
  onNavigate: (nav: string) => void;
  onOpenDotNetModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeNav, onNavigate, onOpenDotNetModal }) => {
  const { leaves, expenses, currentUser } = useErp();

  const pendingLeavesCount = leaves.filter((l) => l.status === 'Pending').length;
  const pendingExpensesCount = expenses.filter((e) => e.status === 'Pending').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'employees',
      label: 'Employees & Roles',
      icon: Users,
      badge: null,
    },
    {
      id: 'projects',
      label: 'Projects & Tasks',
      icon: Briefcase,
      badge: null,
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      icon: CalendarDays,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
      badgeColor: 'bg-indigo-600',
    },
    {
      id: 'expenses',
      label: 'Expense Management',
      icon: Receipt,
      badge: pendingExpensesCount > 0 ? pendingExpensesCount : null,
      badgeColor: 'bg-amber-600',
    },
    {
      id: 'audit',
      label: 'Enterprise Audit Trail',
      icon: FileCheck2,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-950">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-sm tracking-tight">WorkFlow ERP</span>
            <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-400/30">
              .NET 9
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal">Business Operations Hub</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Operations Core
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${
                    item.badgeColor || 'bg-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4 pb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Architecture & System
        </div>

        <button
          onClick={onOpenDotNetModal}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all border border-slate-800/60"
        >
          <div className="flex items-center gap-3">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="text-left">ASP.NET Core 9 API</span>
          </div>
          <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
            Swagger / EF
          </span>
        </button>
      </nav>

      {/* User Context Footer in Sidebar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/40 border border-slate-800">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-700"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white truncate">{currentUser.name}</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{currentUser.role}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
          <span>{currentUser.department}</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Online
          </span>
        </div>
      </div>
    </aside>
  );
};
