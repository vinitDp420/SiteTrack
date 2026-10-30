'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

interface Task {
  id: string;
  title: string;
  description: string | null;
  date: string;
  assignedWorkerId: string | null;
  status: string;
  assignedWorker: {
    name: string;
  } | null;
}

interface Worker {
  id: string;
  name: string;
}

export default function TasksPage() {
  const { selectedProject } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedWorkerId, setAssignedWorkerId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workers')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setWorkers(data); })
      .catch((e) => console.error(e));
    if (selectedProject) fetchTasks();
  }, [selectedProject]);

  const fetchTasks = () => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/tasks?projectId=${selectedProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProject) {
      setFormError('Please select an active project.');
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 3) {
      setFormError('Task title must be at least 3 characters long.');
      return;
    }
    if (!date) {
      setFormError('Please select a scheduled date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim() || null,
          date,
          assignedWorkerId: assignedWorkerId || null,
          projectId: selectedProject.id
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTitle('');
        setDescription('');
        setAssignedWorkerId('');
        setFormError(null);
        setShowAddModal(false);
        fetchTasks();
      } else {
        setFormError(data.error || 'Failed to create task.');
      }
    } catch {
      setFormError('Network error while creating task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'DONE' ? 'PENDING' : 'DONE';
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (res.ok) {
        // Toggle locally
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
        );
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
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Daily Tasks</h1>
          <p className="text-sm text-on-surface-variant mt-1">Assign work checklists to workers on site.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Create Task
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Left Column: Pending Tasks */}
          <div className="bg-white border border-outline-variant rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#ba1a1a] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span> Pending Tasks
            </h3>
            <div className="space-y-4">
              {tasks.filter((t) => t.status === 'PENDING').length === 0 ? (
                <p className="text-xs text-on-surface-variant py-2">No pending tasks for today.</p>
              ) : (
                tasks
                  .filter((t) => t.status === 'PENDING')
                  .map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleStatus(task.id, task.status)}
                      className="border border-outline-variant/50 rounded-lg p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                        check_box_outline_blank
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-on-surface-variant font-bold">
                          <span className="bg-secondary-container px-2 py-0.5 rounded text-on-secondary-container">
                            {task.assignedWorker ? task.assignedWorker.name : 'Unassigned'}
                          </span>
                          <span>Due: {new Date(task.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Right Column: Completed Tasks */}
          <div className="bg-white border border-outline-variant rounded-xl shadow-[0_2px_8px_rgba(13,28,50,0.05)] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#008000] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">task_alt</span> Completed Tasks
            </h3>
            <div className="space-y-4">
              {tasks.filter((t) => t.status === 'DONE').length === 0 ? (
                <p className="text-xs text-on-surface-variant py-2">No completed tasks yet.</p>
              ) : (
                tasks
                  .filter((t) => t.status === 'DONE')
                  .map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleStatus(task.id, task.status)}
                      className="border border-outline-variant/30 rounded-lg p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-3 bg-slate-50/50 opacity-80"
                    >
                      <span className="material-symbols-outlined text-[#008000] text-[20px] fill">check_box</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-on-surface-variant font-bold">
                          <span className="bg-slate-200 px-2 py-0.5 rounded text-on-surface-variant">
                            {task.assignedWorker ? task.assignedWorker.name : 'Unassigned'}
                          </span>
                          <span>Completed</span>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Create Daily Task</h3>
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

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Inspect load levels, Clean tools"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="Detailed work instructions..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Schedule Date
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
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Assign Worker
                  </label>
                  <select
                    value={assignedWorkerId}
                    onChange={(e) => setAssignedWorkerId(e.target.value)}
                    className="w-full border border-outline-variant p-2.5 rounded-lg text-sm bg-white"
                  >
                    <option value="">Choose Worker (Optional)</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
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
                  {isSubmitting ? 'Saving Task...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
