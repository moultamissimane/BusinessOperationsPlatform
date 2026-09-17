import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  AlertCircle,
  Calendar,
  User,
  HeartPulse,
  Award,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { LeaveRequest, LeaveType } from '../../types';

export const LeavesView: React.FC = () => {
  const { leaves, employees, requestLeave, reviewLeave, currentUser } = useErp();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'mine'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqType, setReqType] = useState<LeaveType>('Annual leave');
  const [exceptionalSubtype, setExceptionalSubtype] = useState<'Marriage' | 'Paternity/Maternity' | 'Bereavement' | 'Relocation' | 'Other'>('Marriage');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-05');
  const [reason, setReason] = useState('');

  // Review Modal State
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [reviewComment, setReviewComment] = useState('');

  // Calculate days between two dates
  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    if (isNaN(diffTime) || diffTime < 0) return 1;
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    const days = calculateDays(startDate, endDate);

    requestLeave({
      employeeId: currentUser.id,
      leaveType: reqType,
      exceptionalSubtype: reqType === 'Exceptional leave' ? exceptionalSubtype : undefined,
      startDate,
      endDate,
      daysCount: days,
      reason,
    });

    setIsRequestModalOpen(false);
    setReason('');
  };

  const handleReviewSubmit = () => {
    if (!reviewingLeave) return;
    reviewLeave(reviewingLeave.id, reviewAction, reviewComment);
    setReviewingLeave(null);
    setReviewComment('');
  };

  const filteredLeaves = leaves.filter((l) => {
    const emp = employees.find((e) => e.id === l.employeeId);
    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'pending'
        ? l.status === 'Pending'
        : l.employeeId === currentUser.id;

    const matchesType = selectedType === 'All' || l.leaveType === selectedType;
    const matchesSearch =
      l.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Leave &amp; Time-Off Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit annual vacation, certified sick absences, and exceptional Moroccan statutory leave allowances.
          </p>
        </div>

        <button
          onClick={() => setIsRequestModalOpen(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      {/* Leave Quota Balances for Current User */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Annual Leave Balance
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">19</span>
              <span className="text-xs text-slate-500">/ 22 days accrued</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Certified Sick Leave
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">8</span>
              <span className="text-xs text-slate-500">/ 10 days quota</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Exceptional Allowance
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">4</span>
              <span className="text-xs text-slate-500">days available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Submissions ({leaves.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending Approvals ({leaves.filter((l) => l.status === 'Pending').length})
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'mine'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Submissions ({leaves.filter((l) => l.employeeId === currentUser.id).length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by reason or staff..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">All Types</option>
            <option value="Annual leave">Annual leave</option>
            <option value="Sick leave">Sick leave</option>
            <option value="Exceptional leave">Exceptional leave</option>
          </select>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Request Ref &amp; Staff</th>
                <th className="py-3 px-3">Leave Type</th>
                <th className="py-3 px-3">Date Range</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-4">Reason &amp; Notes</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Manager Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.map((req) => {
                const emp = employees.find((e) => e.id === req.employeeId);
                return (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar}
                          alt={emp?.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{emp?.name || 'Staff'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {req.code} • {emp?.department}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            req.leaveType === 'Annual leave'
                              ? 'bg-indigo-50 text-indigo-700'
                              : req.leaveType === 'Sick leave'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {req.leaveType}
                        </span>
                        {req.exceptionalSubtype && (
                          <span className="text-[10px] font-medium text-slate-500">
                            ({req.exceptionalSubtype})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                      {req.startDate} → {req.endDate}
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {req.daysCount} {req.daysCount === 1 ? 'day' : 'days'}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-700 font-normal line-clamp-2">{req.reason}</p>
                      {req.reviewComment && (
                        <p className="text-[11px] text-slate-500 mt-1 italic flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{req.reviewedBy}: "{req.reviewComment}"</span>
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center w-max gap-1 ${
                          req.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : req.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {req.status === 'Approved' && <Check className="w-3 h-3" />}
                        {req.status === 'Rejected' && <X className="w-3 h-3" />}
                        {req.status === 'Pending' && <Clock className="w-3 h-3" />}
                        {req.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {req.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setReviewingLeave(req);
                              setReviewAction('Approved');
                              setReviewComment('Approved as requested.');
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setReviewingLeave(req);
                              setReviewAction('Rejected');
                              setReviewComment('Declined per department staffing constraints.');
                            }}
                            className="px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Reviewed by {req.reviewedBy}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: SUBMIT LEAVE REQUEST */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Request Leave of Absence</h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-slate-700">
                <span className="font-semibold text-indigo-900 block mb-0.5">Requesting Staff:</span>
                <span>{currentUser.name} ({currentUser.role} • {currentUser.department})</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Leave Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Annual leave', 'Sick leave', 'Exceptional leave'] as LeaveType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReqType(t)}
                      className={`p-2 rounded-lg border text-left font-medium transition-colors ${
                        reqType === t
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {reqType === 'Exceptional leave' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Exceptional Event (Moroccan Labor Code)
                  </label>
                  <select
                    value={exceptionalSubtype}
                    onChange={(e) => setExceptionalSubtype(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Marriage">Employee Marriage (4 statutory days)</option>
                    <option value="Paternity/Maternity">Birth / Paternity (3 days paid)</option>
                    <option value="Bereavement">Bereavement / Family death (2-3 days)</option>
                    <option value="Relocation">Household Relocation (2 days)</option>
                    <option value="Other">Other exceptional circumstance</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-slate-600">
                <span>Calculated Working Duration:</span>
                <span className="font-bold text-slate-900">
                  {calculateDays(startDate, endDate)} working days
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason / Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide context for manager approval..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Submit Request &amp; Notify Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGER REVIEW LEAVE */}
      {reviewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Review Leave Request {reviewingLeave.code}
              </h3>
              <button
                onClick={() => setReviewingLeave(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1 text-slate-600">
                <p>
                  <strong className="text-slate-800">Staff:</strong>{' '}
                  {employees.find((e) => e.id === reviewingLeave.employeeId)?.name}
                </p>
                <p>
                  <strong className="text-slate-800">Dates:</strong> {reviewingLeave.startDate} to{' '}
                  {reviewingLeave.endDate} ({reviewingLeave.daysCount} days)
                </p>
                <p>
                  <strong className="text-slate-800">Type:</strong> {reviewingLeave.leaveType}
                </p>
                <p>
                  <strong className="text-slate-800">Reason:</strong> {reviewingLeave.reason}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('Approved')}
                    className={`py-2 rounded-lg border font-semibold flex items-center justify-center gap-1.5 ${
                      reviewAction === 'Approved'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('Rejected')}
                    className={`py-2 rounded-lg border font-semibold flex items-center justify-center gap-1.5 ${
                      reviewAction === 'Rejected'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Review Comments</label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Notes for staff record..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingLeave(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Commit Decision &amp; Log Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
