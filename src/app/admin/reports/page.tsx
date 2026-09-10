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
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedProject) fetchReports();
  }, [selectedProject]);


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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note || !date || !selectedProject || !session?.user) return;

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          date,
          photoBase64,
          projectId: selectedProject.id,
          submittedById: (session.user as any).id,
        }),
      });
      if (res.ok) {
        setNote('');
        setPhotoBase64(null);
        setShowAddModal(false);
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Daily Reports</h1>
          <p className="text-sm text-on-surface-variant mt-1">Supervisor shift logs and site photo progress.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Submit Note
        </button>
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
                onClick={() => setShowAddModal(false)}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
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
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
