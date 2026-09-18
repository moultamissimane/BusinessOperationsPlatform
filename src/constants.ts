import { Permission } from './types';

// Mirrors the permissions seeded by the backend (GET /api/permissions), used to label the permission matrix.
export const PERMISSIONS_LIST: Permission[] = [
  { id: 'emp_read', name: 'View Employees', category: 'Employees', description: 'Access company directory and profiles' },
  { id: 'emp_write', name: 'Manage Employees', category: 'Employees', description: 'Add, update or terminate employee records' },
  { id: 'prj_read', name: 'View Projects', category: 'Projects', description: 'Inspect project roadmaps and milestones' },
  { id: 'prj_write', name: 'Manage Projects', category: 'Projects', description: 'Create projects, modify budgets and leads' },
  { id: 'tsk_manage', name: 'Manage Tasks', category: 'Projects', description: 'Assign tasks, edit priorities and deadlines' },
  { id: 'lev_request', name: 'Request Leave', category: 'Leaves', description: 'Submit personal annual, sick, or exceptional leaves' },
  { id: 'lev_approve', name: 'Approve Leaves', category: 'Leaves', description: 'Approve or reject team member leave submissions' },
  { id: 'exp_submit', name: 'Submit Expenses', category: 'Expenses', description: 'Submit reimbursement claims with receipts' },
  { id: 'exp_approve', name: 'Approve Expenses', category: 'Expenses', description: 'Review, approve, reject or request expense changes' },
  { id: 'aud_view', name: 'View Audit Logs', category: 'Audit', description: 'Inspect compliance logs and historical system actions' },
  { id: 'sys_admin', name: 'System Settings', category: 'System', description: 'Full administrative access and security overrides' },
];
