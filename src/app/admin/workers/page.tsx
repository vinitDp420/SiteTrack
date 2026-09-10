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
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function WorkersPage() {
  const { selectedProject, projects } = useProject();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchWorkers = async () => {
    try {
      const url = selectedProject ? `/api/workers?projectId=${selectedProject.id}` : '/api/workers';
      const res = await fetch(url);
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [selectedProject]);

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(selectedProject?.id || projects[0].id);
    }
  }, [projects, selectedProject]);

  const openAddModal = () => {
    setEditMode(false);
    setSelectedWorkerId(null);
    setName(''); setPhone(''); setWageRate('');
    setFormError(null);
    setProjectId(selectedProject?.id || (projects.length > 0 ? projects[0].id : ''));
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
    const payload = { name, phone, wageRate: parseFloat(wageRate), projectId, status, facePhoto, bankAccountName, bankAccountNumber, ifscCode, upiId, paymentType };

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
      if (result.error) { setFormError(result.error); setFormSaving(false); }
      else { fetchWorkers(); handleCloseModal(); setFormSaving(false); }
    } catch {
      setFormError('Failed to save worker.');
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this worker from the roster?')) return;
    try {
      await fetch(`/api/workers/${id}`, { method: 'DELETE' });
      fetchWorkers();
    } catch { alert('Failed to delete.'); }
  };

  const filtered = workers.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.toLowerCase().includes(search.toLowerCase())
  );

  const steps = ['Personal Details', 'Wage & Assignment', 'Bank Details', 'Face Photo (Optional)'];

  return (
    <div className="flex-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Worker Management</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject
              ? <>Active roster for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
              : 'All workers across projects'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-60">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              className="w-full h-[44px] pl-10 pr-3 bg-white border border-outline-variant focus:border-primary rounded-xl text-sm outline-none"
              placeholder="Search name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={openAddModal}
            className="h-[44px] bg-primary text-on-primary px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 hover:opacity-90 transition whitespace-nowrap shadow"
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
            filtered.map((worker) => (
              <div key={worker.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center hover:bg-surface-container-low/50 transition-colors">
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
                  <div className="font-bold text-on-surface">{worker.name}</div>
                  <div className="text-xs text-on-surface-variant font-mono">ID: {worker.id.substring(0, 8)}</div>
                </div>
                <div className="col-span-2 text-sm text-on-surface">{worker.phone}</div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1 text-sm">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
                    <span className="text-on-surface truncate">{worker.project.name}</span>
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
                  <button onClick={() => handleDelete(worker.id)} className="p-2 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-all" title="Delete">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))
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

              {/* STEP 0: Personal Details */}
              {activeStep === 0 && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Personal Information</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Full Name *</label>
                      <input
                        className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-xl text-sm outline-none transition"
                        placeholder="e.g. Raj Kumar Singh"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
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
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Bank Details for Auto-Payment</div>
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
                  <div className="bg-[#ffddb8]/30 border border-[#ffddb8] rounded-xl p-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[#b87500] text-[16px] mt-0.5">info</span>
                    <p className="text-xs text-on-surface-variant">Bank details enable automatic wage transfer via Razorpay. If not provided, payments will be recorded but manual disbursement is needed.</p>
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
    </div>
  );
}
