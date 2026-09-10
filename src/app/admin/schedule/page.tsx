'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

interface Milestone {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  plannedProgress: number;
  actualProgress: number;
}

export default function SchedulePage() {
  const { selectedProject } = useProject();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [plannedProgress, setPlannedProgress] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProject) fetchMilestones();
  }, [selectedProject]);

  const fetchMilestones = () => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/schedule?projectId=${selectedProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMilestones(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate || !selectedProject) return;
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startDate, endDate, plannedProgress, projectId: selectedProject.id }),
      });
      if (res.ok) {
        setName(''); setStartDate(''); setEndDate(''); setPlannedProgress(0);
        setShowAddModal(false);
        fetchMilestones();
      }
    } catch (err) { console.error(err); }
  };

  const handleProgressChange = async (id: string, progress: number) => {
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actualProgress: progress }),
      });
      if (res.ok) {
        setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, actualProgress: progress } : m)));
      }
    } catch (err) { console.error(err); }
  };

  const overallProgress = milestones.length > 0
    ? Math.round(milestones.reduce((s, m) => s + m.actualProgress, 0) / milestones.length)
    : 0;

  const completedCount = milestones.filter((m) => m.actualProgress === 100).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Project Schedule</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject ? <>Gantt milestones for <span className="font-bold text-on-surface">{selectedProject.name}</span></> : 'Select a project.'}
          </p>
        </div>
        {selectedProject && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5 shadow active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add Phase
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Overall Progress</p>
          <div className="flex items-end gap-2 mt-2">
            <h3 className="text-4xl font-black text-primary">{overallProgress}%</h3>
            <p className="text-xs text-on-surface-variant mb-1 pb-0.5">complete</p>
          </div>
          <div className="h-2 bg-surface-container rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#b87500] to-[#ffd280] rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Phases</p>
          <h3 className="text-4xl font-black text-on-surface mt-2">{milestones.length}</h3>
          <p className="text-xs text-on-surface-variant mt-1"><span className="text-[#008000] font-bold">{completedCount}</span> completed</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Project</p>
          <h3 className="text-base font-black text-primary truncate mt-2">{selectedProject?.name || '—'}</h3>
          <p className="text-xs text-on-surface-variant font-mono">{selectedProject?.code}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold text-on-surface-variant">Loading schedule...</div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-2xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] p-6 space-y-6">
          <h3 className="text-base font-bold text-primary">Milestone Gantt Tracker</h3>
          <div className="space-y-5 divide-y divide-outline-variant/30">
            {milestones.length === 0 ? (
              <div className="py-10 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">calendar_today</span>
                <p className="text-sm text-on-surface-variant mt-2 font-bold">No milestones yet. Add your first project phase!</p>
              </div>
            ) : (
              milestones.map((m, idx) => {
                const isCompleted = m.actualProgress === 100;
                const isBehind = m.actualProgress < m.plannedProgress;
                return (
                  <div key={m.id} className={`pt-5 ${idx === 0 ? 'pt-0' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isCompleted ? 'bg-[#008000]' : isBehind ? 'bg-[#ba1a1a]' : 'bg-[#b87500]'}`} />
                        <div>
                          <h4 className="text-sm font-bold text-on-surface">{m.name}</h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {new Date(m.startDate).toLocaleDateString('en-IN')} → {new Date(m.endDate).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4 sm:ml-0">
                        <div className="text-right">
                          <span className="text-xs text-on-surface-variant">Planned: </span>
                          <span className="text-xs font-mono font-bold">{m.plannedProgress}%</span>
                        </div>
                        <div className="w-px h-5 bg-outline-variant/30" />
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-primary">Actual:</label>
                          <input
                            type="range" min="0" max="100"
                            value={m.actualProgress}
                            onChange={(e) => handleProgressChange(m.id, parseInt(e.target.value))}
                            className="w-24 accent-[#b87500]"
                          />
                          <span className="text-xs font-mono font-bold w-10 text-right">{m.actualProgress}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-7 bg-surface-container rounded-full overflow-hidden relative flex items-center border border-outline-variant/30">
                      <div className="h-full bg-slate-200 absolute left-0 top-0 border-r-2 border-dashed border-slate-400" style={{ width: `${m.plannedProgress}%` }} />
                      <div className={`h-full absolute left-0 top-0 opacity-85 transition-all ${isCompleted ? 'bg-[#4caf50]' : isBehind ? 'bg-[#ffb3ad]' : 'bg-[#ffb95f]'}`} style={{ width: `${m.actualProgress}%` }} />
                      <span className="absolute left-3 text-[10px] font-black text-on-surface uppercase tracking-wider mix-blend-multiply">
                        {isCompleted ? '✓ Completed' : m.actualProgress > 0 ? 'In Progress' : 'Planned'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-outline-variant p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Add Project Phase / Milestone</h3>
              <span onClick={() => setShowAddModal(false)} className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary">close</span>
            </div>
            <form onSubmit={handleAddMilestone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Phase Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none" placeholder="e.g. Concrete Pouring, MEP Rough-In" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Start Date</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">End Date</label>
                  <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Planned Progress Baseline: <span className="text-primary font-mono">{plannedProgress}%</span></label>
                <input type="range" min="0" max="100" value={plannedProgress} onChange={(e) => setPlannedProgress(parseInt(e.target.value))} className="w-full accent-[#b87500]" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-xl shadow">Save Milestone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
