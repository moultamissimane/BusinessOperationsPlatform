import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Employee,
  Project,
  Task,
  LeaveRequest,
  Expense,
  AuditLogEntry,
  CurrentUser,
  TaskStatus,
  LeaveStatus,
  ExpenseStatus,
  DepartmentType,
  RoleType,
} from '../types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_LEAVES,
  INITIAL_EXPENSES,
  INITIAL_AUDIT_LOGS,
  DEMO_USERS,
} from '../mockData';

interface ErpContextType {
  currentUser: CurrentUser;
  setCurrentUser: (user: CurrentUser) => void;
  availableUsers: CurrentUser[];
  employees: Employee[];
  projects: Project[];
  tasks: Task[];
  leaves: LeaveRequest[];
  expenses: Expense[];
  auditLogs: AuditLogEntry[];
  currency: 'MAD' | 'USD' | 'EUR';
  setCurrency: (c: 'MAD' | 'USD' | 'EUR') => void;

  // Actions
  addEmployee: (employee: Omit<Employee, 'id' | 'code'>) => void;
  updateEmployeeRole: (id: string, newRole: RoleType, newDepartment: DepartmentType) => void;
  addProject: (project: Omit<Project, 'id' | 'code' | 'spent' | 'progress'>) => void;
  addTask: (task: Omit<Task, 'id' | 'code' | 'createdAt'>) => void;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;

  // Leave Actions
  requestLeave: (request: Omit<LeaveRequest, 'id' | 'code' | 'status' | 'submittedAt'>) => void;
  reviewLeave: (leaveId: string, status: 'Approved' | 'Rejected', comment?: string) => void;

  // Expense Actions
  submitExpense: (expense: Omit<Expense, 'id' | 'code' | 'status' | 'submittedAt'>) => void;
  reviewExpense: (expenseId: string, status: ExpenseStatus, notes?: string) => void;

  // Helper/Reset
  resetDemoData: () => void;
  recordAudit: (
    action: AuditLogEntry['action'],
    entity: string,
    entityType: AuditLogEntry['entityType'],
    oldValue: string,
    newValue: string,
    notes?: string
  ) => void;
}

const ErpContext = createContext<ErpContextType | undefined>(undefined);

