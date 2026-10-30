'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useProject } from '@/lib/project-context';
import { fetchWithCache } from '@/lib/swr-cache';

// Dynamically import heavy CCTV & AI models so Dashboard loads in 50ms instead of seconds
const CCTVFeed = dynamic(() => import('@/components/CCTVFeed'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-3 border border-outline-variant/30">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-slate-300">Loading AI CCTV Stream...</span>
    </div>
  ),
});

interface Worker {
  id: string;
  name: string;
  status: string;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const { selectedProject } = useProject();
  const [activeWorkersCount, setActiveWorkersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [laborBudgetSpent, setLaborBudgetSpent] = useState(0);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const role = (session?.user as any)?.role || 'SUPERVISOR';

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch active workers (cached 8s)
      fetchWithCache<any[]>('/api/workers', 8000)
        .then((data) => {
          if (Array.isArray(data)) {
            const filtered = selectedProject
              ? data.filter((w) => w.status === 'ACTIVE' && w.projectId === selectedProject.id)
              : data.filter((w) => w.status === 'ACTIVE');
            setActiveWorkersCount(filtered.length);
          } else {
            setActiveWorkersCount(0);
          }
        })
        .catch(() => setActiveWorkersCount(0));

      // 2. Fetch live fraud & safety alerts (cached 6s)
      fetchWithCache<any>('/api/fraud-alerts', 6000)
        .then((data) => {
          if (data?.alerts && Array.isArray(data.alerts)) {
            const active = data.alerts.filter((a: any) => {
              const isPending = a.status === 'PENDING' || a.status === 'INVESTIGATING';
              if (!isPending) return false;
              if (selectedProject) return a.worker?.projectId === selectedProject.id;
              return true;
            });
            setActiveAlertsCount(active.length);
          } else if (data?.stats) {
            setActiveAlertsCount(data.stats.pending + data.stats.investigating);
          } else {
            setActiveAlertsCount(0);
          }
        })
        .catch(() => setActiveAlertsCount(0));

      // 3. Fetch count of pending tasks for this project (cached 10s)
      const taskUrl = selectedProject ? `/api/tasks?projectId=${selectedProject.id}` : '/api/tasks';
      fetchWithCache<any[]>(taskUrl, 10000)
        .then((data) => {
          if (Array.isArray(data)) {
            setTasksCount(data.filter((t) => t.status === 'PENDING').length);
          } else {
            setTasksCount(0);
          }
        })
        .catch(() => setTasksCount(0));

      // 4. Fetch recent attendance activity & compute real hours worked today (cached 6s)
      const attUrl = selectedProject ? `/api/attendance?projectId=${selectedProject.id}` : '/api/attendance';
      fetchWithCache<any[]>(attUrl, 6000)
        .then((data) => {
          if (Array.isArray(data)) {
            setRecentLogs(data.slice(0, 5));
            const todayStr = new Date().toDateString();
            const todayLogs = data.filter((a: any) => new Date(a.date || a.checkInTime).toDateString() === todayStr);
            const hours = todayLogs.reduce((acc: number, a: any) => acc + (Number(a.hoursWorked) || 0), 0);
            setTotalHoursToday(hours);
          } else {
            setRecentLogs([]);
            setTotalHoursToday(0);
          }
        })
        .catch(() => {
          setRecentLogs([]);
          setTotalHoursToday(0);
        });

      // 5. Fetch labor budget disbursed for this project (cached 15s)
      const payUrl = selectedProject ? `/api/payments?projectId=${selectedProject.id}` : '/api/payments';
      fetchWithCache<any[]>(payUrl, 15000)
        .then((data) => {
          if (Array.isArray(data)) {
            const total = data
              .filter((p: any) => p.status === 'SUCCESS')
              .reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
            setLaborBudgetSpent(total);
          } else {
            setLaborBudgetSpent(0);
          }
        })
        .catch(() => setLaborBudgetSpent(0));
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProject]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Mission Control</h1>
        <p className="text-sm md:text-base text-on-surface-variant mt-1">
          {selectedProject ? <>Project: <span className="font-bold text-on-surface">{selectedProject.name}</span></> : 'Real-time construction workforce metrics.'}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Active Workers */}
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active Workers</p>
              <h3 className="text-3xl font-bold text-on-surface mt-2">{activeWorkersCount}</h3>
            </div>
            <div className="p-3 bg-secondary-container text-on-secondary-container rounded-lg">
              <span className="material-symbols-outlined text-[24px]">groups</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#008000] text-[16px] fill">trending_up</span>
            <span className="text-[#008000] font-bold">{activeWorkersCount} active</span> {activeWorkersCount > 0 ? 'assigned to project' : 'clean state'}
          </p>
        </div>

        {/* Metric 2: Total Hours Today */}
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Hours Today</p>
              <h3 className="text-3xl font-bold text-on-surface mt-2">{totalHoursToday.toFixed(1)} hr</h3>
            </div>
            <div className="p-3 bg-[#ffddb8] text-[#2a1700] rounded-lg">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#008000] text-[16px] fill">schedule</span>
            <span className="text-[#008000] font-bold">{totalHoursToday.toFixed(1)} hr</span> logged today
          </p>
        </div>

        {/* Metric 3: Labor Budget Spent / Tasks */}
        {role === 'ADMIN' ? (
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Labor Budget Spent</p>
                <h3 className="text-3xl font-bold text-on-surface mt-2">₹{laborBudgetSpent.toLocaleString('en-IN')}</h3>
              </div>
              <div className="p-3 bg-[#d5e0f7] text-[#0d1c32] rounded-lg">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">show_chart</span>
              {laborBudgetSpent > 0 ? 'Disbursed via automated payout' : '₹0 disbursed (Fresh state)'}
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pending Site Tasks</p>
                <h3 className="text-3xl font-bold text-on-surface mt-2">{tasksCount}</h3>
              </div>
              <div className="p-3 bg-[#d5e0f7] text-[#0d1c32] rounded-lg">
                <span className="material-symbols-outlined text-[24px]">checklist</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">assignment_turned_in</span>
              {tasksCount > 0 ? 'Need supervisor follow-up' : 'All daily tasks clear'}
            </p>
          </div>
        )}

        {/* Metric 4: Active Alerts */}
        {role === 'ADMIN' ? (
          <Link
            href="/admin/fraud-alerts"
            className="block bg-surface-container-lowest border border-outline-variant hover:border-red-300 transition-all p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] group cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider group-hover:underline">
                  Active Alerts
                </p>
                <h3 className="text-3xl font-bold text-[#ba1a1a] mt-2">{activeAlertsCount}</h3>
              </div>
              <div className="p-3 bg-[#ffdad6] text-[#93000a] rounded-lg group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
            </div>
            <p className="text-xs text-[#ba1a1a] mt-4 flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-[16px]">{activeAlertsCount > 0 ? 'error' : 'verified_user'}</span>
              {activeAlertsCount > 0 ? `${activeAlertsCount} anomalies require review` : 'All sites in compliance (0 alerts)'}
            </p>
          </Link>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Daily Reminders</p>
                <h3 className="text-3xl font-bold text-on-surface mt-2">1</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg">
                <span className="material-symbols-outlined text-[24px]">notifications_active</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
              Site check sheets complete
            </p>
          </div>
        )}
      </div>


      {/* Main Charts & Camera Feeds Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: CCTV Quick stream */}
        <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#008000] animate-pulse"></span>
              <h3 className="text-base font-bold text-primary">Main Entrance CCTV Stream</h3>
            </div>
            <Link
              href="/admin/monitoring"
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              All Channels <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
          <CCTVFeed
            cameraName="GATE 1 - MAIN ENTRANCE"
            projectId={selectedProject?.id}
            onAttendanceUpdated={fetchDashboardData}
          />

        </div>

        {/* Right Column: Real-time Attendance Activity Log */}
        <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] p-6 flex flex-col">
          <h3 className="text-base font-bold text-primary border-b border-outline-variant pb-4 mb-4 flex items-center justify-between">
            <span>Recent Activity</span>
            <span className="text-xs font-normal text-on-surface-variant font-mono">Live Sync</span>
          </h3>
          <div className="space-y-4 flex-1">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No recent check-ins recorded yet today.</p>
            ) : (
              recentLogs.map((log) => {
                const timeStr = new Date(log.checkInTime).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isCheckedOut = !!log.checkOutTime;

                return (
                  <div key={log.id} className="flex items-center gap-3 pb-3 border-b border-outline-variant/30 last:border-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isCheckedOut ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isCheckedOut ? 'logout' : 'login'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {log.worker.name} {isCheckedOut ? 'checked OUT' : 'checked IN'}
                      </p>
                      <p className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <span className="font-mono">{timeStr}</span> •{' '}
                        <span className="font-bold">
                          {log.manualBackup ? 'Manual' : 'CCTV Face ID'}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
