'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface Reminder {
  id: string;
  note: string;
  dueDate: string;
  isRead: boolean;
}

export default function RemindersPage() {
  const { data: session } = useSession();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = () => {
    setLoading(true);
    fetch('/api/reminders')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setReminders(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note || !dueDate || !session?.user) return;

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          dueDate,
          userId: (session.user as any).id,
        }),
      });
      if (res.ok) {
        setNote('');
        setDueDate('');
        setShowAddModal(false);
        fetchReminders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead: !currentRead }),
      });
      if (res.ok) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isRead: !currentRead } : r))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchReminders();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Reminders & Alerts</h1>
          <p className="text-sm text-on-surface-variant mt-1">General alerts, safety guidelines, and tasks checklist due dates.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add_alert</span> Add Reminder
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold">Loading reminders...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-w-2xl">
          {reminders.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No active reminders found.</p>
          ) : (
            reminders.map((r) => {
              const isOverdue = new Date(r.dueDate) < new Date() && !r.isRead;
              return (
                <div
                  key={r.id}
                  className={`border rounded-xl p-4 shadow-[0_2px_8px_rgba(13,28,50,0.05)] transition-all flex items-center justify-between gap-4 ${
                    r.isRead
                      ? 'bg-slate-50 border-outline-variant/20 opacity-70'
                      : isOverdue
                      ? 'bg-[#ffdad6]/20 border-[#ffdad6] text-on-surface'
                      : 'bg-white border-outline-variant'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      onClick={() => handleToggleRead(r.id, r.isRead)}
                      className={`material-symbols-outlined cursor-pointer text-[20px] select-none ${
                        r.isRead ? 'text-[#008000] fill' : 'text-on-surface-variant'
                      }`}
                    >
                      {r.isRead ? 'check_circle' : 'circle'}
                    </span>
                    <div>
                      <p className={`text-sm ${r.isRead ? 'line-through text-on-surface-variant' : 'font-bold text-on-surface'}`}>
                        {r.note}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        Due: {new Date(r.dueDate).toLocaleDateString()}
                        {isOverdue && <span className="text-[#ba1a1a] font-bold uppercase ml-2 text-[9px] tracking-wider">Overdue</span>}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReminder(r.id)}
                    className="text-on-surface-variant hover:text-[#ba1a1a] p-1 rounded"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Add Reminder Alert</h3>
              <span
                onClick={() => setShowAddModal(false)}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleAddReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Reminder Note
                </label>
                <input
                  type="text"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Schedule cement order delivery"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                />
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
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