const formatTimestamp = (date: Date = new Date()): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<CurrentUser>(() => {
    const saved = localStorage.getItem('workflow_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return DEMO_USERS[0]; // Imane Benkirane by default
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('workflow_employees');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_EMPLOYEES;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('workflow_projects');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_PROJECTS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('workflow_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_TASKS;
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('workflow_leaves');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_LEAVES;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('workflow_expenses');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_EXPENSES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('workflow_audit_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [currency, setCurrency] = useState<'MAD' | 'USD' | 'EUR'>('MAD');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('workflow_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('workflow_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('workflow_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('workflow_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('workflow_leaves', JSON.stringify(leaves));
  }, [leaves]);

  useEffect(() => {
    localStorage.setItem('workflow_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('workflow_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const setCurrentUser = (user: CurrentUser) => {
    setCurrentUserState(user);
  };

  const recordAudit = (
    action: AuditLogEntry['action'],
    entity: string,
    entityType: AuditLogEntry['entityType'],
    oldValue: string,
    newValue: string,
    notes?: string
  ) => {
    const newEntry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entity,
      entityType,
      oldValue,
      newValue,
      timestamp: formatTimestamp(),
      ipAddress: currentUser.ip,
      notes,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const addEmployee = (empData: Omit<Employee, 'id' | 'code'>) => {
    const nextCode = `EMP-${(employees.length + 1).toString().padStart(3, '0')}`;
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now()}`,
      code: nextCode,
    };
    setEmployees((prev) => [...prev, newEmp]);
    recordAudit(
      'Created',
      `Employee #${newEmp.code.replace('EMP-', '')}`,
      'Employee',
      'N/A',
      `${newEmp.name} (${newEmp.role} - ${newEmp.department})`,
      `Added by ${currentUser.name}`
    );
  };

  const updateEmployeeRole = (id: string, newRole: RoleType, newDepartment: DepartmentType) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    const oldVal = `${target.role} (${target.department})`;
    const newVal = `${newRole} (${newDepartment})`;
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, role: newRole, department: newDepartment } : e))
    );
    recordAudit(
      'Updated',
      `Employee #${target.code.replace('EMP-', '')}`,
      'Employee',
      oldVal,
      newVal,
      `Role/Dept reassignment by ${currentUser.name}`
    );
  };

  const addProject = (projectData: Omit<Project, 'id' | 'code' | 'spent' | 'progress'>) => {
    const nextCode = `PRJ-${(projects.length + 101).toString()}`;
    const newProj: Project = {
      ...projectData,
      id: `prj-${Date.now()}`,
      code: nextCode,
      spent: 0,
      progress: 0,
    };
    setProjects((prev) => [...prev, newProj]);
    recordAudit(
      'Created',
      `Project #${newProj.code.replace('PRJ-', '')}`,
      'Project',
      'N/A',
      `${newProj.name} (Budget: ${newProj.budget} MAD)`,
      `Project initiated by ${currentUser.name}`
    );
  };

  const addTask = (taskData: Omit<Task, 'id' | 'code' | 'createdAt'>) => {
    const nextCode = `TSK-${(tasks.length + 201).toString()}`;
    const newTask: Task = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      code: nextCode,
      createdAt: formatTimestamp(),
    };
    setTasks((prev) => [newTask, ...prev]);
    recordAudit(
      'Created',
      `Task #${newTask.code.replace('TSK-', '')}`,
      'Task',
      'N/A',
      `Title: "${newTask.title}" (Priority: ${newTask.priority})`,
      `Created by ${currentUser.name}`
    );
  };

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const oldStatus = task.status;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    recordAudit(
      'Status Changed',
      `Task #${task.code.replace('TSK-', '')}`,
      'Task',
      `Status: ${oldStatus}`,
      `Status: ${newStatus}`,
      `Updated by ${currentUser.name}`
    );
  };

  const requestLeave = (reqData: Omit<LeaveRequest, 'id' | 'code' | 'status' | 'submittedAt'>) => {
    const nextCode = `LEV-${(leaves.length + 90).toString().padStart(3, '0')}`;
    const newLeave: LeaveRequest = {
      ...reqData,
      id: `lev-${Date.now()}`,
      code: nextCode,
      status: 'Pending',
      submittedAt: formatTimestamp(),
    };
    setLeaves((prev) => [newLeave, ...prev]);
    recordAudit(
      'Created',
      `Leave #${newLeave.code.replace('LEV-', '')}`,
      'Leave',
      'N/A',
      `${newLeave.leaveType} (${newLeave.daysCount} days: ${newLeave.startDate} to ${newLeave.endDate})`,
      `Submitted by ${currentUser.name}`
    );
  };

  const reviewLeave = (leaveId: string, status: 'Approved' | 'Rejected', comment?: string) => {
    const target = leaves.find((l) => l.id === leaveId);
    if (!target) return;
    const oldStatus = target.status;
    const now = formatTimestamp();
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              status,
              reviewedBy: currentUser.name,
              reviewedAt: now,
              reviewComment: comment || l.reviewComment,
            }
          : l
      )
    );
    recordAudit(
      status === 'Approved' ? 'Approved' : 'Rejected',
      `Leave #${target.code.replace('LEV-', '')}`,
      'Leave',
      `Status: ${oldStatus}`,
      `Status: ${status}`,
      comment ? `Review comment: "${comment}"` : `Action by ${currentUser.name}`
    );
  };

  const submitExpense = (expData: Omit<Expense, 'id' | 'code' | 'status' | 'submittedAt'>) => {
    const nextCode = `EXP-${(expenses.length + 192).toString()}`;
    const newExpense: Expense = {
      ...expData,
      id: `exp-${Date.now()}`,
      code: nextCode,
      status: 'Pending',
      submittedAt: formatTimestamp(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    recordAudit(
      'Created',
      `Expense #${newExpense.code.replace('EXP-', '')}`,
      'Expense',
      'N/A',
      `${newExpense.amount} ${newExpense.currency} - ${newExpense.title}`,
      `Claim submitted by ${currentUser.name}`
    );
  };

  const reviewExpense = (expenseId: string, status: ExpenseStatus, notes?: string) => {
    const target = expenses.find((e) => e.id === expenseId);
    if (!target) return;
    const oldStatus = target.status;
    const now = formatTimestamp();
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              status,
              reviewedBy: currentUser.name,
              reviewedAt: now,
              managerNotes: notes || e.managerNotes,
            }
          : e
      )
    );

    let actionLabel: AuditLogEntry['action'] = 'Status Changed';
    if (status === 'Approved') actionLabel = 'Approved';
    else if (status === 'Rejected') actionLabel = 'Rejected';
    else if (status === 'Changes Requested') actionLabel = 'Requested Changes';

    recordAudit(
      actionLabel,
      `Expense #${target.code.replace('EXP-', '')}`,
      'Expense',
      `Status: ${oldStatus}`,
      `Status: ${status}`,
      notes ? `Manager note: "${notes}"` : `Reviewed by ${currentUser.name}`
    );
  };

  const resetDemoData = () => {
    localStorage.removeItem('workflow_employees');
    localStorage.removeItem('workflow_projects');
    localStorage.removeItem('workflow_tasks');
    localStorage.removeItem('workflow_leaves');
    localStorage.removeItem('workflow_expenses');
    localStorage.removeItem('workflow_audit_logs');
    localStorage.removeItem('workflow_current_user');
    setEmployees(INITIAL_EMPLOYEES);
    setProjects(INITIAL_PROJECTS);
    setTasks(INITIAL_TASKS);
    setLeaves(INITIAL_LEAVES);
    setExpenses(INITIAL_EXPENSES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCurrentUserState(DEMO_USERS[0]);
  };

  return (
    <ErpContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        availableUsers: DEMO_USERS,
        employees,
        projects,
        tasks,
        leaves,
        expenses,
        auditLogs,
        currency,
        setCurrency,
        addEmployee,
        updateEmployeeRole,
        addProject,
        addTask,
        updateTaskStatus,
        requestLeave,
        reviewLeave,
        submitExpense,
        reviewExpense,
        resetDemoData,
        recordAudit,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
};

export const useErp = () => {
  const context = useContext(ErpContext);
  if (!context) {
    throw new Error('useErp must be used within an ErpProvider');
  }
  return context;
};
