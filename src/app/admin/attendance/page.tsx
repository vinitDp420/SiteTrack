'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

interface AttendanceLog {
  id: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  manualBackup: boolean;
  hoursWorked: number | null;
  worker: {
    name: string;
    phone: string;
    wageRate: number;
    paymentType: string;
  };
  project: {
    name: string;
  };
}

export default function AttendancePage() {
  const { selectedProject } = useProject();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selectedProject) {
      fetchAttendance();
    }
  }, [selectedProject]);

  const fetchAttendance = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?projectId=${selectedProject.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.worker.name.toLowerCase().includes(search.toLowerCase()) ||
      log.worker.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Attendance Log</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject ? (
              <>Daily presence register for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            ) : (
              'Select a project to view attendance.'
            )}
          </p>
        </div>
        <button
          onClick={fetchAttendance}
          className="p-2.5 border border-outline-variant rounded-xl hover:bg-surface-variant transition flex items-center justify-center shadow-sm"
          title="Refresh Logs"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by worker name or phone number..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition shadow-sm"
          />
        </div>
      </div>

      {/* Attendance List */}
      {loading ? (
        <div className="text-center py-10 font-bold text-on-surface-variant">Loading attendance logs...</div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-outline-variant rounded-2xl p-10 text-center shadow-sm">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">badge</span>
              <p className="text-sm font-bold text-on-surface-variant mt-2">No matching logs found.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-outline-variant/60 rounded-2xl p-5 shadow-[0_2px_12px_rgba(13,28,50,0.04)] hover:shadow-[0_6px_20px_rgba(13,28,50,0.08)] hover:-translate-y-0.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Worker Avatar & Profile */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-black text-base shrink-0">
                    {log.worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-base">{log.worker.name}</h4>
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5">{log.worker.phone}</p>
                  </div>
                </div>

                {/* Clock Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-2xl px-2">
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Shift Date
                    </span>
                    <span className="text-sm text-on-background font-bold block mt-0.5">
                      {formatDate(log.checkInTime)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#008000] uppercase tracking-wider flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px] fill">login</span> Check In
                    </span>
                    <span className="text-sm text-[#008000] font-black block mt-0.5">
                      {formatTime(log.checkInTime)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px] fill">logout</span> Check Out
                    </span>
                    <span className="text-sm text-[#ba1a1a] font-black block mt-0.5">
                      {formatTime(log.checkOutTime)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Hours Worked
                    </span>
                    <span className="text-sm text-on-background font-black block mt-0.5">
                      {log.hoursWorked ? `${log.hoursWorked} hrs` : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Verification & Method Badge */}
                <div className="flex items-center justify-between md:justify-end border-t md:border-t-0 border-outline-variant/30 pt-3 md:pt-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                      log.manualBackup
                        ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {log.manualBackup ? 'fingerprint' : 'photo_camera'}
                    </span>
                    {log.manualBackup ? 'Manual Verification' : 'CCTV Face ID'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

