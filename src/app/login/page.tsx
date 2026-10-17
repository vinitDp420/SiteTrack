'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface DemoAccount {
  role: string;
  label: string;
  email: string;
  password: string;
  icon: string;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'Supervisor',
    label: 'Supervisor',
    email: 'supervisor@sitetrack.com',
    password: 'Supervisor@123',
    icon: 'engineering',
    description: 'On-site supervisory & daily shift control',
  },
  {
    role: 'Worker',
    label: 'Worker',
    email: 'worker@sitetrack.com',
    password: 'Worker@123',
    icon: 'construction',
    description: 'Mobile attendance, shifts & instant payouts',
  },
  {
    role: 'Administrator',
    label: 'Administrator',
    email: 'admin@sitetrack.com',
    password: 'Admin@123',
    icon: 'shield_person',
    description: 'Full organization oversight & financial approvals',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('supervisor@sitetrack.com');
  const [password, setPassword] = useState('Supervisor@123');
  const [role, setRole] = useState('Supervisor');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyDemoAccount = (account: DemoAccount) => {
    setRole(account.role);
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  const handleRoleDropdown = (selectedRole: string) => {
    setRole(selectedRole);
    const found = DEMO_ACCOUNTS.find((a) => a.role === selectedRole);
    if (found) {
      setEmail(found.email);
      setPassword(found.password);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Fetch the updated session to get the user's role
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      const userRole = session?.user?.role;

      if (userRole === 'ADMIN' || userRole === 'SUPERVISOR') {
        router.replace('/admin/dashboard');
      } else if (userRole === 'WORKER') {
        router.replace('/worker/home');
      } else {
        router.replace('/worker/home');
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex items-center justify-center p-4 md:p-8">
      {/* Login Card */}
      <main className="w-full max-w-lg bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header / Logo Area */}
        <div className="px-6 pt-8 pb-5 flex flex-col items-center border-b border-slate-800/80 bg-slate-900/60">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl flex items-center justify-center mb-3 text-white shadow-lg shadow-cyan-500/20">
            <span className="material-symbols-outlined text-[36px]">
              domain
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight text-center">SiteTrack</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 text-center font-medium">
            Next-Gen AI Construction & Workforce Portal
          </p>
        </div>

        {/* Quick Role Fill Badges */}
        <div className="px-6 pt-5 pb-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            One-Click Demo Roles
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const active = role === acc.role;
              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => applyDemoAccount(acc)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-center transition-all ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] mb-1">
                    {acc.icon}
                  </span>
                  <span className="text-xs font-semibold">{acc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs rounded-xl flex gap-2 items-center">
              <span className="material-symbols-outlined text-[18px] text-red-400">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Role Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="role">
              Active Role Profile
            </label>
            <div className="relative">
              <select
                className="appearance-none w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl h-[44px] px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium"
                id="role"
                name="role"
                value={role}
                onChange={(e) => handleRoleDropdown(e.target.value)}
              >
                <option value="Supervisor">Supervisor (Site Operations)</option>
                <option value="Worker">Worker (Mobile Shift & Attendance)</option>
                <option value="Administrator">Administrator (Executive & Financial)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>

          {/* Email / Username Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="email">
              Email, Username or Phone
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px] pointer-events-none">
                person
              </span>
              <input
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl h-[44px] pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder-slate-600 transition-all font-medium"
                id="email"
                name="email"
                placeholder="e.g. supervisor@sitetrack.com or supervisor"
                required
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="password">
                Password
              </label>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px] pointer-events-none">
                lock
              </span>
              <input
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl h-[44px] pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder-slate-600 transition-all font-mono text-sm"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="mt-2 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-[46px] rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-cyan-600/20"
            type="submit"
            disabled={loading}
          >
            <span>{loading ? 'Authenticating...' : `Sign In as ${role}`}</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>

        {/* Credentials Reference Footnote */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 text-left">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Verified Test Credentials:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
              <span className="text-cyan-400 font-bold block">Supervisor</span>
              <span className="text-slate-400 text-[10px] block truncate">supervisor@sitetrack.com</span>
              <span className="text-slate-300 font-mono text-[10px]">Supervisor@123</span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
              <span className="text-emerald-400 font-bold block">Worker</span>
              <span className="text-slate-400 text-[10px] block truncate">worker@sitetrack.com</span>
              <span className="text-slate-300 font-mono text-[10px]">Worker@123</span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
              <span className="text-indigo-400 font-bold block">Admin</span>
              <span className="text-slate-400 text-[10px] block truncate">admin@sitetrack.com</span>
              <span className="text-slate-300 font-mono text-[10px]">Admin@123</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
