'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '@/lib/project-context';

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  status: 'ACTIVE' | 'INACTIVE';
  facePhotoUrl: string | null;
  projectId: string;
  project: Project;
  user?: {
    id: string;
    email: string;
    role: string;
  } | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  paymentType?: string;
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function WorkersPage() {
  const { selectedProject, projects, loading: projectLoading } = useProject();
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wageRate, setWageRate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  // Bank Details
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [paymentType, setPaymentType] = useState<'DAILY' | 'MONTHLY'>('DAILY');

  // Worker Login Credentials State
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('Worker@123');
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentialsAlert, setCreatedCredentialsAlert] = useState<{ name: string; email: string; pass: string } | null>(null);

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Initial synchronization: once project context loads, initialize filter
  useEffect(() => {
    if (!projectLoading && !hasInitializedFilter) {
      if (selectedProject) {
        setProjectFilter(selectedProject.id);
      } else {
        setProjectFilter('ALL');
      }
      setHasInitializedFilter(true);
    }
  }, [projectLoading, selectedProject, hasInitializedFilter]);

  // 2. Synchronize when user switches project from top layout selector
  useEffect(() => {
    if (hasInitializedFilter && selectedProject) {
      setProjectFilter(selectedProject.id);
    }
  }, [selectedProject]);

  // 3. Fetch workers strictly for the chosen project filter with cache busting
  const fetchWorkers = async (filterOverride?: string) => {
    const activeFilter = filterOverride !== undefined ? filterOverride : projectFilter;
    try {
      setLoading(true);
      const url = activeFilter && activeFilter !== 'ALL'
        ? `/api/workers?projectId=${activeFilter}&_t=${Date.now()}`
        : `/api/workers?_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasInitializedFilter) {
      fetchWorkers();
    }
  }, [projectFilter, hasInitializedFilter]);

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      const defaultProj = (projectFilter !== 'ALL' && projectFilter) || selectedProject?.id || projects[0].id;
      setProjectId(defaultProj);
    }
  }, [projects, selectedProject, projectFilter]);

  const openAddModal = () => {
    setEditMode(false);
    setSelectedWorkerId(null);
    setName(''); setPhone(''); setWageRate('');
    setLoginEmail(''); setPassword('Worker@123'); setShowPassword(false);
    setFormError(null);
    const defaultProjId = (projectFilter !== 'ALL' && projectFilter) || selectedProject?.id || (projects.length > 0 ? projects[0].id : '');
    setProjectId(defaultProjId);
    setStatus('ACTIVE');
    setFacePhoto(null);
    setBankAccountName(''); setBankAccountNumber(''); setIfscCode(''); setUpiId('');
    setPaymentType('DAILY');
    setActiveStep(0);
    setModalOpen(true);
  };

  const openEditModal = (worker: Worker) => {
    setEditMode(true);
    setSelectedWorkerId(worker.id);
    setName(worker.name);
    setPhone(worker.phone);
    setWageRate(worker.wageRate.toString());
    setProjectId(worker.projectId);
    setStatus(worker.status);
    setLoginEmail(worker.user?.email || '');
    setPassword(''); // Empty means don't change
    setShowPassword(false);
    setBankAccountName(worker.bankAccountName || '');
    setBankAccountNumber(worker.bankAccountNumber || '');
    setIfscCode(worker.ifscCode || '');
    setUpiId(worker.upiId || '');
    setPaymentType((worker.paymentType as any) || 'DAILY');
    setFacePhoto(null);
    setFormError(null);
    setActiveStep(0);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    stopCamera();
    setModalOpen(false);
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setFormError('Failed to access webcam.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 400, 400);
        setFacePhoto(canvas.toDataURL('image/jpeg'));
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFacePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setFormError(null);
    if (!name.trim()) { setFormError('Full name is required.'); return; }
    if (!phone.trim()) { setFormError('Phone number is required.'); return; }
    if (!wageRate) { setFormError('Daily wage rate is required.'); return; }
    if (!projectId) { setFormError('Please select a project.'); return; }

    setFormSaving(true);
    const payload = {
      name,
      phone,
      wageRate: parseFloat(wageRate),
      projectId,
      status,
      facePhoto,
      bankAccountName,
      bankAccountNumber,
      ifscCode,
      upiId,
      paymentType,
      loginEmail: loginEmail.trim(),
      password: password ? password.trim() : undefined,
    };

    try {
      let res;
      if (editMode && selectedWorkerId) {
        res = await fetch(`/api/workers/${selectedWorkerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const result = await res.json();
      if (result.error) {
        setFormError(result.error);
        setFormSaving(false);
      } else {
        // 1. Immediately update local state so newly added/edited worker appears with 0ms latency
        setWorkers((prev) => {
          const exists = prev.some((w) => w.id === result.id);
          if (exists) {
            return prev.map((w) => (w.id === result.id ? result : w));
          }
          return [result, ...prev];
        });

        // 2. If filtering by a project that differs from the newly created worker, switch filter
        if (projectFilter !== 'ALL' && projectFilter !== result.projectId) {
          setProjectFilter(result.projectId);
        }

        // 3. Highlight newly registered worker with a glowing badge
        setNewlyAddedId(result.id);
        setTimeout(() => setNewlyAddedId(null), 8000);

        handleCloseModal();
        setFormSaving(false);

        // 4. Background re-fetch to ensure all DB relations and counts are fully refreshed
        fetchWorkers(result.projectId);

        if (!editMode) {
          setCreatedCredentialsAlert({
            name: result.name,
            email: result.user?.email || loginEmail || `${result.phone}@sitetrack.com`,
            pass: result.rawPassword || password || 'Worker@123',
          });
        }
      }
    } catch {
      setFormError('Failed to save worker.');
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string, workerName?: string) => {
    if (!window.confirm(`Are you sure you want to remove ${workerName || 'this worker'} from the roster? All associated attendance, shifts, and payment records will be permanently cleaned up.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/workers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete worker.');
      } else {
        // Optimistically remove worker from table immediately
        setWorkers((prev) => prev.filter((w) => w.id !== id));
        await fetchWorkers();
      }
    } catch (err: any) {
      alert('Network or server error while deleting worker.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      (w.phone && w.phone.includes(search)) ||
      (w.user?.email && w.user.email.toLowerCase().includes(search.toLowerCase()))
  );

  const steps = ['Personal Details', 'Wage & Assignment', 'Bank Details', 'Face Photo (Optional)'];

  return (
    <div className="flex-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Worker Management</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {projectFilter === 'ALL'
              ? 'All workers across all active construction sites'
              : <>Active roster for <span className="font-bold text-on-surface">{projects.find(p => p.id === projectFilter)?.name || selectedProject?.name || 'Selected Project'}</span></>
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Project Filter Dropdown */}
          <div className="relative min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">domain</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full h-[44px] pl-9 pr-8 bg-white border border-outline-variant focus:border-primary rounded-xl text-sm font-semibold text-on-surface outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/50 transition"
            >
              <option value="ALL">All Projects ({workers.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">unfold_more</span>
          </div>

          <div className="relative w-full sm:w-56">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              className="w-full h-[44px] pl-10 pr-3 bg-white border border-outline-variant focus:border-primary rounded-xl text-sm outline-none"
              placeholder="Search name, phone, ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={openAddModal}
            className="h-[44px] bg-primary text-on-primary px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 hover:opacity-90 transition whitespace-nowrap shadow cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Register Worker
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Workers', value: workers.length, icon: 'groups', color: 'bg-secondary-container text-on-secondary-container' },
          { label: 'Active', value: workers.filter((w) => w.status === 'ACTIVE').length, icon: 'check_circle', color: 'bg-[#d5e0f7] text-[#0d1c32]' },
          { label: 'Inactive', value: workers.filter((w) => w.status === 'INACTIVE').length, icon: 'cancel', color: 'bg-[#ffdad6] text-[#ba1a1a]' },
          { label: 'Avg. Wage/Day', value: workers.length > 0 ? INR(workers.reduce((s, w) => s + w.wageRate, 0) / workers.length) : '₹0', icon: 'payments', color: 'bg-[#ffddb8] text-[#2a1700]' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-outline-variant rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">{stat.label}</p>
              <p className="text-lg font-black text-on-surface">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-outline-variant rounded-2xl shadow-[0_2px_12px_rgba(13,28,50,0.06)] overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <div className="col-span-1">Photo</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-2">Project</div>
          <div className="col-span-2">Wage / Day</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="divide-y divide-outline-variant">
          {loading ? (
            <div className="p-10 text-center text-on-surface-variant">Loading workforce roster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">person_off</span>
              <p className="text-sm text-on-surface-variant mt-2 font-bold">No workers found.</p>
            </div>
          ) : (
            filtered.map((worker) => {
              const isNewlyAdded = worker.id === newlyAddedId;
              return (
                <div
                  key={worker.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center transition-all ${
                    isNewlyAdded
                      ? 'bg-emerald-50/90 ring-2 ring-emerald-500 shadow-md animate-in fade-in zoom-in-[0.99] duration-300'
                      : 'hover:bg-surface-container-low/50'
                  }`}
                >
                  <div className="col-span-1">
                    {worker.facePhotoUrl ? (
                      <img className="w-11 h-11 rounded-xl object-cover border border-outline-variant" src={worker.facePhotoUrl} alt={worker.name} />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-black text-sm">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface">{worker.name}</span>
                      {isNewlyAdded && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 rounded-full border border-emerald-400 animate-pulse">
                          Just Added
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="material-symbols-outlined text-[13px] text-cyan-700">vpn_key</span>
                      <span className="text-[11px] text-primary font-mono font-bold truncate max-w-[190px]" title={`Login ID: ${worker.user?.email || 'No account'}`}>
                        {worker.user?.email || 'No account'}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-on-surface">{worker.phone}</div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
                      <span className="text-on-surface truncate">{worker.project?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="col-span-2 font-black text-primary text-sm">{INR(worker.wageRate)}<span className="font-normal text-on-surface-variant text-xs">/day</span></div>
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-lg ${
                      worker.status === 'ACTIVE' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-[#ffdad6] text-[#93000a]'
                    }`}>
                      {worker.status}
                    </span>
                  </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <button onClick={() => openEditModal(worker)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-lg transition-all" title="Edit">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(worker.id, worker.name)}
                    disabled={deletingId === worker.id}
                    className="p-2 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                    title={`Delete ${worker.name}`}
                  >
                    {deletingId === worker.id ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* ==== REDESIGNED REGISTRATION MODAL ==== */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-[0_24px_64px_rgba(13,28,50,0.25)] border border-outline-variant/30 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="relative bg-gradient-to-br from-primary to-[#1a3a6e] p-6 text-white">
              <button onClick={handleCloseModal} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
                <span className="material-symbols-outlined text-white text-[18px]">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">{editMode ? 'manage_accounts' : 'person_add'}</span>
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">{editMode ? 'Edit Worker Profile' : 'Register New Worker'}</h2>
                  <p className="text-xs text-white/70">{selectedProject?.name || 'All Projects'}</p>
                </div>
              </div>

              {/* Step Indicator */}
              <div className="flex gap-2 mt-5">
                {steps.map((step, i) => (
                  <button key={i} onClick={() => setActiveStep(i)} className="flex-1 group">
                    <div className={`h-1.5 rounded-full transition-all ${i <= activeStep ? 'bg-white' : 'bg-white/25'}`} />
                    <p className={`text-[10px] mt-1 font-bold transition-all ${i === activeStep ? 'text-white' : 'text-white/40'}`}>{step}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {formError && (
                <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] text-xs rounded-xl border border-[#ba1a1a]/20 flex gap-2 items-center">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 0: Personal Details & Login Credentials */}
              {activeStep === 0 && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Personal & Login Credentials</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Full Name *</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition"
                        placeholder="e.g. Raj Kumar Singh"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setName(val);
                          if (!editMode && (!loginEmail || loginEmail.includes('@sitetrack.com'))) {
                            const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
                            setLoginEmail(slug ? `${slug}@sitetrack.com` : '');
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Phone Number *</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition"
                        placeholder="+91 98765 43210"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Roster Status *</label>
                    <div className="flex gap-3">
                      {['ACTIVE', 'INACTIVE'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s as 'ACTIVE' | 'INACTIVE')}
                          className={`flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                            status === s
                              ? s === 'ACTIVE' ? 'bg-[#d5e0f7] border-[#0d1c32] text-[#0d1c32]' : 'bg-[#ffdad6] border-[#ba1a1a] text-[#ba1a1a]'
                              : 'bg-white border-outline-variant text-on-surface-variant'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Worker Portal Login ID & Password */}
                  <div className="pt-3 border-t border-outline-variant/40 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">vpn_key</span>
                      <span className="text-xs font-extrabold text-on-surface uppercase tracking-wide">
                        Portal Login Credentials (ID & Password)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                          Login ID / Email *
                        </label>
                        <input
                          className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition font-mono"
                          placeholder="e.g. worker.name@sitetrack.com"
                          type="text"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                        />
                        <p className="text-[10px] text-on-surface-variant mt-1">
                          Worker signs in using this ID or their phone number.
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                            {editMode ? 'Reset Password (Optional)' : 'Password *'}
                          </label>
                          <button
                            type="button"
                            onClick={() => setPassword(`Site@${Math.floor(1000 + Math.random() * 9000)}`)}
                            className="text-[10px] font-bold text-primary hover:underline"
                          >
                            Generate
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full h-11 pl-4 pr-11 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition font-mono"
                            placeholder={editMode ? 'Leave blank to keep existing' : 'e.g. Worker@123'}
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary p-1"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-1 font-mono">
                          {editMode ? 'Leave blank to retain password' : 'Default password: Worker@123'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: Wage & Assignment */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Wage & Project Assignment</div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Daily Wage Rate (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-on-surface-variant text-base">₹</span>
                      <input
                        className="w-full h-11 pl-9 pr-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition font-bold"
                        placeholder="0"
                        step="1"
                        type="number"
                        value={wageRate}
                        onChange={(e) => setWageRate(e.target.value)}
                      />
                    </div>
                    {wageRate && (
                      <p className="text-xs text-on-surface-variant mt-1">= {INR(parseFloat(wageRate) * 26)} / month (est. 26 working days)</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Assign to Project *</label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {projects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => setProjectId(proj.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                            projectId === proj.id
                              ? 'border-primary bg-secondary-container/30'
                              : 'border-outline-variant hover:border-primary/40 bg-white'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-bold ${projectId === proj.id ? 'text-primary' : 'text-on-surface'}`}>{proj.name}</p>
                            <p className="text-[11px] text-on-surface-variant font-mono">Code: {proj.code}</p>
                          </div>
                          <span className={`material-symbols-outlined text-[20px] ${projectId === proj.id ? 'text-primary fill' : 'text-on-surface-variant'}`}>
                            {projectId === proj.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Bank Details */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Bank Details & Wage Mode</div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">Optional for Cash workers</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Account Holder Name</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition"
                        placeholder="As per bank records"
                        type="text"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Bank Account Number</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition font-mono"
                        placeholder="e.g. 1234567890123"
                        type="text"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">IFSC Code</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition font-mono uppercase"
                        placeholder="e.g. SBIN0001234"
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">UPI ID (optional)</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition"
                        placeholder="e.g. worker@upi"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Payment Type *</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentType('DAILY')}
                        className={`flex-1 h-14 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                          paymentType === 'DAILY'
                            ? 'bg-[#d5e0f7] border-primary text-primary'
                            : 'bg-white border-outline-variant text-on-surface-variant hover:border-primary/40'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">today</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Daily Wage</span>
                        <span className="text-[9px]">Auto-pay on check-out</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('MONTHLY')}
                        className={`flex-1 h-14 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                          paymentType === 'MONTHLY'
                            ? 'bg-purple-100 border-purple-600 text-purple-700'
                            : 'bg-white border-outline-variant text-on-surface-variant hover:border-purple-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Monthly Salary</span>
                        <span className="text-[9px]">Paid on last day of month</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3.5 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] mt-0.5">payments</span>
                    <div className="text-xs text-emerald-950 leading-relaxed">
                      <strong className="text-emerald-800">No bank account?</strong> You can leave bank/UPI fields blank. Unbanked workers can be paid on-site via the <strong className="text-emerald-800">Cash in Hand</strong> payment option in the Payments tab, complete with printable signature disbursement vouchers.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Face Photo */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Face Photo for AI Recognition</div>

                  {facePhoto ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <img className="w-40 h-40 rounded-2xl object-cover border-4 border-primary shadow-lg" src={facePhoto} alt="Preview" />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#008000] rounded-full flex items-center justify-center shadow">
                          <span className="material-symbols-outlined text-white text-[18px]">check</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-[#008000]">Photo captured successfully</p>
                      <button type="button" onClick={() => setFacePhoto(null)} className="text-xs font-bold text-[#ba1a1a] hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">delete</span> Remove photo
                      </button>
                    </div>
                  ) : cameraActive ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      <video ref={videoRef} autoPlay playsInline muted className="w-64 h-64 rounded-2xl object-cover border-4 border-primary shadow-lg bg-black" />
                      <div className="flex gap-3">
                        <button type="button" onClick={capturePhoto} className="px-6 h-11 bg-primary text-on-primary font-bold text-sm rounded-xl flex items-center gap-2 shadow">
                          <span className="material-symbols-outlined text-[18px]">photo_camera</span> Capture
                        </button>
                        <button type="button" onClick={stopCamera} className="px-6 h-11 border border-outline-variant text-primary font-bold text-sm rounded-xl">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-outline-variant rounded-2xl p-8 flex flex-col items-center gap-4 bg-surface-container-low/40">
                      <div className="w-20 h-20 rounded-2xl bg-secondary-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-[40px] text-on-secondary-container">face</span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-on-surface">Add Face Photo</p>
                        <p className="text-xs text-on-surface-variant mt-1">Required for automated CCTV attendance recognition</p>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={startCamera} className="px-5 h-10 bg-primary text-on-primary font-bold text-xs rounded-xl flex items-center gap-1.5 shadow">
                          <span className="material-symbols-outlined text-[16px]">videocam</span> Use Webcam
                        </button>
                        <label className="px-5 h-10 border border-outline-variant bg-white text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">upload</span> Upload
                          <input accept="image/*" className="hidden" type="file" onChange={handleFileUpload} />
                        </label>
                      </div>
                      <p className="text-xs text-on-surface-variant">You can also skip this step and add it later.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex justify-between items-center gap-3">
              <button
                className="h-11 px-5 rounded-xl font-bold text-sm text-on-surface-variant border border-outline-variant hover:bg-surface-variant transition"
                onClick={activeStep === 0 ? handleCloseModal : () => setActiveStep(activeStep - 1)}
                type="button"
              >
                {activeStep === 0 ? 'Cancel' : '← Back'}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant">Step {activeStep + 1} of {steps.length}</span>
                {activeStep < steps.length - 1 ? (
                  <button
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="h-11 bg-primary text-on-primary px-8 rounded-xl font-bold text-sm hover:opacity-90 transition shadow"
                    type="button"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={formSaving}
                    className="h-11 bg-primary text-on-primary px-8 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50 shadow"
                    type="button"
                  >
                    {formSaving ? 'Saving...' : editMode ? 'Update Worker' : 'Register Worker'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Worker Credentials Notification Modal */}
      {createdCredentialsAlert && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-outline-variant text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-[32px]">verified_user</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-on-surface tracking-tight">Worker Registered Successfully!</h3>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                Login credentials have been configured for <strong className="text-on-surface">{createdCredentialsAlert.name}</strong>. Share these details so the worker can sign in to their mobile portal:
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-sans font-bold">Login ID / Username:</span>
                <span className="font-bold text-slate-800 select-all">{createdCredentialsAlert.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-sans font-bold">Password:</span>
                <span className="font-bold text-emerald-700 select-all bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {createdCredentialsAlert.pass}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-sans font-bold">Sign In URL:</span>
                <span className="font-bold text-primary font-sans">http://localhost:3000/login</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setCreatedCredentialsAlert(null)}
                className="w-full py-3 bg-[#0d1c32] hover:bg-[#1a3a6e] text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
