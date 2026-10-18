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
    id: string;
    name: string;
    phone: string;
    wageRate: number;
    paymentType: string;
  };
  project: {
    id: string;
    name: string;
  };
}

interface WorkerOption {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  paymentType: string;
  status: string;
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AttendancePage() {
  const { selectedProject } = useProject();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Manual Attendance Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shiftPreset, setShiftPreset] = useState<'FULL_9' | 'FULL_8' | 'HALF_4' | 'CHECKIN_ONLY' | 'CUSTOM'>('FULL_9');
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');
  const [supervisorNote, setSupervisorNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

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

  const fetchWorkers = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/workers?projectId=${selectedProject.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const activeList = data.filter((w) => w.status === 'ACTIVE');
        setWorkers(activeList);
        if (activeList.length > 0 && !selectedWorkerId) {
          setSelectedWorkerId(activeList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchAttendance();
      fetchWorkers();
    }
  }, [selectedProject]);

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

  const calculateShiftHours = () => {
    if (shiftPreset === 'CHECKIN_ONLY' || !checkOutTime) return null;
    const [inH, inM] = checkInTime.split(':').map(Number);
    const [outH, outM] = checkOutTime.split(':').map(Number);
    const startMinutes = inH * 60 + inM;
    const endMinutes = outH * 60 + outM;
    if (endMinutes <= startMinutes) return 0;
    return parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
  };

  const applyPreset = (preset: 'FULL_9' | 'FULL_8' | 'HALF_4' | 'CHECKIN_ONLY' | 'CUSTOM') => {
    setShiftPreset(preset);
    switch (preset) {
      case 'FULL_9':
        setCheckInTime('09:00');
        setCheckOutTime('18:00');
        break;
      case 'FULL_8':
        setCheckInTime('09:00');
        setCheckOutTime('17:00');
        break;
      case 'HALF_4':
        setCheckInTime('09:00');
        setCheckOutTime('13:30');
        break;
      case 'CHECKIN_ONLY':
        setCheckInTime('09:00');
        setCheckOutTime('');
        break;
      case 'CUSTOM':
        // Keep current values
        break;
    }
  };

  const openManualModal = () => {
    if (workers.length > 0 && !selectedWorkerId) {
      setSelectedWorkerId(workers[0].id);
    }
    setShiftDate(new Date().toISOString().split('T')[0]);
    applyPreset('FULL_9');
    setSupervisorNote('');
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async () => {
    if (!selectedWorkerId) {
      showToast('Please select a worker.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const inDateTime = new Date(`${shiftDate}T${checkInTime}:00`);
      let outDateTime: Date | null = null;
      let hoursWorked: number | null = null;

      if (shiftPreset !== 'CHECKIN_ONLY' && checkOutTime) {
        outDateTime = new Date(`${shiftDate}T${checkOutTime}:00`);
        if (outDateTime.getTime() <= inDateTime.getTime()) {
          showToast('Check-out time must be after check-in time.', 'error');
          setIsSubmitting(false);
          return;
        }
        hoursWorked = calculateShiftHours();
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          projectId: selectedProject?.id,
          date: shiftDate,
          checkInTime: inDateTime.toISOString(),
          checkOutTime: outDateTime ? outDateTime.toISOString() : null,
          hoursWorked,
          status: outDateTime ? (hoursWorked && hoursWorked >= 7 ? 'PRESENT' : 'HALF_DAY') : 'ON_SITE',
          manualBackup: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Manual attendance recorded successfully!', 'success');
        setIsManualModalOpen(false);
        fetchAttendance();
      } else {
        showToast(data.error || 'Failed to record manual attendance.', 'error');
      }
    } catch {
      showToast('Network error while saving attendance.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickClockOut = async (logId: string, workerName: string) => {
    if (!confirm(`Clock out ${workerName} for today's shift?`)) return;
    setClockingOutId(logId);
    try {
      const res = await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: logId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${workerName} clocked out successfully (${data.session?.hoursWorked || 'Shift'} hrs recorded).`, 'success');
        fetchAttendance();
      } else {
        showToast(data.error || 'Failed to clock out worker.', 'error');
      }
    } catch {
      showToast('Network error while clocking out.', 'error');
    } finally {
      setClockingOutId(null);
    }
  };

  const selectedWorkerDetails = workers.find((w) => w.id === selectedWorkerId);
  const hours = calculateShiftHours();

  const filteredLogs = logs.filter(
    (log) =>
      log.worker.name.toLowerCase().includes(search.toLowerCase()) ||
      log.worker.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-xl border ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-white border-emerald-500'
              : 'bg-red-950 text-white border-red-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-cyan-400">
              {toast.type === 'success' ? 'verified' : 'error'}
            </span>
            <span className="font-semibold">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-white/80 hover:text-white ml-4">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">Attendance Register</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              AI + Manual Fallback
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject ? (
              <>Daily presence log and shift verification for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            ) : (
              'Select a project to view and record workforce attendance.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* PRIMARY BUTTON: MARK ATTENDANCE MANUALLY */}
          <button
            onClick={openManualModal}
            disabled={!selectedProject || workers.length === 0}
            className="h-[42px] px-4 bg-gradient-to-r from-primary to-[#1a3a6e] hover:opacity-95 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            <span>+ Mark Attendance Manually</span>
          </button>

          <button
            onClick={fetchAttendance}
            className="h-[42px] px-3 border border-outline-variant rounded-xl hover:bg-surface-variant transition flex items-center justify-center shadow-sm bg-white"
            title="Refresh Logs"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">refresh</span>
          </button>
        </div>
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
              <p className="text-xs text-on-surface-variant mt-1">
                Click &ldquo;+ Mark Attendance Manually&rdquo; to add a paper register or manual shift entry.
              </p>
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
                      {log.hoursWorked ? `${log.hoursWorked} hrs` : (
                        <span className="text-amber-600 animate-pulse font-bold">On Site (Active)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Verification Badge & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-2 border-t md:border-t-0 border-outline-variant/30 pt-3 md:pt-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                      log.manualBackup
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {log.manualBackup ? 'fingerprint' : 'photo_camera'}
                    </span>
                    {log.manualBackup ? 'Manual Verification' : 'CCTV Face ID'}
                  </span>

                  {/* Quick Clock Out Button if Active On-Site */}
                  {!log.checkOutTime && (
                    <button
                      onClick={() => handleQuickClockOut(log.id, log.worker.name)}
                      disabled={clockingOutId === log.id}
                      className="px-3 py-1.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1 disabled:opacity-50"
                      title="Clock out this worker now"
                    >
                      <span className="material-symbols-outlined text-[14px]">logout</span>
                      <span>{clockingOutId === log.id ? 'Saving...' : 'Clock Out'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==== MODAL: MARK ATTENDANCE MANUALLY ==== */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-[#0d1c32] to-[#1a3a6e] text-white p-6 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                  <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Mark Attendance Manually</h3>
                  <p className="text-[11px] text-cyan-200/80 font-mono">
                    Manual supervisor check-in & shift completion override
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Select Worker */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Select Worker *
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {INR(w.wageRate)}/d ({w.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Date */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Shift Date *
                </label>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold font-mono"
                />
              </div>

              {/* Preset Shift Modes */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Shift Preset / Mode
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'FULL_9', label: 'Full (9h)', time: '09:00 - 18:00' },
                    { id: 'FULL_8', label: 'Standard (8h)', time: '09:00 - 17:00' },
                    { id: 'HALF_4', label: 'Half Day (4.5h)', time: '09:00 - 13:30' },
                    { id: 'CHECKIN_ONLY', label: 'Check-In Only', time: 'Active On Site' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id as any)}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        shiftPreset === preset.id
                          ? 'bg-[#0d1c32] text-white border-[#0d1c32] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <p className="text-xs font-extrabold">{preset.label}</p>
                      <p className="text-[10px] opacity-75 mt-0.5 font-mono">{preset.time}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Check-In Time *
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => {
                      setCheckInTime(e.target.value);
                      setShiftPreset('CUSTOM');
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="time"
                    disabled={shiftPreset === 'CHECKIN_ONLY'}
                    value={checkOutTime}
                    onChange={(e) => {
                      setCheckOutTime(e.target.value);
                      setShiftPreset('CUSTOM');
                    }}
                    placeholder="--:--"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono font-bold disabled:bg-slate-100 disabled:opacity-50"
                  />
                </div>

                {/* Duration Summary */}
                <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Calculated Shift Hours:</span>
                  <span className="font-mono font-black text-primary text-sm">
                    {shiftPreset === 'CHECKIN_ONLY' ? (
                      <span className="text-amber-600">Active Shift (No checkout)</span>
                    ) : hours !== null ? (
                      <span className="text-emerald-700">{hours} Hours</span>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              {/* Supervisor Remarks */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Supervisor Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CCTV blindspot override / Verified from site muster roll"
                  value={supervisorNote}
                  onChange={(e) => setSupervisorNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Audit Badge Preview */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                <span className="material-symbols-outlined text-[18px] text-amber-700">verified</span>
                <span>
                  This record will be flagged with <strong>Manual Verification</strong> for full audit transparency.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant bg-white text-on-surface hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={isSubmitting || !selectedWorkerId}
                className="px-5 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 shadow transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Saving Attendance...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save Attendance Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
