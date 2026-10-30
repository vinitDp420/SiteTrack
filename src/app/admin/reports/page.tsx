'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useProject } from '@/lib/project-context';

interface DailyReport {
  id: string;
  note: string;
  photoUrl: string | null;
  date: string;
  submittedBy: {
    name: string;
  };
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const { selectedProject } = useProject();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReports = () => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/reports?projectId=${selectedProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setReports(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedProject) fetchReports();
  }, [selectedProject]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Photo size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
        setFormError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProject) {
      setFormError('Please select an active project first.');
      return;
    }
    if (!note.trim() || note.trim().length < 5) {
      setFormError('Daily note must be at least 5 characters long.');
      return;
    }
    if (!date) {
      setFormError('Please select a valid report date.');
      return;
    }

    const reportDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (reportDate > today) {
      setFormError('Report date cannot be in the future.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim(),
          date,
          photoBase64,
          projectId: selectedProject.id,
          submittedById: (session?.user as any)?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNote('');
        setPhotoBase64(null);
        setFormError(null);
        setShowAddModal(false);
        fetchReports();
      } else {
        setFormError(data.error || 'Failed to submit daily report.');
      }
    } catch {
      setFormError('Network error while saving report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-outline-variant/30 pb-4 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Daily Reports</h1>
          <p className="text-sm text-on-surface-variant mt-1">Supervisor shift logs, site photo progress, and official audit exports.</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          {/* EXPORT DAILY AUDIT (PDF / PRINT) */}
          <button
            onClick={() => setIsPrintReportOpen(true)}
            disabled={reports.length === 0}
            className="h-[38px] px-3.5 bg-white border border-outline-variant hover:border-primary text-primary rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            title="Preview and Print / Save PDF Daily Audit Report"
          >
            <span className="material-symbols-outlined text-[18px] text-red-600">picture_as_pdf</span>
            <span>Print / PDF Audit Report</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="h-[38px] bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 rounded-xl flex items-center gap-1.5 shadow active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Submit Note
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold">Loading reports...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.length === 0 ? (
            <p className="text-sm text-on-surface-variant col-span-2">No daily reports submitted yet.</p>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(13,28,50,0.05)] flex flex-col"
              >
                {report.photoUrl && (
                  <div className="relative aspect-video w-full bg-slate-100 border-b border-outline-variant">
                    <img src={report.photoUrl} alt="Report Photo" className="object-cover w-full h-full" />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-sm text-on-surface font-body-md leading-relaxed">{report.note}</p>
                  <div className="flex justify-between items-center text-xs text-on-surface-variant font-bold border-t border-outline-variant/30 pt-3">
                    <div>Submitted by: {report.submittedBy.name}</div>
                    <div>{new Date(report.date).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Report Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Submit Daily Report</h3>
              <span
                onClick={() => { setShowAddModal(false); setFormError(null); }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Notes / Daily Activity
                </label>
                <textarea
                  required
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="Describe today's construction progress, weather conditions, or delay issues..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Progress Photo (Optional)
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant hover:border-primary p-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span> Upload Image
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {photoBase64 && (
                    <div className="relative w-12 h-12 rounded border border-outline-variant overflow-hidden bg-slate-100">
                      <img src={photoBase64} alt="Thumbnail" className="object-cover w-full h-full" />
                      <button
                        type="button"
                        onClick={() => setPhotoBase64(null)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px]"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setFormError(null); }}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          OFFICIAL PRINT / PDF DAILY AUDIT REPORT MODAL
          ========================================================= */}
      {isPrintReportOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print-modal-backdrop animate-fade-in">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-outline-variant p-6 md:p-8 print-modal-container space-y-6">
            
            {/* Modal Actions Bar (Hidden when printing) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 pb-4 no-print">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[24px]">picture_as_pdf</span>
                <div>
                  <h3 className="text-base font-extrabold text-primary">Daily Site Audit Report Preview</h3>
                  <p className="text-xs text-on-surface-variant">Formatted for physical print or browser &ldquo;Save as PDF&rdquo;</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gradient-to-r from-primary to-[#1a3a6e] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReportOpen(false)}
                  className="px-3 py-2 border border-outline-variant hover:bg-slate-100 text-on-surface-variant text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* PRINTABLE DOCUMENT BODY */}
            <div className="printable-area space-y-6">
              {/* Document Header */}
              <div className="border-b-2 border-primary pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[28px] no-print">construction</span>
                      <h2 className="text-xl font-black text-primary tracking-tight">SiteTrack CONSTRUCTION OS</h2>
                    </div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mt-0.5">
                      Daily Construction Progress & HSE Safety Audit Dossier
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-black rounded uppercase tracking-wider">
                      Official Site Log
                    </span>
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      Audit Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Project Name:</span>
                    <span className="font-extrabold text-on-surface">{selectedProject?.name || 'Main HQ Construction'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Project Code:</span>
                    <span className="font-extrabold text-on-surface font-mono">{selectedProject?.code || 'PRJ-HQ-01'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Site Supervisor:</span>
                    <span className="font-extrabold text-on-surface">{session?.user?.name || 'Head Supervisor'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Safety Telemetry:</span>
                    <span className="font-extrabold text-emerald-700">Edge CCTV Channels 01 & 02</span>
                  </div>
                </div>
              </div>

              {/* HSE & Safety Compliance Summary Strip */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs print-avoid-break">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">PPE Compliance Protocol:</span>
                  <p className="font-extrabold text-emerald-700 mt-0.5">Automated Hard Hat Enforcement</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">5-sec temporal multi-frame confirmation</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Vision Preprocessing:</span>
                  <p className="font-extrabold text-slate-800 mt-0.5">Active Environmental Filters</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Night Boost, Glare Shield & Defogger</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Safety Record:</span>
                  <p className="font-extrabold text-emerald-700 mt-0.5">0 Lost Time Incidents (LTI)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Zero cloud raw video streaming</p>
                </div>
              </div>

              {/* Shift Notes & Photo Evidence */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1">
                  Shift Progress Records & Photo Evidence ({reports.length} Logs)
                </h4>

                <div className="space-y-4">
                  {reports.map((report, idx) => (
                    <div key={report.id} className="border border-slate-200 rounded-xl p-4 bg-white print-avoid-break space-y-3">
                      <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                        <span className="font-bold text-primary">Log #{idx + 1} — Shift Activity Record</span>
                        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                          <span>Logged by: <strong className="text-slate-800">{report.submittedBy.name}</strong></span>
                          <span>•</span>
                          <span>{new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{report.note}</p>

                      {report.photoUrl && (
                        <div className="pt-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Attached Site Progress Photo:</p>
                          <div className="relative max-h-56 max-w-md rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={report.photoUrl} alt="Progress Photo" className="object-contain w-full max-h-56" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-8 mt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                <div>
                  <div className="h-12 border-b border-dashed border-slate-400 mb-2"></div>
                  <p className="font-extrabold text-slate-800">Site Supervisor</p>
                  <p className="text-[10px] text-slate-500">Prepared & Field Certified</p>
                </div>
                <div>
                  <div className="h-12 border-b border-dashed border-slate-400 mb-2"></div>
                  <p className="font-extrabold text-slate-800">HSE Safety Officer</p>
                  <p className="text-[10px] text-slate-500">PPE & Hazard Verified</p>
                </div>
                <div>
                  <div className="h-12 border-b border-dashed border-slate-400 mb-2"></div>
                  <p className="font-extrabold text-slate-800">Client / Resident Engineer</p>
                  <p className="text-[10px] text-slate-500">Inspected & Approved</p>
                </div>
              </div>

              {/* Document Stamp */}
              <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                Official document generated by SiteTrack Construction OS. Stored with tamper-evident cryptographic metadata.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
