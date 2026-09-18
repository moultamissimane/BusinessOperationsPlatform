import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { changePassword } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <h3 className="text-sm font-bold text-slate-900">Change password</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        {done ? (
          <div className="p-5 space-y-3 text-xs">
            <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              Password changed. Your other devices have been signed out.
            </p>
            <button type="button" onClick={onClose} className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3 text-xs">
            {error && (
              <p role="alert" className="text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {error}
              </p>
            )}
            <label className="block font-semibold text-slate-700">
              Current password
              <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block font-semibold text-slate-700">
              New password
              <input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${field} mt-1`} />
              <span className="font-normal text-slate-400">At least 8 characters, with a letter and a digit.</span>
            </label>
            <label className="block font-semibold text-slate-700">
              Confirm new password
              <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${field} mt-1`} />
            </label>
            <button type="submit" disabled={busy} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update password
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
