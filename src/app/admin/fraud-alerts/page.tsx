'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useProject } from '@/lib/project-context';
import {
  ShieldAlert,
  HardHat,
  UserX,
  Fingerprint,
  MapPinOff,
  ScanFace,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Radar,
  PlusCircle,
  Trash2,
  XCircle,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  Building,
  User,
  Phone,
  IndianRupee,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  status: string;
  facePhotoUrl?: string | null;
  project?: {
    id: string;
    name: string;
    code: string;
  };
}

interface FraudAlertItem {
  id: string;
  workerId: string;
  worker: Worker;
  alertType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  details: string | null;
  createdAt: string;
}

interface AlertStats {
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  critical: number;
  ppeCount: number;
  ghostCount: number;
  buddyCount: number;
  geoCount: number;
  spoofCount: number;
}

export default function FraudAlertsPage() {
  const { selectedProject } = useProject();
  const [alerts, setAlerts] = useState<FraudAlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    pending: 0,
    investigating: 0,
    resolved: 0,
    dismissed: 0,
    critical: 0,
    ppeCount: 0,
    ghostCount: 0,
    buddyCount: 0,
    geoCount: 0,
    spoofCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'table'>('split');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Resolution modal
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    alert: FraudAlertItem | null;
    actionType: 'RESOLVE' | 'DISMISS' | 'INVESTIGATE';
    note: string;
  }>({
    open: false,
    alert: null,
    actionType: 'RESOLVE',
    note: '',
  });

  // New Alert simulation modal
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const [simWorkerId, setSimWorkerId] = useState('');
  const [simType, setSimType] = useState('PPE_VIOLATION');
  const [simSeverity, setSimSeverity] = useState('HIGH');
  const [simDetails, setSimDetails] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Audio Alert Ping states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevAlertCountRef = React.useRef<number>(0);

  // Web Audio Alert Sound Generator (Crisp Dual-Tone Warning Chime)
  const playAlertSound = (severity = 'HIGH') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (severity === 'CRITICAL' || severity === 'HIGH') {
        // High alert siren chime
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Soft notification ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio play prevented by browser policy:', e);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch alerts from API
  const fetchAlerts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const pid = selectedProject ? selectedProject.id : 'all';
      const res = await fetch(`/api/fraud-alerts?projectId=${pid}`);
      const data = await res.json();
      if (data.alerts && Array.isArray(data.alerts)) {
        // Trigger live audio chime if new alerts were logged while page is open
        if (prevAlertCountRef.current > 0 && data.alerts.length > prevAlertCountRef.current) {
          const newAlerts = data.alerts.slice(0, data.alerts.length - prevAlertCountRef.current);
          const topSev = newAlerts[0]?.severity || 'HIGH';
          playAlertSound(topSev);
          showToast(`🚨 New safety/fraud alert detected: ${newAlerts[0]?.alertType}`, 'error');
        }
        prevAlertCountRef.current = data.alerts.length;

        setAlerts(data.alerts);
        if (data.stats) setStats(data.stats);
        if (data.alerts.length > 0 && !selectedAlertId) {
          setSelectedAlertId(data.alerts[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching fraud alerts:', err);
      showToast('Failed to load fraud alerts', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-poll every 8s so live CCTV / Kiosk dispatches are caught immediately with audio ping
    const interval = setInterval(() => {
      fetchAlerts(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedProject]);

  // Load available workers for simulation modal
  useEffect(() => {
    if (selectedProject) {
      fetch(`/api/workers?projectId=${selectedProject.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableWorkers(data);
            if (data.length > 0 && !simWorkerId) {
              setSimWorkerId(data[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [selectedProject]);

  // Run AI Anomaly Detection Scan
  const handleRunScan = async () => {
    setScanning(true);
    try {
      const pid = selectedProject ? selectedProject.id : 'all';
      const res = await fetch('/api/fraud-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_anomalies',
          projectId: pid,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'AI Anomaly Scan completed successfully!', 'success');
        await fetchAlerts(true);
      } else {
        showToast(data.error || 'Anomaly scan failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error running scan', 'error');
    } finally {
      setScanning(false);
    }
  };

  // Update status (Investigate, Resolve, Dismiss)
  const handleConfirmAction = async () => {
    if (!actionModal.alert) return;
    const targetStatus =
      actionModal.actionType === 'RESOLVE'
        ? 'RESOLVED'
        : actionModal.actionType === 'DISMISS'
        ? 'DISMISSED'
        : 'INVESTIGATING';

    try {
      const res = await fetch('/api/fraud-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionModal.alert.id,
          status: targetStatus,
          resolutionNotes: actionModal.note.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast(`Incident marked as ${targetStatus.toLowerCase()}`, 'success');
        setActionModal({ open: false, alert: null, actionType: 'RESOLVE', note: '' });
        await fetchAlerts(true);
      } else {
        showToast('Failed to update incident', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating alert', 'error');
    }
  };

  // Create simulated incident
  const handleCreateSimulatedAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simWorkerId) {
      showToast('Please select a worker', 'error');
      return;
    }

    try {
      const defaultDesc =
        simDetails ||
        (simType === 'PPE_VIOLATION'
          ? 'Edge CCTV YOLO Stream: Worker missing safety hardhat in active hazard perimeter.'
          : simType === 'BUDDY_PUNCHING'
          ? 'Biometric Kiosk: Duplicate device scan registered within 12 seconds.'
          : simType === 'GHOST_WORKER'
          ? 'Worker checked in at gate, but zero spatial camera tracking pings recorded for 4+ hrs.'
          : simType === 'GEO_FENCE_BREACH'
          ? 'Mobile Clock-in coordinates deviated 2.1 km outside project fence boundary.'
          : 'Liveness test failed: 2D static phone display reflection detected during facial registration.');

      const res = await fetch('/api/fraud-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: simWorkerId,
          alertType: simType,
          severity: simSeverity,
          details: defaultDesc,
        }),
      });

      if (res.ok) {
        showToast('New anomaly logged successfully', 'success');
        setIsSimulateModalOpen(false);
        setSimDetails('');
        await fetchAlerts(true);
      } else {
        showToast('Failed to log anomaly', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating alert', 'error');
    }
  };

  // Delete alert
  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incident record?')) return;
    try {
      const res = await fetch(`/api/fraud-alerts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Alert removed', 'info');
        if (selectedAlertId === id) setSelectedAlertId(null);
        await fetchAlerts(true);
      }
    } catch (err) {
      showToast('Failed to delete alert', 'error');
    }
  };

  // Filtered alerts list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && a.alertType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const workerName = a.worker?.name?.toLowerCase() || '';
        const phone = a.worker?.phone || '';
        const details = a.details?.toLowerCase() || '';
        const typeStr = a.alertType.toLowerCase();
        if (!workerName.includes(q) && !phone.includes(q) && !details.includes(q) && !typeStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, statusFilter, severityFilter, typeFilter, searchQuery]);

  // Selected alert item
  const selectedAlert = useMemo(() => {
    if (selectedAlertId) {
      const found = alerts.find((a) => a.id === selectedAlertId);
      if (found) return found;
    }
    return filteredAlerts.length > 0 ? filteredAlerts[0] : null;
  }, [alerts, selectedAlertId, filteredAlerts]);

  // Helper for type metadata and proper Lucide icons
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'PPE_VIOLATION':
        return {
          label: 'PPE Safety Violation',
          badgeText: 'PPE Violation',
          icon: <HardHat className="w-5 h-5 text-amber-700" />,
          colorBg: 'bg-amber-50',
          colorBorder: 'border-amber-200',
          textColor: 'text-amber-800',
        };
      case 'GHOST_WORKER':
        return {
          label: 'Ghost Worker (Unobserved)',
          badgeText: 'Ghost Worker',
          icon: <UserX className="w-5 h-5 text-rose-700" />,
          colorBg: 'bg-rose-50',
          colorBorder: 'border-rose-200',
          textColor: 'text-rose-800',
        };
      case 'BUDDY_PUNCHING':
        return {
          label: 'Buddy Punching Flag',
          badgeText: 'Buddy Punching',
          icon: <Fingerprint className="w-5 h-5 text-purple-700" />,
          colorBg: 'bg-purple-50',
          colorBorder: 'border-purple-200',
          textColor: 'text-purple-800',
        };
      case 'GEO_FENCE_BREACH':
        return {
          label: 'Geofence Perimeter Breach',
          badgeText: 'Geofence Breach',
          icon: <MapPinOff className="w-5 h-5 text-blue-700" />,
          colorBg: 'bg-blue-50',
          colorBorder: 'border-blue-200',
          textColor: 'text-blue-800',
        };
      case 'BIOMETRIC_SPOOF':
        return {
          label: 'Biometric Anti-Spoof Fail',
          badgeText: 'Anti-Spoof Fail',
          icon: <ScanFace className="w-5 h-5 text-red-700" />,
          colorBg: 'bg-red-50',
          colorBorder: 'border-red-200',
          textColor: 'text-red-800',
        };
      default:
        return {
          label: type.replace(/_/g, ' '),
          badgeText: type.replace(/_/g, ' '),
          icon: <AlertTriangle className="w-5 h-5 text-slate-700" />,
          colorBg: 'bg-slate-50',
          colorBorder: 'border-slate-200',
          textColor: 'text-slate-800',
        };
    }
  };

  // Helper for severity badges
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 rounded-full text-[11px] font-black inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            LOW
          </span>
        );
    }
  };

  // Helper for status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-300/60 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Review
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="bg-blue-50 text-blue-800 border border-blue-300/60 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
            <Search className="w-3 h-3 text-blue-600" />
            Investigating
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300/60 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Resolved
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-slate-500" />
            Dismissed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-sm font-bold transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : toast.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          ) : toast.type === 'info' ? (
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">
              Fraud Alerts & Safety Anomalies
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200">
              AI SURVEILLANCE
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time biometric cross-correlation, spatial CCTV anti-ghosting checks, and automated PPE compliance scoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const nextState = !soundEnabled;
              setSoundEnabled(nextState);
              if (nextState) {
                setTimeout(() => playAlertSound('LOW'), 50);
                showToast('Alert sound notifications enabled', 'info');
              } else {
                showToast('Alert sound notifications muted', 'info');
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
            }`}
            title={soundEnabled ? 'Live Audio Alert Ping: Enabled' : 'Live Audio Alert Ping: Muted'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span className="hidden sm:inline">Sound ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Sound OFF</span>
              </>
            )}
          </button>

          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="px-4 py-2 bg-gradient-to-r from-primary to-[#1a3a6e] hover:opacity-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Radar className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning Anomaly Feeds...' : 'Run AI Anomaly Scan'}
          </button>

          <button
            onClick={() => setIsSimulateModalOpen(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-outline-variant text-on-surface rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-primary" />
            Log Test Incident
          </button>
        </div>
      </div>

      {/* KPI Stats Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Alerts</span>
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-2xl font-black text-on-surface">{stats.total}</h3>
          <p className="text-[11px] text-on-surface-variant mt-1">Logged across all edge streams</p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-red-200 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-red-900 uppercase tracking-wider">Critical & High</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-red-700">{stats.critical}</h3>
          <p className="text-[11px] text-red-800/80 mt-1">Immediate intervention required</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Pending Action</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-2xl font-black text-amber-700">{stats.pending}</h3>
          <p className="text-[11px] text-amber-800/80 mt-1">Awaiting supervisor review</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Resolved / Closed</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700">{stats.resolved}</h3>
          <p className="text-[11px] text-emerald-800/80 mt-1">Deduction / penalty settled</p>
        </div>
      </div>

      {/* Filter, Search & View Controls Bar */}
      <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search by worker name, phone, or anomaly keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Quick Filter dropdowns */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="ALL">All Anomaly Types</option>
              <option value="PPE_VIOLATION">PPE Violations</option>
              <option value="GHOST_WORKER">Ghost Workers</option>
              <option value="BUDDY_PUNCHING">Buddy Punching</option>
              <option value="GEO_FENCE_BREACH">Geofence Breaches</option>
              <option value="BIOMETRIC_SPOOF">Biometric Spoofs</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-outline-variant rounded-xl p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode('split')}
                title="Split Dossier View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'split' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Full Table View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-on-surface-variant">Analyzing biometric security feeds...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-16 text-center shadow-sm">
          <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-on-surface">Zero Anomalies Detected</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto mt-1 mb-6">
            All workers on site are currently in compliance with biometric verification and hardhat/PPE safety rules.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleRunScan}
              className="px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Radar className="w-4 h-4" />
              Re-Scan Site Feeds
            </button>
            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-5 py-2.5 bg-slate-100 text-on-surface text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-primary" />
              Generate Test Anomaly
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Showing {filteredAlerts.length} Incident{filteredAlerts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => fetchAlerts(true)}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant bg-slate-100/60 text-on-surface-variant uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Anomaly Type</th>
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-4">Details & Evidence</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredAlerts.map((alert) => {
                  const meta = getTypeMeta(alert.alertType);
                  return (
                    <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">{getSeverityBadge(alert.severity)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${meta.colorBg} ${meta.colorBorder}`}>
                            {meta.icon}
                          </div>
                          <span className="font-bold text-on-surface">{meta.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-on-surface">{alert.worker?.name}</div>
                        <div className="text-[11px] text-on-surface-variant font-mono">{alert.worker?.phone}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-on-surface-variant truncate">
                        {alert.details}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                        {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}{' '}
                        · {new Date(alert.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(alert.status)}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedAlertId(alert.id);
                              setViewMode('split');
                            }}
                            className="p-1 text-primary hover:bg-slate-100 rounded-lg"
                            title="Inspect details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {alert.status !== 'RESOLVED' && (
                            <button
                              onClick={() =>
                                setActionModal({
                                  open: true,
                                  alert,
                                  actionType: 'RESOLVE',
                                  note: '',
                                })
                              }
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="p-1 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SPLIT MASTER-DETAIL VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Incidents List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Showing {filteredAlerts.length} Incident{filteredAlerts.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => fetchAlerts(true)}
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {filteredAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                const meta = getTypeMeta(alert.alertType);

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-50/70 border-primary shadow-sm ring-2 ring-primary/40'
                        : 'bg-white border-outline-variant hover:border-outline hover:shadow-sm'
                    }`}
                  >
                    {/* Top row: Icon + Title + Severity */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Fixed-size clean icon container */}
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.colorBg} ${meta.colorBorder}`}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-on-surface truncate">{meta.label}</p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}{' '}
                            · {new Date(alert.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {getSeverityBadge(alert.severity)}
                      </div>
                    </div>

                    {/* Incident narrative */}
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-3 leading-relaxed">
                      {alert.details || 'Anomaly detected during facial biometric or CCTV verification stream.'}
                    </p>

                    {/* Bottom row: Worker info + Status badge */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/30 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-on-surface shrink-0">
                          {alert.worker?.name?.charAt(0) || 'W'}
                        </div>
                        <span className="font-bold text-on-surface truncate">{alert.worker?.name}</span>
                      </div>
                      <div className="shrink-0">{getStatusBadge(alert.status)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Detailed Incident Dossier (7 cols) */}
          <div className="lg:col-span-7">
            {selectedAlert ? (
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in sticky top-4">
                {/* Dossier Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
                  <div className="flex items-center gap-3">
                    {/* Clean icon container */}
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                        getTypeMeta(selectedAlert.alertType).colorBg
                      } ${getTypeMeta(selectedAlert.alertType).colorBorder}`}
                    >
                      {getTypeMeta(selectedAlert.alertType).icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-on-surface">
                          {getTypeMeta(selectedAlert.alertType).label}
                        </h2>
                        {getSeverityBadge(selectedAlert.severity)}
                      </div>
                      <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                        Incident ID: #FA-{selectedAlert.id.slice(0, 8).toUpperCase()} · Created{' '}
                        {new Date(selectedAlert.timestamp).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedAlert.status)}
                    <button
                      onClick={() => handleDeleteAlert(selectedAlert.id)}
                      title="Delete record"
                      className="p-1.5 hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Worker Identity Badge Card */}
                <div className="bg-slate-50 border border-outline-variant/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative shrink-0">
                    {selectedAlert.worker?.facePhotoUrl ? (
                      <img
                        src={selectedAlert.worker.facePhotoUrl}
                        alt={selectedAlert.worker.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-black text-xl shadow-sm">
                        {selectedAlert.worker?.name?.charAt(0) || 'W'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full border-2 border-white flex items-center justify-center text-white">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h3 className="text-base font-black text-on-surface truncate">{selectedAlert.worker?.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-on-surface-variant" />
                        {selectedAlert.worker?.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee className="w-3.5 h-3.5 text-on-surface-variant" />
                        ₹{selectedAlert.worker?.wageRate}/day
                      </span>
                    </div>
                    <p className="text-xs text-primary font-bold mt-1.5 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      Project: {selectedAlert.worker?.project?.name || 'Main Construction Site'} (
                      {selectedAlert.worker?.project?.code || 'PRJ-HQ'})
                    </p>
                  </div>
                </div>

                {/* Incident Narrative / Details */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 relative overflow-hidden">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-700" />
                    Flagged Anomaly Analysis
                  </h4>
                  <p className="text-sm font-semibold text-on-surface leading-relaxed">{selectedAlert.details}</p>
                </div>

                {/* Forensic Evidence Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">
                    Edge Evidence Timeline
                  </h4>
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 text-xs">
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white" />
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-on-surface">Initial Gate Attendance Event</span>
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          {new Date(selectedAlert.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-on-surface-variant">
                        Worker registration event recorded on site portal or kiosk terminal.
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white" />
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-on-surface">Subsystem C Cross-Correlation Engine</span>
                        <span className="text-[11px] text-on-surface-variant font-mono">Real-time</span>
                      </div>
                      <p className="text-on-surface-variant">
                        Spatial CCTV YOLO feed & multi-frame temporal detector flagged discrepancy against site threshold.
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-red-600 rounded-full border-2 border-white" />
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-red-700">Automated Compliance Penalty Queued</span>
                        <span className="text-[11px] text-red-700 font-mono">Active</span>
                      </div>
                      <p className="text-on-surface-variant">
                        Formula multiplier <code className="font-mono text-red-700">Phi_compliance</code> adjusted in
                        payroll calculation engine.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Supervisor Action Bar */}
                <div className="pt-4 border-t border-outline-variant/30 flex flex-wrap gap-2 justify-end">
                  {selectedAlert.status !== 'INVESTIGATING' && (
                    <button
                      onClick={() =>
                        setActionModal({
                          open: true,
                          alert: selectedAlert,
                          actionType: 'INVESTIGATE',
                          note: '',
                        })
                      }
                      className="px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Mark Investigating
                    </button>
                  )}

                  {selectedAlert.status !== 'DISMISSED' && (
                    <button
                      onClick={() =>
                        setActionModal({
                          open: true,
                          alert: selectedAlert,
                          actionType: 'DISMISS',
                          note: '',
                        })
                      }
                      className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Dismiss (False Positive)
                    </button>
                  )}

                  {selectedAlert.status !== 'RESOLVED' && (
                    <button
                      onClick={() =>
                        setActionModal({
                          open: true,
                          alert: selectedAlert,
                          actionType: 'RESOLVE',
                          note: '',
                        })
                      }
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Resolve & Close Incident
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-outline-variant rounded-2xl p-16 text-center text-on-surface-variant shadow-sm">
                <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold">Select an incident from the left to view evidence and audit dossier.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Action Confirmation (Resolve / Investigate / Dismiss) */}
      {actionModal.open && actionModal.alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  actionModal.actionType === 'RESOLVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : actionModal.actionType === 'DISMISS'
                    ? 'bg-slate-100 text-slate-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {actionModal.actionType === 'RESOLVE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                ) : actionModal.actionType === 'DISMISS' ? (
                  <XCircle className="w-5 h-5 text-slate-700" />
                ) : (
                  <Search className="w-5 h-5 text-blue-700" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">
                  {actionModal.actionType === 'RESOLVE'
                    ? 'Resolve Incident'
                    : actionModal.actionType === 'DISMISS'
                    ? 'Dismiss as False Positive'
                    : 'Mark as Under Investigation'}
                </h3>
                <p className="text-xs text-on-surface-variant font-mono">
                  Worker: {actionModal.alert.worker?.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              {actionModal.actionType === 'RESOLVE'
                ? 'Resolving this incident confirms the supervisor audit. Safety penalty remains applied in payroll unless overridden.'
                : actionModal.actionType === 'DISMISS'
                ? 'Dismissing will mark this anomaly as a false positive and restore 100% compliance score for this worker.'
                : 'Flag this incident for safety inspector inquiry on site.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Supervisor Resolution Notes (Optional)</label>
              <textarea
                rows={3}
                value={actionModal.note}
                onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                placeholder="E.g., Verified in Sector 4, written warning issued on site..."
                className="w-full p-3 bg-slate-50 border border-outline-variant rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal({ open: false, alert: null, actionType: 'RESOLVE', note: '' })}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-on-surface hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm ${
                  actionModal.actionType === 'RESOLVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionModal.actionType === 'DISMISS'
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Generate / Simulate Anomaly */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleCreateSimulatedAlert}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant space-y-4"
          >
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-on-surface">Log / Simulate Anomaly Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Target Worker</label>
                <select
                  value={simWorkerId}
                  onChange={(e) => setSimWorkerId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
                  required
                >
                  {availableWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Anomaly Type</label>
                  <select
                    value={simType}
                    onChange={(e) => setSimType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
                  >
                    <option value="PPE_VIOLATION">PPE Safety Violation</option>
                    <option value="GHOST_WORKER">Ghost Worker (Unobserved)</option>
                    <option value="BUDDY_PUNCHING">Buddy Punching</option>
                    <option value="GEO_FENCE_BREACH">Geofence Breach</option>
                    <option value="BIOMETRIC_SPOOF">Biometric Spoof</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Severity</label>
                  <select
                    value={simSeverity}
                    onChange={(e) => setSimSeverity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Incident Details / Evidence (Optional)</label>
                <textarea
                  rows={3}
                  value={simDetails}
                  onChange={(e) => setSimDetails(e.target.value)}
                  placeholder="Leave empty to use automatic AI edge description..."
                  className="w-full p-3 bg-slate-50 border border-outline-variant rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-on-surface hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary hover:opacity-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Log Anomaly
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
