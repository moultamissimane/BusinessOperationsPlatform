export type RoleType = 'Administrator' | 'Director' | 'Department Manager' | 'Team Lead' | 'Senior Engineer' | 'Specialist' | 'Associate';

export type DepartmentType = 'Engineering' | 'Finance & Accounting' | 'Human Resources' | 'Operations' | 'Product & Design' | 'Sales & Marketing';

export interface Permission {
  id: string;
  name: string;
  category: 'Employees' | 'Projects' | 'Leaves' | 'Expenses' | 'Audit' | 'System';
  description: string;
}

export interface Employee {
  id: string;
  code: string; // e.g. EMP-101
  name: string;
  email: string;
  phone: string;
  avatar: string;
  department: DepartmentType;
  role: RoleType;
  title: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  joinDate: string;
  location: string;
  managerId?: string;
  permissions: string[];
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'In Review' | 'Completed' | 'On Hold';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Backlog' | 'In Progress' | 'In Review' | 'Completed';

export interface Project {
  id: string;
  code: string; // e.g. PRJ-204
  name: string;
  description: string;
  department: DepartmentType;
  leadId: string;
  budget: number;
  spent: number;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  teamIds: string[];
  progress: number;
}

export interface Task {
  id: string;
  code: string; // e.g. TSK-408
  projectId: string;
  title: string;
  description: string;
  assignedToId: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string;
  createdAt: string;
}

export type LeaveType = 'Annual leave' | 'Sick leave' | 'Exceptional leave';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  code: string; // e.g. LEV-089
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  exceptionalSubtype?: 'Marriage' | 'Paternity/Maternity' | 'Bereavement' | 'Relocation' | 'Other';
}

export type ExpenseCategory = 'Travel & Lodging' | 'Software & Subscriptions' | 'Office Supplies' | 'Client Dining' | 'Hardware & Equipment' | 'Training & Conferences';
export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected' | 'Changes Requested';

export interface Expense {
  id: string;
  code: string; // e.g. EXP-192
  employeeId: string;
  title: string;
  amount: number;
  currency: 'MAD' | 'USD' | 'EUR';
  category: ExpenseCategory;
  date: string;
  receiptUrl?: string;
  receiptFileName?: string;
  status: ExpenseStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  managerNotes?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'Created' | 'Status Changed' | 'Updated' | 'Deleted' | 'Approved' | 'Rejected' | 'Requested Changes';
  entity: string; // e.g. "Expense #192", "Leave #89", "Task #408"
  entityType: 'Expense' | 'Leave' | 'Task' | 'Project' | 'Employee';
  oldValue: string;
  newValue: string;
  timestamp: string;
  ipAddress: string;
  notes?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  department: DepartmentType;
  isManager: boolean;
  avatar: string;
  ip: string;
  permissions?: string[];
}

export interface LeaveBalance {
  year: number;
  entitlement: number;
  used: number;
  pending: number;
  remaining: number;
}
