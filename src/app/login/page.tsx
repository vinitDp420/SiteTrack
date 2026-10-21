'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  HardHat,
  Users,
  Shield,
  Check,
} from 'lucide-react';

type RoleKey = 'Supervisor' | 'Worker' | 'Administrator';

interface DemoAccount {
  role: RoleKey;
  label: string;
  email: string;
  password: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'Supervisor',
    label: 'Supervisor',
    badge: 'Site Operations',
    email: 'supervisor@sitetrack.com',
    password: 'Supervisor@123',
    icon: HardHat,
  },
  {
    role: 'Worker',
    label: 'Worker',
    badge: 'Mobile Field',
    email: 'worker@sitetrack.com',
    password: 'Worker@123',
    icon: Users,
  },
  {
    role: 'Administrator',
    label: 'Admin',
    badge: 'Executive',
    email: 'admin@sitetrack.com',
    password: 'Admin@123',
    icon: Shield,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleKey>('Supervisor');
  const [email, setEmail] = useState('supervisor@sitetrack.com');
  const [password, setPassword] = useState('Supervisor@123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (account: DemoAccount) => {
    setSelectedRole(account.role);
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password: password.trim(),
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
        router.replace('/admin/dashboard');
      }
    } catch (err: any) {
      setError('Unable to connect to the authentication service. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 antialiased font-sans">
      
      {/* Top Simple Brand Bar */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                SiteTrack
              </span>
              <span className="text-xs text-slate-500 font-medium ml-2 hidden sm:inline">
                Construction Management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Operational
            </span>
          </div>
        </div>
      </header>

      {/* Main Centered Login Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[440px]">
          
          {/* Card Container */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] p-6 sm:p-8">
            
            {/* Header */}
            <div className="text-center mb-7">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Select your role or enter your credentials below
              </p>
            </div>

            {/* Clean Segmented Role Switcher */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Quick Role Selection
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isActive = selectedRole === acc.role;
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleRoleSelect(acc)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                      <span>{acc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Sign in error</p>
                  <p className="text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email / Username Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-10 pl-9 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Default: {selectedRole}@123
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Demo Accounts Reference Table */}
            <div className="mt-8 pt-5 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                Demo Accounts
              </p>
              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isCurrent = selectedRole === acc.role;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleRoleSelect(acc)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50/60 border-blue-200/80 text-blue-900'
                          : 'bg-slate-50/60 border-slate-200/60 text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isCurrent ? 'bg-blue-600' : 'bg-slate-400'
                        }`} />
                        <span className="font-semibold text-slate-800">{acc.label}</span>
                        <span className="text-slate-500 text-[11px] truncate">({acc.email})</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 shrink-0 ml-2">
                        <span>{acc.password}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 ml-1" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Simple Bottom Info */}
          <div className="text-center mt-6 text-xs text-slate-400 space-y-1">
            <p>Protected by SiteTrack Security Protocols</p>
            <p className="text-slate-400/80">© {new Date().getFullYear()} SiteTrack Construction Systems</p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 py-3.5 px-6 text-center text-xs text-slate-400 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SiteTrack Platform</span>
          <div className="flex items-center gap-4 text-slate-500">
            <a href="#" className="hover:text-slate-700 transition-colors">Documentation</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-700 transition-colors">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-700 transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
