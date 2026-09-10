'use client';

import React, { useEffect, useState } from 'react';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useProject } from '@/lib/project-context';
import CCTVFeed from '@/components/CCTVFeed';



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
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const role = (session?.user as any)?.role || 'SUPERVISOR';

  const fetchDashboardData = () => {
    // Fetch count of active workers
    fetch('/api/workers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setActiveWorkersCount(data.filter((w) => w.status === 'ACTIVE').length);
        }
      })
      .catch((e) => console.error(e));

    // Fetch count of tasks
    if (selectedProject) {
      fetch(`/api/tasks?projectId=${selectedProject.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTasksCount(data.filter((t) => t.status === 'PENDING').length);
          }
        })
        .catch((e) => console.error(e));

      // Fetch recent attendance activity
      fetch(`/api/attendance?projectId=${selectedProject.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setRecentLogs(data.slice(0, 5));
          }
        })
        .catch((e) => console.error(e));
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
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active Workers</p>
              <h3 className="text-3xl font-bold text-on-surface mt-2">{activeWorkersCount || 3}</h3>
            </div>
            <div className="p-3 bg-secondary-container text-on-secondary-container rounded-lg">
              <span className="material-symbols-outlined text-[24px]">groups</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#008000] text-[16px] fill">trending_up</span>
            <span className="text-[#008000] font-bold">+12%</span> vs yesterday
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Hours Today</p>
              <h3 className="text-3xl font-bold text-on-surface mt-2">24.5 hr</h3>
            </div>
            <div className="p-3 bg-[#ffddb8] text-[#2a1700] rounded-lg">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#008000] text-[16px] fill">trending_up</span>
            <span className="text-[#008000] font-bold">+8 hr</span> vs target
          </p>
        </div>

        {/* Metric 3 */}
        {role === 'ADMIN' ? (
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Labor Budget Spent</p>
                <h3 className="text-3xl font-bold text-on-surface mt-2">₹57,420</h3>
              </div>
              <div className="p-3 bg-[#d5e0f7] text-[#0d1c32] rounded-lg">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">show_chart</span>
              On track with estimates
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
              Need supervisor follow-up
            </p>
          </div>
        )}

        {/* Metric 4 */}
        {role === 'ADMIN' ? (
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider">Active Alerts</p>
                <h3 className="text-3xl font-bold text-[#ba1a1a] mt-2">1</h3>
              </div>
              <div className="p-3 bg-[#ffdad6] text-[#93000a] rounded-lg">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
            </div>
            <p className="text-xs text-[#ba1a1a] mt-4 flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              1 mismatch flagged at Gate 1
            </p>
          </div>
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
            defaultWorkerName="Vinit Patil"
            defaultConfidence="98.4%"
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
