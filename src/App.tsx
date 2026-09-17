import React, { useState } from 'react';
import { ErpProvider } from './context/ErpContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { EmployeesView } from './components/employees/EmployeesView';
import { ProjectsView } from './components/projects/ProjectsView';
import { LeavesView } from './components/leaves/LeavesView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { AuditView } from './components/audit/AuditView';
import { DotNetApiModal } from './components/dotnet/DotNetApiModal';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [isDotNetModalOpen, setIsDotNetModalOpen] = useState(false);

  return (
    <ErpProvider>
      <div className="flex h-screen bg-slate-50 text-slate-900 antialiased overflow-hidden font-sans">
        {/* Persistent Enterprise Sidebar */}
        <Sidebar
          activeNav={activeNav}
          onNavigate={setActiveNav}
          onOpenDotNetModal={() => setIsDotNetModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Application Header */}
          <Header
            activeNav={activeNav}
            onNavigate={setActiveNav}
            onOpenDotNetModal={() => setIsDotNetModalOpen(true)}
          />

          {/* Scrollable Viewport */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-7xl mx-auto pb-12">
              {activeNav === 'dashboard' && (
                <DashboardView onNavigate={setActiveNav} />
              )}
              {activeNav === 'employees' && <EmployeesView />}
              {activeNav === 'projects' && <ProjectsView />}
              {activeNav === 'leaves' && <LeavesView />}
              {activeNav === 'expenses' && <ExpensesView />}
              {activeNav === 'audit' && <AuditView />}
            </div>
          </main>
        </div>

        {/* ASP.NET Core 9 Web API Specification Drawer/Modal */}
        <DotNetApiModal
          isOpen={isDotNetModalOpen}
          onClose={() => setIsDotNetModalOpen(false)}
        />
      </div>
    </ErpProvider>
  );
}
