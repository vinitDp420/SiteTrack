'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

interface BOQItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  estimatedCost: number;
}

const INR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function BOQPage() {
  const { selectedProject } = useProject();
  const [items, setItems] = useState<BOQItem[]>([]);
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProject) fetchBOQ();
  }, [selectedProject]);

  const fetchBOQ = () => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/boq?projectId=${selectedProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !unit || !quantity || !estimatedCost || !selectedProject) return;

    try {
      const res = await fetch('/api/boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          unit,
          quantity,
          estimatedCost,
          projectId: selectedProject.id,
        }),
      });
      if (res.ok) {
        setDescription('');
        setUnit('');
        setQuantity('');
        setEstimatedCost('');
        setShowAddModal(false);
        fetchBOQ();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this BOQ line item?')) return;
    try {
      const res = await fetch(`/api/boq?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchBOQ();
    } catch (err) {
      console.error(err);
    }
  };

  const totalBudget = items.reduce((sum, item) => sum + item.estimatedCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Bill of Quantities (BOQ)</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject ? (
              <>Estimate ledger for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            ) : (
              'Select a project to view BOQ.'
            )}
          </p>
        </div>
        {selectedProject && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add Item
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Estimated Budget</p>
          <h3 className="text-3xl font-black mt-2">{INR(totalBudget)}</h3>
          <p className="text-xs opacity-70 mt-1">{items.length} line item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Average Cost / Item</p>
          <h3 className="text-2xl font-black mt-2 text-on-surface">
            {items.length > 0 ? INR(totalBudget / items.length) : '₹0'}
          </h3>
        </div>
        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Project</p>
          <h3 className="text-base font-black mt-2 text-primary truncate">
            {selectedProject?.name || '—'}
          </h3>
          <p className="text-xs text-on-surface-variant font-mono">{selectedProject?.code}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold text-on-surface-variant">
          {selectedProject ? 'Loading BOQ schedule...' : 'Please select a project from the top bar.'}
        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Unit</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2 text-right">Est. Cost (₹)</div>
            <div className="col-span-1 text-center">Del</div>
          </div>

          <div className="divide-y divide-outline-variant">
            {items.length === 0 ? (
              <div className="p-10 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">list_alt</span>
                <p className="text-sm text-on-surface-variant mt-2 font-bold">No BOQ items added yet for this project.</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={item.id} className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center text-sm ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <div className="col-span-5 font-bold text-on-surface">{item.description}</div>
                  <div className="col-span-2 text-on-surface-variant">{item.unit}</div>
                  <div className="col-span-2 text-on-surface-variant">{item.quantity}</div>
                  <div className="col-span-2 text-right font-black text-primary">{INR(item.estimatedCost)}</div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-[#ba1a1a] hover:opacity-80 p-1 flex items-center justify-center rounded"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total Row */}
          {items.length > 0 && (
            <div className="px-6 py-4 bg-surface-container border-t-2 border-primary/20 flex justify-between items-center">
              <span className="text-sm font-black text-on-surface uppercase tracking-wider">TOTAL PROJECT BUDGET</span>
              <span className="text-xl font-black text-primary">{INR(totalBudget)}</span>
            </div>
          )}
        </div>
      )}

      {/* Add BOQ Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-outline-variant p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <div>
                <h3 className="text-base font-bold text-primary">Add BOQ Line Item</h3>
                <p className="text-xs text-on-surface-variant">{selectedProject?.name}</p>
              </div>
              <span onClick={() => setShowAddModal(false)} className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary">close</span>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Item Description</label>
                <input
                  type="text" required value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none"
                  placeholder="e.g. RCC M25 Concrete, Steel Rebars"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Unit</label>
                  <input
                    type="text" required value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none"
                    placeholder="m³, Bags, MT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Quantity</label>
                  <input
                    type="number" required value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-outline-variant p-2.5 rounded-xl text-sm focus:border-primary outline-none"
                    placeholder="50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Estimated Cost (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                  <input
                    type="number" required value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full border border-outline-variant pl-8 p-2.5 rounded-xl text-sm focus:border-primary outline-none"
                    placeholder="125000"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-xl shadow">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
