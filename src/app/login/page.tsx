'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Worker'); // Match visual default
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(false);

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
        router.replace('/worker/home'); // Default fallback
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex items-center justify-center p-4 md:p-12">
      {/* Login Card */}
      <main className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl custom-shadow flex flex-col overflow-hidden">
        {/* Header / Logo Area */}
        <div className="px-6 pt-10 pb-6 flex flex-col items-center border-b border-surface-container-highest bg-surface">
          <div className="w-20 h-20 bg-primary-container rounded-lg flex items-center justify-center mb-6 text-on-primary shadow-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '40px', fontVariationSettings: "'FILL' 1" }}>
              business
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight text-center">SiteTrack</h1>
          <p className="text-sm md:text-base text-on-surface-variant mt-1 text-center">
            Sign in to your mission control.
          </p>
        </div>

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {error && (
            <div className="p-3 bg-error-container text-on-error-container text-sm rounded border border-error/20 flex gap-1 items-center">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Role Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider" htmlFor="role">
              Select Role
            </label>
            <div className="relative">
              <select
                className="appearance-none w-full bg-surface-container-low border border-outline-variant text-on-surface text-base rounded h-[48px] px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Administrator">Administrator</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Worker">Worker</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>

          {/* Email Input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider" htmlFor="email">
              Email Address
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant z-10 pointer-events-none">
                mail
              </span>
              <input
                className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-base rounded h-[48px] pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder-on-surface-variant/50 transition-all"
                id="email"
                name="email"
                placeholder="name@company.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider" htmlFor="password">
                Password
              </label>
              <a href="#" className="text-xs font-bold text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant z-10 pointer-events-none">
                lock
              </span>
              <input
                className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-base rounded h-[48px] pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder-on-surface-variant/50 transition-all"
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

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-low"
              id="remember-me"
              name="remember-me"
              type="checkbox"
            />
            <label className="ml-2 block text-sm text-on-surface" htmlFor="remember-me">
              Remember this device
            </label>
          </div>

          {/* Submit Button */}
          <button
            className="mt-1 w-full bg-primary-container text-on-primary h-[48px] rounded-lg font-bold uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-primary-container/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            type="submit"
            disabled={loading}
          >
            <span>{loading ? 'Logging in...' : 'Login'}</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>

        {/* Footer / Support */}
        <div className="px-6 py-3 bg-surface-container-lowest border-t border-surface-container-highest text-center">
          <p className="text-xs font-bold text-on-surface-variant">
            Need access?{' '}
            <a className="text-primary hover:underline font-bold" href="#">
              Contact IT Support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
