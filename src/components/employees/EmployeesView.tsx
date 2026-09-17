import React, { useState } from 'react';
import {
  Users,
  Building2,
  Shield,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { PERMISSIONS_LIST } from '../../mockData';
import { DepartmentType, RoleType, Employee } from '../../types';

export const EmployeesView: React.FC = () => {
  const { employees, addEmployee, updateEmployeeRole, currentUser } = useErp();

  const [activeTab, setActiveTab] = useState<'directory' | 'departments' | 'permissions'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<string>('All');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // New Employee Form State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDept, setNewEmpDept] = useState<DepartmentType>('Engineering');
  const [newEmpRole, setNewEmpRole] = useState<RoleType>('Senior Engineer');
  const [newEmpTitle, setNewEmpTitle] = useState('');
  const [newEmpLocation, setNewEmpLocation] = useState('Casablanca HQ (Marina)');

  // Edit Role State
  const [editRole, setEditRole] = useState<RoleType>('Senior Engineer');
  const [editDept, setEditDept] = useState<DepartmentType>('Engineering');

  const departments: DepartmentType[] = [
    'Engineering',
    'Finance & Accounting',
    'Human Resources',
    'Operations',
    'Product & Design',
    'Sales & Marketing',
  ];

  const roles: RoleType[] = [
    'Administrator',
    'Director',
    'Department Manager',
    'Team Lead',
    'Senior Engineer',
    'Specialist',
    'Associate',
  ];

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartment === 'All' || emp.department === selectedDepartment;
    const matchesRole = selectedRole === 'All' || emp.role === selectedRole;
    return matchesSearch && matchesDept && matchesRole;
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail) return;

    addEmployee({
      name: newEmpName,
      email: newEmpEmail,
      phone: newEmpPhone || '+212 660-000000',
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      department: newEmpDept,
      role: newEmpRole,
      title: newEmpTitle || `${newEmpRole} in ${newEmpDept}`,
      status: 'Active',
      joinDate: new Date().toISOString().split('T')[0],
      location: newEmpLocation,
      permissions: ['emp_read', 'lev_request', 'exp_submit'],
    });

    setIsAddModalOpen(false);
    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpPhone('');
    setNewEmpTitle('');
  };

  const handleUpdateRole = () => {
    if (!editingEmployee) return;
    updateEmployeeRole(editingEmployee.id, editRole, editDept);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Human Resources & Workforce Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage employee directories, organizational departments, roles, and granular security permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'directory'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Employees Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'departments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departments & Structure
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'permissions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Roles & Permissions Matrix
        </button>
      </div>

      {/* TAB 1: DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee by name, code, job title, email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employees Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 block">
                          {emp.code} • {emp.department}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        emp.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {emp.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-400">Position:</span>
                      <span className="font-semibold">{emp.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-400">Security Role:</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                        {emp.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{emp.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{emp.location}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Joined {emp.joinDate}</span>
                  <button
                    onClick={() => {
                      setEditingEmployee(emp);
                      setEditRole(emp.role);
                      setEditDept(emp.department);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 hover:underline"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit Role
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const deptEmployees = employees.filter((e) => e.department === dept);
            const manager = deptEmployees.find(
              (e) => e.role === 'Director' || e.role === 'Department Manager'
            );
            return (
              <div key={dept} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{dept}</h4>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {deptEmployees.length} Staff
                  </span>
                </div>

                <div className="space-y-2 mt-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span className="text-slate-400">Department Lead:</span>
                    <span className="font-semibold text-slate-800">
                      {manager ? manager.name : 'Imane Benkirane (Acting)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span className="text-slate-400">Cost Center:</span>
                    <span className="font-mono text-slate-700">CC-{dept.substring(0, 3).toUpperCase()}-01</span>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Team Members
                  </span>
                  <div className="flex items-center -space-x-2">
                    {deptEmployees.map((e) => (
                      <img
                        key={e.id}
                        src={e.avatar}
                        alt={e.name}
                        title={`${e.name} (${e.title})`}
                        className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-xs"
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Enterprise Role-Based Access Control (RBAC) Matrix
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Enforced server-side via ASP.NET Core Policy Handlers &amp; JWT Claims
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
              Identity Model v9.0
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Permission Capability</th>
                  <th className="py-3 px-3">Module</th>
                  <th className="py-3 px-3 text-center">Administrator</th>
                  <th className="py-3 px-3 text-center">Director / Manager</th>
                  <th className="py-3 px-3 text-center">Team Lead</th>
                  <th className="py-3 px-3 text-center">Staff / Engineer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSIONS_LIST.map((perm) => (
                  <tr key={perm.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">{perm.name}</span>
                      <span className="text-[11px] text-slate-400">{perm.description}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {perm.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perm.id !== 'sys_admin' ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {['emp_read', 'prj_read', 'tsk_manage', 'lev_request', 'exp_submit'].includes(
                        perm.id
                      ) ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {['emp_read', 'lev_request', 'exp_submit'].includes(perm.id) ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add New Workforce Member</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="e.g. Noureddine Bensouda"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="name@workflow-erp.ma"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    placeholder="+212 66X-XXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value as DepartmentType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Role & Security Tier</label>
                  <select
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value as RoleType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Job Title</label>
                <input
                  type="text"
                  value={newEmpTitle}
                  onChange={(e) => setNewEmpTitle(e.target.value)}
                  placeholder="e.g. Cloud DevOps Engineer (.NET / Docker)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Office Location</label>
                <select
                  value={newEmpLocation}
                  onChange={(e) => setNewEmpLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="Casablanca HQ (Marina)">Casablanca HQ (Marina)</option>
                  <option value="Rabat Tech Park">Rabat Tech Park</option>
                  <option value="Tangier Med Hub">Tangier Med Hub</option>
                  <option value="Remote (Morocco)">Remote (Morocco)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Create &amp; Dispatch Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ROLE & REASSIGN */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Update Role: {editingEmployee.name}
              </h3>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500">
                Updating an employee's role or department updates their authorization claims and records an immutable entry in the enterprise audit trail.
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as RoleType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Department</label>
                <select
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value as DepartmentType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateRole}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save &amp; Log Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
