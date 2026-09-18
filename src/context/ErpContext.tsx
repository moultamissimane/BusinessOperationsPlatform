import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Employee,
  Project,
  Task,
  LeaveRequest,
  Expense,
  AuditLogEntry,
  CurrentUser,
  LeaveBalance,
  TaskStatus,
  ExpenseStatus,
  DepartmentType,
  RoleType,
} from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from './AuthContext';

type Currency = 'MAD' | 'USD' | 'EUR';
type Collection = 'employees' | 'projects' | 'tasks' | 'leaves' | 'expenses' | 'audit' | 'balance';

export interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ErpContextType {
  currentUser: CurrentUser;
  employees: Employee[];
  projects: Project[];
  tasks: Task[];
  leaves: LeaveRequest[];
  expenses: Expense[];
  auditLogs: AuditLogEntry[];
  auditTotal: number;
  leaveBalance: LeaveBalance | null;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  // Every action resolves to true on success and false on failure (the failure is already shown as a toast).
  addEmployee: (employee: Omit<Employee, 'id' | 'code'> & { initialPassword: string }) => Promise<boolean>;
  updateEmployeeRole: (id: string, newRole: RoleType, newDepartment: DepartmentType) => Promise<boolean>;
  addProject: (project: Omit<Project, 'id' | 'code' | 'spent' | 'progress'>) => Promise<boolean>;
  addTask: (task: Omit<Task, 'id' | 'code' | 'createdAt'>) => Promise<boolean>;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => Promise<boolean>;
  requestLeave: (request: Omit<LeaveRequest, 'id' | 'code' | 'status' | 'submittedAt' | 'daysCount'>) => Promise<boolean>;
  reviewLeave: (leaveId: string, status: 'Approved' | 'Rejected', comment?: string) => Promise<boolean>;
  submitExpense: (expense: Omit<Expense, 'id' | 'code' | 'status' | 'submittedAt' | 'receiptUrl' | 'receiptFileName'>, receipt?: File | null) => Promise<boolean>;
  reviewExpense: (expenseId: string, status: ExpenseStatus, notes?: string) => Promise<boolean>;
  attachReceipt: (expenseId: string, file: File) => Promise<boolean>;
  /** After "Changes Requested": sends the claim back to the manager's queue. */
  resubmitExpense: (expenseId: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

const ErpContext = createContext<ErpContextType | undefined>(undefined);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-15T14:32:00Z" -> "15 Sep 2026 14:32" in the viewer's local time. */
const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const orUndefined = <T,>(v: T | null | undefined): T | undefined => v ?? undefined;

// The API sends null for missing values and ISO timestamps; the views expect undefined and display strings.
const mapEmployee = (e: any): Employee => ({ ...e, managerId: orUndefined(e.managerId) });
const mapTask = (t: any): Task => ({ ...t, createdAt: formatTimestamp(t.createdAt) });
const mapLeave = (l: any): LeaveRequest => ({
  ...l,
  submittedAt: formatTimestamp(l.submittedAt),
  reviewedBy: orUndefined(l.reviewedBy),
  reviewedAt: l.reviewedAt ? formatTimestamp(l.reviewedAt) : undefined,
  reviewComment: orUndefined(l.reviewComment),
  exceptionalSubtype: orUndefined(l.exceptionalSubtype),
});
const mapExpense = (e: any): Expense => ({
  ...e,
  submittedAt: formatTimestamp(e.submittedAt),
  receiptUrl: orUndefined(e.receiptUrl),
  receiptFileName: orUndefined(e.receiptFileName),
  reviewedBy: orUndefined(e.reviewedBy),
  reviewedAt: e.reviewedAt ? formatTimestamp(e.reviewedAt) : undefined,
  managerNotes: orUndefined(e.managerNotes),
});
const mapAudit = (a: any): AuditLogEntry => ({ ...a, timestamp: formatTimestamp(a.timestamp), notes: orUndefined(a.notes) });

/** Some users lack permission for a collection (403). That is normal, not an error: they simply see none of it. */
const tolerant = async <T,>(request: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await request;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return fallback;
    throw e;
  }
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser, logout } = useAuth();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [currency, setCurrency] = useState<Currency>('MAD');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  const notify = useCallback((type: Toast['type'], message: string) => {
    const id = nextToastId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), type === 'error' ? 7000 : 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const fetchers: Record<Collection, () => Promise<void>> = {
    employees: async () => setEmployees((await tolerant(api.get<any[]>('/employees'), [])).map(mapEmployee)),
    projects: async () => setProjects(await tolerant(api.get<Project[]>('/projects'), [])),
    tasks: async () => setTasks((await tolerant(api.get<any[]>('/tasks'), [])).map(mapTask)),
    leaves: async () => setLeaves((await api.get<any[]>('/leaves')).map(mapLeave)),
    expenses: async () => setExpenses((await api.get<any[]>('/expenses')).map(mapExpense)),
    audit: async () => {
      const page = await tolerant(api.get<{ items: any[]; total: number }>('/audit-logs?pageSize=100'), { items: [], total: 0 });
      setAuditLogs(page.items.map(mapAudit));
      setAuditTotal(page.total);
    },
    balance: async () => setLeaveBalance(await api.get<LeaveBalance>('/leaves/balance')),
  };

  const reload = useCallback(async () => {
    await Promise.all(Object.values(fetchers).map((f) => f()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (...keys: Collection[]) => {
    await Promise.all(keys.map((k) => fetchers[k]()));
  };

  // Load everything once per signed-in user; drop everything on sign-out so the next user never sees stale data.
  useEffect(() => {
    if (!currentUser) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    reload()
      .then(() => !cancelled && setLoaded(true))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Could not load data.'));
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs an API call, then refreshes what it touched. Failures become toasts instead of unhandled rejections. */
  const act = async (fn: () => Promise<unknown>, reloadKeys: Collection[], success?: string): Promise<boolean> => {
    try {
      await fn();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    }
    try {
      await refresh('audit', ...reloadKeys);
    } catch {
      /* the action succeeded; a failed refresh will be corrected by the next reload */
    }
    if (success) notify('success', success);
    return true;
  };

  if (!currentUser) return null; // AuthGate never renders us signed out; this is just for type narrowing.

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-700 text-sm">
        <p className="font-semibold">Could not reach the WorkFlow API</p>
        <p className="text-xs text-slate-500 max-w-md text-center">{loadError}</p>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
            Retry
          </button>
          <button onClick={logout} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">Loading your workspace…</div>;
  }

  const addEmployee: ErpContextType['addEmployee'] = ({ initialPassword, ...e }) =>
    act(
      () =>
        api.post('/employees', {
          name: e.name,
          email: e.email,
          phone: e.phone,
          avatar: e.avatar,
          department: e.department,
          role: e.role,
          title: e.title,
          joinDate: e.joinDate,
          location: e.location,
          managerId: e.managerId ?? null,
          permissions: null, // let the role's defaults apply
          initialPassword,
        }),
      ['employees'],
      `${e.name} was added.`
    );

  const updateEmployeeRole: ErpContextType['updateEmployeeRole'] = (id, role, department) =>
    act(() => api.put(`/employees/${id}`, { role, department }), ['employees'], 'Employee updated.');

  const addProject: ErpContextType['addProject'] = (p) =>
    act(
      () =>
        api.post('/projects', {
          name: p.name,
          description: p.description,
          department: p.department,
          leadId: p.leadId,
          budget: p.budget,
          startDate: p.startDate,
          deadline: p.deadline,
          status: p.status,
          teamIds: p.teamIds,
        }),
      ['projects'],
      'Project created.'
    );

  const addTask: ErpContextType['addTask'] = (t) =>
    act(
      async () => {
        const created = await api.post<{ id: string }>('/tasks', {
          projectId: t.projectId,
          title: t.title,
          description: t.description,
          assignedToId: t.assignedToId,
          priority: t.priority,
          deadline: t.deadline,
        });
        // New tasks always start in Backlog on the server; move it if the form asked for another column.
        if (t.status !== 'Backlog') await api.patch(`/tasks/${created.id}/status`, { status: t.status });
      },
      ['tasks'],
      'Task created.'
    );

  const updateTaskStatus: ErpContextType['updateTaskStatus'] = async (taskId, status) => {
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t))); // optimistic: the board moves instantly
    const ok = await act(() => api.patch(`/tasks/${taskId}/status`, { status }), ['tasks']);
    if (!ok) setTasks(previous);
    return ok;
  };

  const requestLeave: ErpContextType['requestLeave'] = (r) =>
    act(
      () =>
        api.post('/leaves', {
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          reason: r.reason,
          exceptionalSubtype: r.exceptionalSubtype ?? null,
        }),
      ['leaves', 'balance'],
      'Leave request submitted.'
    );

  const reviewLeave: ErpContextType['reviewLeave'] = (id, decision, comment) =>
    act(() => api.post(`/leaves/${id}/review`, { decision, comment: comment || null }), ['leaves', 'balance', 'employees'], `Leave ${decision.toLowerCase()}.`);

  const submitExpense: ErpContextType['submitExpense'] = (e, receipt) =>
    act(
      async () => {
        const created = await api.post<{ id: string }>('/expenses', {
          title: e.title,
          amount: e.amount,
          currency: e.currency,
          category: e.category,
          date: e.date,
        });
        if (receipt) await api.upload(`/expenses/${created.id}/receipt`, receipt);
      },
      ['expenses'],
      'Expense submitted.'
    );

  const attachReceipt: ErpContextType['attachReceipt'] = (id, file) =>
    act(() => api.upload(`/expenses/${id}/receipt`, file), ['expenses'], 'Receipt attached.');

  const resubmitExpense: ErpContextType['resubmitExpense'] = (id) =>
    act(() => api.put(`/expenses/${id}`, {}), ['expenses'], 'Expense resubmitted for review.');

  const reviewExpense: ErpContextType['reviewExpense'] = (id, status, notes) => {
    const decision = status as 'Approved' | 'Rejected' | 'Changes Requested';
    return act(() => api.post(`/expenses/${id}/review`, { decision, notes: notes || null }), ['expenses'], `Expense ${decision.toLowerCase()}.`);
  };

  return (
    <ErpContext.Provider
      value={{
        currentUser,
        employees,
        projects,
        tasks,
        leaves,
        expenses,
        auditLogs,
        auditTotal,
        leaveBalance,
        currency,
        setCurrency,
        toasts,
        dismissToast,
        addEmployee,
        updateEmployeeRole,
        addProject,
        addTask,
        updateTaskStatus,
        requestLeave,
        reviewLeave,
        submitExpense,
        reviewExpense,
        attachReceipt,
        resubmitExpense,
        reload,
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
