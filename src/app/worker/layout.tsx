'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen flex flex-col font-sans overflow-x-hidden pb-24">
      {/* Mobile Top Header */}
      <header className="bg-white border-b border-outline-variant px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <span className="font-bold text-lg text-primary tracking-tight">SiteTrack Mobile</span>
        <button
          onClick={handleLogout}
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Logout
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col p-6 max-w-md mx-auto w-full">{children}</main>

      {/* Bottom Nav Bar (Mobile View) */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-outline-variant shadow-lg flex justify-around items-center px-2 py-2 pb-safe z-50">
        {/* Home */}
        <Link
          href="/worker/home"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 tap-highlight-none transition-all ${
            pathname === '/worker/home' ? 'bg-[#d5e0f7] text-[#0d1c32] font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[10px] mt-0.5">Home</span>
        </Link>

        {/* History */}
        <Link
          href="/worker/history"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 tap-highlight-none transition-all ${
            pathname === '/worker/history' ? 'bg-[#d5e0f7] text-[#0d1c32] font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">history</span>
          <span className="text-[10px] mt-0.5">History</span>
        </Link>

        {/* Payslips */}
        <Link
          href="/worker/payslip"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 tap-highlight-none transition-all ${
            pathname === '/worker/payslip' ? 'bg-[#d5e0f7] text-[#0d1c32] font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">receipt_long</span>
          <span className="text-[10px] mt-0.5">Payslips</span>
        </Link>
      </nav>
    </div>
  );
}
