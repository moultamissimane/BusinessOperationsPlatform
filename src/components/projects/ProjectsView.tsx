import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  Search,
  Calendar,
  DollarSign,
  Users,
  ChevronRight,
  MoreVertical,
  X,
  Check,
  ArrowRight,
  Kanban,
  ListFilter,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import {
  Project,
  Task,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  DepartmentType,
} from '../../types';

export const ProjectsView: React.FC = () => {
  const { projects, tasks, employees, addProject, addTask, updateTaskStatus, currentUser, currency } =
    useErp();

  const [activeTab, setActiveTab] = useState<'board' | 'table' | 'projects'>('board');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // New Project Form
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjDept, setNewProjDept] = useState<DepartmentType>('Engineering');
  const [newProjLeadId, setNewProjLeadId] = useState(employees[0]?.id || '');
  const [newProjBudget, setNewProjBudget] = useState(250000);
  const [newProjStartDate, setNewProjStartDate] = useState('2026-09-20');
  const [newProjDeadline, setNewProjDeadline] = useState('2026-12-31');

  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProjId, setNewTaskProjId] = useState(projects[0]?.id || '');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState(employees[1]?.id || '');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('High');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('Backlog');
  const [newTaskDeadline, setNewTaskDeadline] = useState('2026-09-30');

  const filteredTasks = tasks.filter((t) => {
    const matchesProj = selectedProjectId === 'All' || t.projectId === selectedProjectId;
    const matchesPriority = selectedPriority === 'All' || t.priority === selectedPriority;
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProj && matchesPriority && matchesSearch;
  });

  const columns: { status: TaskStatus; label: string; count: number; color: string }[] = [
    {
      status: 'Backlog',
      label: 'Backlog',
      count: filteredTasks.filter((t) => t.status === 'Backlog').length,
      color: 'bg-slate-500',
    },
    {
      status: 'In Progress',
      label: 'In Progress',
      count: filteredTasks.filter((t) => t.status === 'In Progress').length,
      color: 'bg-indigo-600',
    },
    {
      status: 'In Review',
      label: 'In Review',
      count: filteredTasks.filter((t) => t.status === 'In Review').length,
      color: 'bg-amber-500',
    },
    {
      status: 'Completed',
      label: 'Completed',
      count: filteredTasks.filter((t) => t.status === 'Completed').length,
      color: 'bg-emerald-600',
    },
  ];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName) return;
    const ok = await addProject({
      name: newProjName,
      description: newProjDesc || 'Enterprise initiative',
      department: newProjDept,
      leadId: newProjLeadId,
      budget: Number(newProjBudget),
      startDate: newProjStartDate,
      deadline: newProjDeadline,
      status: 'Planning',
      teamIds: [newProjLeadId],
    });
    if (ok) {
      setIsNewProjectModalOpen(false);
      setNewProjName('');
      setNewProjDesc('');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    const ok = await addTask({
      projectId: newTaskProjId,
      title: newTaskTitle,
      description: newTaskDesc,
      assignedToId: newTaskAssigneeId,
      priority: newTaskPriority,
      status: newTaskStatus,
      deadline: newTaskDeadline,
    });
    if (ok) {
      setIsNewTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Projects, Task Execution & Deadlines
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track enterprise roadmaps, task boards, engineer assignments, and milestone deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.permissions?.includes('tsk_manage') && (
            <button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
          {currentUser.permissions?.includes('prj_write') && (
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('board')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'board'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Kanban className="w-4 h-4" />
            Tasks Board (Kanban)
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'table'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Tasks Table ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Projects Portfolio ({projects.length})
          </button>
        </div>
      </div>

      {/* Filters Bar for Tasks */}
      {activeTab !== 'projects' && (
        <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks by title, code or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="bg-slate-100/70 rounded-xl p-3 flex flex-col min-h-[420px]">
                <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.color}`}></span>
                    <span className="text-xs font-bold text-slate-800">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.map((task) => {
                    const assigned = employees.find((e) => e.id === task.assignedToId);
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                      <div
                        key={task.id}
                        className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-xs hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                            {task.code}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              task.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : task.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{task.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{task.description}</p>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate max-w-[120px] font-medium text-slate-600">
                            {project?.name}
                          </span>
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {task.deadline}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={assigned?.avatar}
                              alt={assigned?.name}
                              title={assigned?.name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-[10px] text-slate-600 font-medium">
                              {assigned?.name.split(' ')[0]}
                            </span>
                          </div>

                          {/* Quick status transition dropdown/buttons */}
                          <div className="flex items-center gap-1">
                            {col.status !== 'In Progress' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'In Progress')}
                                title="Move to In Progress"
                                className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-600 transition-colors"
                              >
                                Prog
                              </button>
                            )}
                            {col.status !== 'In Review' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'In Review')}
                                title="Move to Review"
                                className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-amber-50 hover:text-amber-600 rounded text-slate-600 transition-colors"
                              >
                                Review
                              </button>
                            )}
                            {col.status !== 'Completed' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'Completed')}
                                title="Mark Completed"
                                className="px-1.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold transition-colors"
                              >
                                Done
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="h-28 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      No tasks in this lane
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TASKS TABLE */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Task ID &amp; Title</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => {
                  const assigned = employees.find((e) => e.id === t.assignedToId);
                  const project = projects.find((p) => p.id === t.projectId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{t.title}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{t.code}</span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">{project?.name}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={assigned?.avatar}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span>{assigned?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            t.priority === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : t.priority === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {t.deadline}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={t.status}
                          onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                          className="text-[11px] font-semibold py-1 px-2 border border-slate-200 rounded bg-white text-slate-800"
                        >
                          <option value="Backlog">Backlog</option>
                          <option value="In Progress">In Progress</option>
                          <option value="In Review">In Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[10px] text-slate-400">EF Core synced</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECTS PORTFOLIO */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((proj) => {
            const lead = employees.find((e) => e.id === proj.leadId);
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            const doneTasks = projTasks.filter((t) => t.status === 'Completed');
            return (
              <div
                key={proj.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {proj.code}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{proj.department}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{proj.name}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        proj.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : proj.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3 mt-2">{proj.description}</p>

                  {/* Progress bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Delivery Completion</span>
                      <span className="font-bold text-slate-800">{proj.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${proj.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Budget & Timeline */}
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Budget Allocated</span>
                      <span className="font-bold text-slate-800">
                        {proj.budget.toLocaleString()} {currency}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Milestone Deadline</span>
                      <span className="font-bold text-slate-800">{proj.deadline}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <img
                      src={lead?.avatar}
                      alt={lead?.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="text-slate-700 font-medium">Lead: {lead?.name}</span>
                  </div>
                  <span className="text-slate-500">
                    {doneTasks.length}/{projTasks.length} tasks closed
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE PROJECT */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Initiate New Project</h3>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Casablanca Payment Gateway Integration"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="Project scope, deliverables, and architecture..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={newProjDept}
                    onChange={(e) => setNewProjDept(e.target.value as DepartmentType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Finance & Accounting">Finance & Accounting</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Operations">Operations</option>
                    <option value="Product & Design">Product & Design</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Project Lead</label>
                  <select
                    value={newProjLeadId}
                    onChange={(e) => setNewProjLeadId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Budget ({currency})</label>
                  <input
                    type="number"
                    value={newProjBudget}
                    onChange={(e) => setNewProjBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newProjStartDate}
                    onChange={(e) => setNewProjStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={newProjDeadline}
                    onChange={(e) => setNewProjDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Launch Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TASK */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Create &amp; Assign Task</h3>
              <button
                onClick={() => setIsNewTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Configure Serilog structured audit sinks in ASP.NET Core"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Details &amp; Criteria</label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Specific requirements, deliverables, or pull request links..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Parent Project</label>
                  <select
                    value={newTaskProjId}
                    onChange={(e) => setNewTaskProjId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assigned Employee</label>
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.title})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Status</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Create &amp; Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
