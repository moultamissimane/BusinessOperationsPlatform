import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  FileText,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  Image,
  Upload,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { Expense, ExpenseCategory, ExpenseStatus } from '../../types';

export const ExpensesView: React.FC = () => {
  const { expenses, employees, submitExpense, reviewExpense, currentUser, currency } = useErp();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'mine'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [reviewingExpense, setReviewingExpense] = useState<Expense | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);

  // Submit Expense Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [expCurrency, setExpCurrency] = useState<'MAD' | 'USD' | 'EUR'>('MAD');
  const [category, setCategory] = useState<ExpenseCategory>('Software & Subscriptions');
  const [date, setDate] = useState('2026-09-17');
  const [receiptFileName, setReceiptFileName] = useState('invoice_receipt_scan.pdf');

  // Manager Review State
  const [reviewDecision, setReviewDecision] = useState<ExpenseStatus>('Approved');
  const [managerNotes, setManagerNotes] = useState('');

  const categories: ExpenseCategory[] = [
    'Software & Subscriptions',
    'Hardware & Equipment',
    'Travel & Lodging',
    'Client Dining',
    'Office Supplies',
    'Training & Conferences',
  ];

  const filteredExpenses = expenses.filter((exp) => {
    const emp = employees.find((e) => e.id === exp.employeeId);
    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'pending'
        ? exp.status === 'Pending'
        : exp.employeeId === currentUser.id;

    const matchesCategory = selectedCategory === 'All' || exp.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || exp.status === selectedStatus;
    const matchesSearch =
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesCategory && matchesStatus && matchesSearch;
  });

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    submitExpense({
      employeeId: currentUser.id,
      title,
      amount: Number(amount),
      currency: expCurrency,
      category,
      date,
      receiptFileName: receiptFileName || 'receipt_attached.pdf',
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    });

    setIsSubmitModalOpen(false);
    setTitle('');
    setAmount('');
  };

  const handleReviewSubmit = () => {
    if (!reviewingExpense) return;
    reviewExpense(reviewingExpense.id, reviewDecision, managerNotes);
    setReviewingExpense(null);
    setManagerNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Expense Claims &amp; Financial Reimbursements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit corporate claims with tax receipts. Managers can Approve, Reject, or Request Changes with feedback.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Submit Expense
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Settled &amp; Approved Claims
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">
                {expenses
                  .filter((e) => e.status === 'Approved')
                  .reduce((acc, curr) => acc + curr.amount, 0)
                  .toLocaleString()}{' '}
                {currency}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Manager Decision
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-amber-600">
                {expenses
                  .filter((e) => e.status === 'Pending')
                  .reduce((acc, curr) => acc + curr.amount, 0)
                  .toLocaleString()}{' '}
                {currency}
              </span>
              <span className="text-xs text-slate-500">
                ({expenses.filter((e) => e.status === 'Pending').length} claims)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Audited Submissions
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">{expenses.length}</span>
              <span className="text-xs text-slate-500">total transactions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Claims ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending Review ({expenses.filter((e) => e.status === 'Pending').length})
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'mine' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Claims ({expenses.filter((e) => e.employeeId === currentUser.id).length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code or description..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Ref Code &amp; Staff</th>
                <th className="py-3 px-3">Expense Title</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Receipt Scan</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Manager Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => {
                const emp = employees.find((e) => e.id === exp.employeeId);
                const isExplicitDemoRef = exp.code === 'EXP-192';

                return (
                  <tr
                    key={exp.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isExplicitDemoRef ? 'bg-indigo-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar}
                          alt={emp?.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{emp?.name || 'Staff'}</span>
                            {isExplicitDemoRef && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-600 text-white rounded">
                                Prompt Ref
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {exp.code} • {emp?.department}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block max-w-xs truncate">
                        {exp.title}
                      </span>
                      {exp.managerNotes && (
                        <span className="text-[11px] text-amber-700 block italic line-clamp-1">
                          Note: "{exp.managerNotes}"
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {exp.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {exp.amount.toLocaleString()} {exp.currency}
                    </td>

                    <td className="py-3 px-3">
                      {exp.receiptFileName ? (
                        <button
                          onClick={() => setViewingReceipt(exp)}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px] font-medium hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Doc</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No receipt</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{exp.date}</td>

                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center w-max gap-1 ${
                          exp.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : exp.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : exp.status === 'Changes Requested'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {exp.status === 'Approved' && <Check className="w-3 h-3" />}
                        {exp.status === 'Rejected' && <X className="w-3 h-3" />}
                        {exp.status === 'Changes Requested' && <AlertCircle className="w-3 h-3" />}
                        {exp.status === 'Pending' && <Clock className="w-3 h-3" />}
                        {exp.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setReviewingExpense(exp);
                          setReviewDecision('Approved');
                          setManagerNotes(
                            exp.status === 'Approved'
                              ? 'Approved. Reimbursement queued in accounts ledger.'
                              : 'Approved per corporate expense policy.'
                          );
                        }}
                        className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-semibold text-xs transition-colors"
                      >
                        Review Claim
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: SUBMIT EXPENSE */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Submit Corporate Expense</h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitExpense} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expense Description *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Azure Container Apps & Managed Redis hosting"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Currency</label>
                  <select
                    value={expCurrency}
                    onChange={(e) => setExpCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="MAD">MAD (Moroccan Dirham)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Receipt Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Receipt File Upload simulation */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tax Invoice / Receipt File</label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-slate-600 block font-medium">
                    Upload official tax invoice (Facture avec ICE)
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">
                    Attached mock: {receiptFileName}
                  </span>
                  <input
                    type="text"
                    value={receiptFileName}
                    onChange={(e) => setReceiptFileName(e.target.value)}
                    placeholder="receipt_file_name.pdf"
                    className="mt-2 text-center text-xs px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGER REVIEW EXPENSE (APPROVE / REJECT / REQUEST CHANGES) */}
      {reviewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Manager Review: {reviewingExpense.code}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {employees.find((e) => e.id === reviewingExpense.employeeId)?.name}
                </span>
              </div>
              <button
                onClick={() => setReviewingExpense(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Expense Title:</span>
                  <span className="font-bold text-slate-900">{reviewingExpense.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Claim:</span>
                  <span className="font-bold text-indigo-700">
                    {reviewingExpense.amount.toLocaleString()} {reviewingExpense.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category &amp; Date:</span>
                  <span>{reviewingExpense.category} • {reviewingExpense.date}</span>
                </div>
              </div>

              {/* 3 Decision Options (As specified in prompt: Approve, Reject, Request changes) */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Manager Disposition *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('Approved');
                      setManagerNotes('Approved. Dispatched to finance accounts payable.');
                    }}
                    className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      reviewDecision === 'Approved'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('Changes Requested');
                      setManagerNotes('Please provide tax stamp invoice with ICE identifier.');
                    }}
                    className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      reviewDecision === 'Changes Requested'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Request Changes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('Rejected');
                      setManagerNotes('Non-compliant with organizational expense policy.');
                    }}
                    className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      reviewDecision === 'Rejected'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Manager Review Notes &amp; Audit Comments
                </label>
                <textarea
                  rows={3}
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Explain reason for decision or specify required invoice changes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center gap-2 text-[11px] text-indigo-900">
                <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Action will be registered by <strong>{currentUser.name}</strong> from IP{' '}
                  <strong>{currentUser.ip}</strong> into the audit trail.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingExpense(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Commit Decision &amp; Update Ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW RECEIPT ATTACHMENT */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Receipt: {viewingReceipt.receiptFileName || 'Document'}
              </h4>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 relative flex items-center justify-center">
                <img
                  src={viewingReceipt.receiptUrl}
                  alt="Invoice receipt preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white p-2 rounded text-[11px]">
                  <div className="flex justify-between font-bold">
                    <span>{viewingReceipt.code}</span>
                    <span>
                      {viewingReceipt.amount.toLocaleString()} {viewingReceipt.currency}
                    </span>
                  </div>
                  <span className="text-slate-300 text-[10px] block truncate mt-0.5">
                    {viewingReceipt.title}
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
