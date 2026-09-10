'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ProjectProvider, useProject } from '@/lib/project-context';

const navItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
  { name: 'Monitoring', href: '/admin/monitoring', icon: 'videocam' },
  { name: 'Workers', href: '/admin/workers', icon: 'groups' },
  { name: 'Schedule', href: '/admin/schedule', icon: 'calendar_today' },
  { name: 'BOQ', href: '/admin/boq', icon: 'list_alt' },
  { name: 'Daily Reports', href: '/admin/reports', icon: 'assignment' },
  { name: 'Daily Tasks', href: '/admin/tasks', icon: 'checklist' },
  { name: 'Procurement', href: '/admin/procurement', icon: 'shopping_cart' },
  { name: 'Assets', href: '/admin/assets', icon: 'construction' },
  { name: 'Reminders', href: '/admin/reminders', icon: 'notifications_active' },
  { name: 'Attendance', href: '/admin/attendance', icon: 'event_available' },
  { name: 'Payroll', href: '/admin/payroll', icon: 'payments' },
  { name: 'Payments', href: '/admin/payments', icon: 'account_balance' },
  { name: 'Fraud Alerts', href: '/admin/fraud-alerts', icon: 'warning' },
];

function ProjectSelector() {
  const { projects, selectedProject, setSelectedProject } = useProject();
  const [open, setOpen] = useState(false);

  if (!selectedProject) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary-container/60 hover:bg-secondary-container border border-outline-variant px-3 py-2 rounded-xl text-sm font-bold text-on-secondary-container transition-all max-w-[220px]"
      >
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">domain</span>
        <span className="truncate">{selectedProject.name}</span>
        <span className="material-symbols-outlined text-[16px] shrink-0">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-outline-variant rounded-xl shadow-[0_8px_24px_rgba(13,28,50,0.15)] z-[200] overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-outline-variant bg-surface-container-low">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Select Active Project</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProject(p);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-surface-container-low border-b border-outline-variant/30 last:border-0 ${
                  selectedProject.id === p.id ? 'bg-secondary-container/40' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-primary mt-0.5 shrink-0">
                  {selectedProject.id === p.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-on-surface truncate">{p.name}</p>
                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                    Code: {p.code}
                    {p.location ? ` · ${p.location}` : ''}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      p.status === 'ACTIVE' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-slate-200 text-on-surface-variant'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close */}
      {open && (
        <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const role = (session?.user as any)?.role || 'SUPERVISOR';

  const filteredNavItems = navItems.filter((item) => {
    if (role === 'SUPERVISOR') {
      const restricted = ['/admin/boq', '/admin/payroll', '/admin/payments', '/admin/fraud-alerts'];
      return !restricted.includes(item.href);
    }
    return true;
  });

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row font-sans">
      {/* ===== TopNavBar (Mobile only) ===== */}
      <nav className="md:hidden w-full top-0 sticky bg-surface border-b border-outline-variant flex justify-between items-center px-4 py-3 z-40">
        <div className="text-xl font-bold text-primary tracking-tight">SiteTrack</div>
        <div className="flex items-center gap-4 text-primary">
          <span
            className="material-symbols-outlined cursor-pointer active:opacity-80"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[57px] left-0 w-full bg-surface border-b border-outline-variant z-40 p-3 flex flex-col gap-2 shadow-md max-h-[80vh] overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-4 px-3 py-2 h-[48px] rounded-lg transition-all ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                }`}
              >
                <span className={`material-symbols-outlined ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                <span className="text-sm font-bold uppercase tracking-wider">{item.name}</span>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-3 py-2 h-[48px] text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg w-full text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-bold uppercase tracking-wider">Logout</span>
          </button>
        </div>
      )}

      {/* ===== SideNavBar (Desktop only) ===== */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant p-3 z-40">
        {/* Logo / Brand */}
        <div className="px-3 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[28px]">construction</span>
            <div>
              <div className="text-base font-black text-primary tracking-tight leading-none">SiteTrack</div>
              <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Construction OS</div>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 mb-6 px-3 py-3 bg-surface-variant/40 rounded-xl border border-outline-variant/30">
          <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-black text-sm">
            {(session?.user?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-on-surface truncate">{session?.user?.name || 'Project Manager'}</div>
            <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              {(session?.user as any)?.role || 'SUPERVISOR'}
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 space-y-0.5 overflow-y-auto pr-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] duration-150 ${
                  isActive
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                <span className="text-sm font-bold tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Camera Clock-In CTA */}
        <button
          onClick={() => router.push('/admin/monitoring')}
          className="w-full bg-gradient-to-r from-[#b87500] to-[#e09800] text-white font-black text-sm h-[48px] rounded-xl mt-4 mb-4 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
        >
          <span className="material-symbols-outlined">videocam</span>
          Camera Clock In
        </button>

        {/* Footer Links */}
        <div className="space-y-0.5 pt-3 border-t border-outline-variant/30">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all rounded-xl w-full text-left"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="text-sm font-bold tracking-wide">Logout</span>
          </button>
        </div>
      </nav>

      {/* ===== Main Content Area ===== */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-0">
        {/* Top Bar (Desktop) - Project Selector & breadcrumbs */}
        <div className="hidden md:flex items-center justify-between px-8 py-3 bg-surface border-b border-outline-variant sticky top-0 z-30 gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">domain</span>
            <span>Active Project:</span>
          </div>
          <div className="flex items-center gap-3">
            <ProjectSelector />
            <div className="w-px h-6 bg-outline-variant" />
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary">notifications</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 py-2 pb-safe bg-surface border-t border-outline-variant shadow-lg z-50">
        <Link
          href="/admin/dashboard"
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl ${
            pathname === '/admin/dashboard' ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span className="text-[9px] mt-0.5">Home</span>
        </Link>
        <Link
          href="/admin/workers"
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl ${
            pathname.startsWith('/admin/workers') ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">groups</span>
          <span className="text-[9px] mt-0.5">Workers</span>
        </Link>
        <Link
          href="/admin/monitoring"
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl ${
            pathname.startsWith('/admin/monitoring') ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">videocam</span>
          <span className="text-[9px] mt-0.5">CCTV</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center text-on-surface-variant w-14 h-12 rounded-xl"
        >
          <span className="material-symbols-outlined text-[22px]">logout</span>
          <span className="text-[9px] mt-0.5">Logout</span>
        </button>
      </nav>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ProjectProvider>
  );
}
