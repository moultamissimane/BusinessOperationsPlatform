import React, { useState } from 'react';
import { Building2, Lock, Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Mode = 'login' | 'forgot' | 'reset';

// Demo accounts are seeded by the backend in development; shown only in `vite dev` builds as a convenience.
const DEMO_ACCOUNTS = [
  { label: 'Imane · Director', email: 'imane.b@workflow-erp.ma' },
  { label: 'Karim · Finance manager', email: 'karim.alami@workflow-erp.ma' },
  { label: 'Sara · HR', email: 'sara.t@workflow-erp.ma' },
  { label: 'Yassine · Engineer', email: 'yassine.m@workflow-erp.ma' },
];

const readResetLink = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset');
  const email = params.get('email');
  return token && email ? { token, email } : null;
};

const inputClass =
  'w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden';

export const LoginView: React.FC = () => {
  const { login, forgotPassword, resetPassword } = useAuth();
  const resetLink = readResetLink();

  const [mode, setMode] = useState<Mode>(resetLink ? 'reset' : 'login');
  const [email, setEmail] = useState(resetLink?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      run(() => login(email, password));
    } else if (mode === 'forgot') {
      run(async () => {
        await forgotPassword(email);
        setNotice('If that address belongs to an account, a reset link is on its way. It expires in 30 minutes.');
        setMode('login');
      });
    } else if (resetLink) {
      run(async () => {
        await resetPassword(resetLink.email, resetLink.token, password);
        window.history.replaceState({}, '', window.location.pathname);
        setPassword('');
        setNotice('Password updated. Sign in with your new password.');
        setMode('login');
      });
    }
  };

  const title = mode === 'login' ? 'Sign in to WorkFlow ERP' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">WorkFlow ERP</span>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-base font-bold text-slate-900">{title}</h1>
            {mode === 'forgot' && <p className="text-xs text-slate-500 mt-1">Enter your work email and we'll send you a reset link.</p>}
            {mode === 'reset' && <p className="text-xs text-slate-500 mt-1">For {resetLink?.email}. At least 8 characters, with a letter and a digit.</p>}
          </div>

          {notice && (
            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {mode !== 'reset' && (
            <label className="block text-xs font-semibold text-slate-700">
              Work email
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="email" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.ma" />
              </div>
            </label>
          )}

          {mode !== 'forgot' && (
            <label className="block text-xs font-semibold text-slate-700">
              {mode === 'reset' ? 'New password' : 'Password'}
              <div className="relative mt-1">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={mode === 'reset' ? 8 : undefined}
                  autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </label>
          )}

          <button type="submit" disabled={busy} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
          </button>

          {mode === 'login' && (
            <button type="button" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }} className="w-full text-xs text-indigo-600 hover:underline">
              Forgot your password?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => { setMode('login'); setError(null); }} className="w-full text-xs text-slate-500 hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </button>
          )}
        </form>

        {import.meta.env.DEV && mode === 'login' && (
          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-400 mb-2">Demo accounts (development only) — password Password123!</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword('Password123!'); }} className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
