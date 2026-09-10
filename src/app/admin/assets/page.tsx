'use client';

import React, { useEffect, useState } from 'react';

interface VehicleLog {
  id: string;
  date: string;
  hoursUsed: number | null;
  fuelFilled: number | null;
  notes: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string | null;
  status: string;
  maintenanceDueDate: string | null;
  logs: VehicleLog[];
}

interface Tool {
  id: string;
  name: string;
  quantity: number;
  status: string;
  assignedWorker: { name: string } | null;
  assignedWorkerId: string | null;
}

interface Worker {
  id: string;
  name: string;
}

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'tools'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projectId, setProjectId] = useState('');

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Selected item references
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Form states
  const [hoursUsed, setHoursUsed] = useState('');
  const [fuelFilled, setFuelFilled] = useState('');
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);

  const [toolName, setToolName] = useState('');
  const [toolQty, setToolQty] = useState('1');
  const [assigneeId, setAssigneeId] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.length > 0) setProjectId(data[0].id);
      })
      .catch((e) => console.error(e));

    fetch('/api/workers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWorkers(data);
      })
      .catch((e) => console.error(e));

    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/assets')
      .then((res) => res.json())
      .then((data) => {
        if (data.vehicles) setVehicles(data.vehicles);
        if (data.tools) setTools(data.tools);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  const handleCreateVehicleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !logDate) return;

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_vehicle_log',
          vehicleId: selectedVehicle.id,
          hoursUsed,
          fuelFilled,
          notes,
          date: logDate,
        }),
      });
      if (res.ok) {
        setHoursUsed('');
        setFuelFilled('');
        setNotes('');
        setSelectedVehicle(null);
        setShowLogModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName || !projectId) return;

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tool',
          name: toolName,
          quantity: toolQty,
          projectId,
        }),
      });
      if (res.ok) {
        setToolName('');
        setToolQty('1');
        setShowToolModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;

    const nextStatus = assigneeId ? 'IN_USE' : 'AVAILABLE';

    try {
      const res = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tool_status',
          id: selectedTool.id,
          status: nextStatus,
          assignedWorkerId: assigneeId,
        }),
      });
      if (res.ok) {
        setAssigneeId('');
        setSelectedTool(null);
        setShowAssignModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleToolStatus = async (id: string, currentStatus: string) => {
    let nextStatus = 'AVAILABLE';
    if (currentStatus === 'AVAILABLE') nextStatus = 'LOST';
    else if (currentStatus === 'LOST') nextStatus = 'AVAILABLE';

    try {
      const res = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tool_status',
          id,
          status: nextStatus,
          assignedWorkerId: null, // Clear assignee if toggling availability
        }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Vehicles & Tools</h1>
          <p className="text-sm text-on-surface-variant mt-1">Track heavy equipment logs and hand tool inventory.</p>
        </div>
        <div>
          {activeTab === 'tools' && (
            <button
              onClick={() => setShowToolModal(true)}
              className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">build</span> Add Tool
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase border-b-2 transition-all ${
            activeTab === 'vehicles' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Machinery & Vehicles
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase border-b-2 transition-all ${
            activeTab === 'tools' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Hand Tools
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold">Loading assets...</div>
      ) : (
        <div className="animate-fade-in">
          {/* TAB 1: VEHICLES */}
          {activeTab === 'vehicles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vehicles.length === 0 ? (
                <p className="text-sm text-on-surface-variant col-span-2">No heavy equipment registered.</p>
              ) : (
                vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white border border-outline-variant rounded-xl p-6 shadow-[0_2px_8px_rgba(13,28,50,0.05)] space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg text-primary">{v.name}</h4>
                          <p className="text-xs text-on-surface-variant font-mono mt-0.5">Plate: {v.plateNumber || 'N/A'}</p>
                        </div>
                        <span className="bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded text-xs font-bold uppercase">
                          {v.status}
                        </span>
                      </div>

                      {v.maintenanceDueDate && (
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-[#ba1a1a] font-bold bg-[#ffdad6]/20 p-2 rounded-lg border border-[#ffdad6]">
                          <span className="material-symbols-outlined text-[16px]">build_circle</span>
                          Maintenance Due: {new Date(v.maintenanceDueDate).toLocaleDateString()}
                        </div>
                      )}

                      {/* Recent Log Summary */}
                      {v.logs.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                            Recent Usage logs
                          </span>
                          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                            <div className="flex justify-between font-bold">
                              <span>{new Date(v.logs[0].date).toLocaleDateString()}</span>
                              <span>{v.logs[0].hoursUsed} hrs used</span>
                            </div>
                            {v.logs[0].notes && <p className="text-on-surface-variant italic">"{v.logs[0].notes}"</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedVehicle(v);
                        setShowLogModal(true);
                      }}
                      className="w-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider h-touch-target rounded-lg flex items-center justify-center gap-1.5 shadow active:scale-[0.98] mt-4"
                    >
                      <span className="material-symbols-outlined text-[18px]">note_add</span> Log Usage / Fuel
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: HAND TOOLS */}
          {activeTab === 'tools' && (
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
              <div className="hidden md:grid grid-cols-12 gap-md p-md border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <div className="col-span-4">Tool Name</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-3">Status / Assignee</div>
                <div className="col-span-3 text-right">Inventory Actions</div>
              </div>
              <div className="divide-y divide-outline-variant">
                {tools.length === 0 ? (
                  <p className="text-sm text-on-surface-variant p-6">No tools registered in directory.</p>
                ) : (
                  tools.map((t) => (
                    <div key={t.id} className="grid grid-cols-1 md:grid-cols-12 gap-sm md:gap-md p-md items-center text-sm">
                      <div className="col-span-4 font-bold text-on-surface">{t.name}</div>
                      <div className="col-span-2">{t.quantity} unit(s)</div>
                      <div className="col-span-3 flex flex-wrap gap-2 items-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            t.status === 'AVAILABLE'
                              ? 'bg-slate-200 text-on-surface-variant'
                              : t.status === 'IN_USE'
                              ? 'bg-[#d5e0f7] text-[#0d1c32]'
                              : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}
                        >
                          {t.status}
                        </span>
                        {t.status === 'IN_USE' && t.assignedWorker && (
                          <span className="text-xs text-on-surface-variant font-bold">({t.assignedWorker.name})</span>
                        )}
                      </div>
                      <div className="col-span-3 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedTool(t);
                            setShowAssignModal(true);
                          }}
                          className="border border-outline-variant hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => handleToggleToolStatus(t.id, t.status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                            t.status === 'LOST'
                              ? 'bg-[#d5e0f7] border-[#bcc7dd] text-[#0d1c32]'
                              : 'bg-[#ffdad6] border-[#ffdad6] text-[#ba1a1a] hover:opacity-90'
                          }`}
                        >
                          {t.status === 'LOST' ? 'Found' : 'Lost'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Machinery Usage Modal */}
      {showLogModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Log Usage: {selectedVehicle.name}</h3>
              <span
                onClick={() => {
                  setSelectedVehicle(null);
                  setShowLogModal(false);
                }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleCreateVehicleLog} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Log Date
                </label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Hours Used
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={hoursUsed}
                    onChange={(e) => setHoursUsed(e.target.value)}
                    className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                    placeholder="e.g. 5.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Fuel Filled (Liters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={fuelFilled}
                    onChange={(e) => setFuelFilled(e.target.value)}
                    className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Activity Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="Describe works completed..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setShowLogModal(false);
                  }}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tool Modal */}
      {showToolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Register Hand Tool</h3>
              <span
                onClick={() => setShowToolModal(false)}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleCreateTool} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Tool Name
                </label>
                <input
                  type="text"
                  required
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Bosch Hammer Drill, Table Saw"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Quantity
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={toolQty}
                  onChange={(e) => setToolQty(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowToolModal(false)}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Save Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Tool Modal */}
      {showAssignModal && selectedTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Assign Tool: {selectedTool.name}</h3>
              <span
                onClick={() => {
                  setSelectedTool(null);
                  setShowAssignModal(false);
                }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleAssignTool} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Choose Worker
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full border border-outline-variant p-2.5 rounded-lg text-sm bg-white"
                >
                  <option value="">Return to Inventory (Unassigned)</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTool(null);
                    setShowAssignModal(false);
                  }}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
