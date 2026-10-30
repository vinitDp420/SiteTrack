'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useProject } from '@/lib/project-context';

interface MaterialRequest {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
  requestedBy: { name: string };
  approvedBy: { name: string } | null;
  supplier: { name: string } | null;
}

interface StockItem {
  id: string;
  itemName: string;
  quantityOnHand: number;
  unit: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  materialsSupplied: string;
}

export default function ProcurementPage() {
  const { data: session } = useSession();
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState<'requests' | 'stock' | 'suppliers'>('requests');
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showUseStockModal, setShowUseStockModal] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

  // Form states
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierMaterials, setSupplierMaterials] = useState('');
  const [useQty, setUseQty] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    if (!selectedProject) return;
    setLoading(true);
    const pid = selectedProject.id;
    Promise.all([
      fetch(`/api/procurement?type=requests&projectId=${pid}`).then((r) => r.json()),
      fetch(`/api/procurement?type=stock&projectId=${pid}`).then((r) => r.json()),
      fetch('/api/procurement?type=suppliers').then((r) => r.json()),
    ])
      .then(([reqs, stk, sups]) => {
        if (Array.isArray(reqs)) setRequests(reqs);
        if (Array.isArray(stk)) setStock(stk);
        if (Array.isArray(sups)) setSuppliers(sups);
        setLoading(false);
      })
      .catch((e) => { console.error(e); setLoading(false); });
  };

  useEffect(() => {
    if (selectedProject) fetchData();
  }, [selectedProject]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedProject) {
      setModalError('Please select an active project first.');
      return;
    }
    const cleanItem = itemName.trim();
    if (!cleanItem || cleanItem.length < 2) {
      setModalError('Item name must be at least 2 characters long.');
      return;
    }
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setModalError('Quantity must be a positive number greater than 0.');
      return;
    }
    const cleanUnit = unit.trim();
    if (!cleanUnit) {
      setModalError('Unit of measurement is required (e.g. Bags, Tons, Nos, Sq.ft).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_request',
          itemName: cleanItem,
          quantity: numQty,
          unit: cleanUnit,
          projectId: selectedProject.id,
          requestedById: (session?.user as any)?.id,
          supplierId: supplierId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setItemName('');
        setQuantity('');
        setUnit('');
        setSupplierId('');
        setModalError(null);
        setShowRequestModal(false);
        fetchData();
      } else {
        setModalError(data.error || 'Failed to file material request.');
      }
    } catch {
      setModalError('Network error while filing request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanName = supplierName.trim();
    if (!cleanName || cleanName.length < 2) {
      setModalError('Supplier company or contact name must be at least 2 characters.');
      return;
    }
    const cleanPhone = supplierPhone.trim().replace(/[\s-]/g, '');
    const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setModalError('Please enter a valid 10-digit Indian mobile number for the supplier.');
      return;
    }
    const cleanMaterials = supplierMaterials.trim();
    if (!cleanMaterials || cleanMaterials.length < 3) {
      setModalError('Please specify materials supplied by this vendor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_supplier',
          name: cleanName,
          phone: cleanPhone.startsWith('+91') ? cleanPhone.slice(3) : cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone,
          materialsSupplied: cleanMaterials,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSupplierName('');
        setSupplierPhone('');
        setSupplierMaterials('');
        setModalError(null);
        setShowSupplierModal(false);
        fetchData();
      } else {
        setModalError(data.error || 'Failed to register supplier.');
      }
    } catch {
      setModalError('Network error while registering supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRequestStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/procurement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_request_status',
          id,
          status,
          approvedById: (session?.user as any)?.id,
        }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUseStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem || !useQty) return;

    const num = parseFloat(useQty);
    if (isNaN(num) || num <= 0) {
      alert('Deduct quantity must be a positive number greater than 0.');
      return;
    }
    if (num > selectedStockItem.quantityOnHand) {
      alert(`Cannot deduct more than available quantity on hand (${selectedStockItem.quantityOnHand} ${selectedStockItem.unit}).`);
      return;
    }

    try {
      const res = await fetch('/api/procurement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'use_stock_item',
          id: selectedStockItem.id,
          quantityToUse: num,
        }),
      });
      if (res.ok) {
        setUseQty('');
        setSelectedStockItem(null);
        setShowUseStockModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = '';

    if (activeTab === 'requests') {
      if (requests.length === 0) return;
      headers = ['Item Name', 'Quantity', 'Unit', 'Status', 'Requested By', 'Approved By', 'Supplier', 'Project'];
      rows = requests.map((r) => [
        `"${r.itemName.replace(/"/g, '""')}"`,
        r.quantity,
        `"${r.unit}"`,
        `"${r.status}"`,
        `"${r.requestedBy?.name || 'Unknown'}"`,
        `"${r.approvedBy?.name || 'Pending'}"`,
        `"${r.supplier?.name || 'Unassigned'}"`,
        `"${selectedProject?.name || ''}"`,
      ]);
      filename = `MaterialRequests_${selectedProject?.code || 'Export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeTab === 'stock') {
      if (stock.length === 0) return;
      headers = ['Item Name', 'Quantity On Hand', 'Unit', 'Project'];
      rows = stock.map((s) => [
        `"${s.itemName.replace(/"/g, '""')}"`,
        s.quantityOnHand,
        `"${s.unit}"`,
        `"${selectedProject?.name || ''}"`,
      ]);
      filename = `StockInventory_${selectedProject?.code || 'Export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      if (suppliers.length === 0) return;
      headers = ['Supplier Name', 'Phone', 'Materials Supplied'];
      rows = suppliers.map((sup) => [
        `"${sup.name.replace(/"/g, '""')}"`,
        `"${sup.phone || ''}"`,
        `"${(sup.materialsSupplied || '').replace(/"/g, '""')}"`,
      ]);
      filename = `Suppliers_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentTabCount = activeTab === 'requests' ? requests.length : activeTab === 'stock' ? stock.length : suppliers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Procurement & Inventory</h1>
          <p className="text-sm text-on-surface-variant mt-1">Manage purchase workflows and stock levels.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={currentTabCount === 0}
            className="bg-white border border-outline-variant hover:bg-slate-50 text-on-surface font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition disabled:opacity-50"
            title="Export active table to CSV / Excel"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">download</span>
            Export CSV
          </button>
          {activeTab === 'requests' && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span> Request Materials
            </button>
          )}
          {activeTab === 'suppliers' && (
            <button
              onClick={() => setShowSupplierModal(true)}
              className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase border-b-2 transition-all ${
            activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Material Requests
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase border-b-2 transition-all ${
            activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Stock Inventory
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase border-b-2 transition-all ${
            activeTab === 'suppliers' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Suppliers
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold">Loading records...</div>
      ) : (
        <div className="animate-fade-in">
          {/* TAB 1: MATERIAL REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="bg-white border border-outline-variant rounded-2xl p-10 text-center shadow-sm">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">shopping_cart</span>
                  <p className="text-sm font-bold text-on-surface-variant mt-2">No material requests filed yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {requests.map((r) => {
                    const statusConfig = (() => {
                      switch (r.status) {
                        case 'RECEIVED':
                          return {
                            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                            icon: 'check_circle',
                            label: 'Received',
                          };
                        case 'ORDERED':
                          return {
                            bg: 'bg-amber-50 text-amber-700 border-amber-200/60',
                            icon: 'local_shipping',
                            label: 'Ordered',
                          };
                        case 'APPROVED':
                          return {
                            bg: 'bg-blue-50 text-blue-700 border-blue-200/60',
                            icon: 'thumb_up',
                            label: 'Approved',
                          };
                        case 'REQUESTED':
                        default:
                          return {
                            bg: 'bg-slate-50 text-slate-700 border-slate-200/60',
                            icon: 'hourglass_empty',
                            label: 'Requested',
                          };
                      }
                    })();

                    return (
                      <div
                        key={r.id}
                        className="bg-white border border-outline-variant/60 rounded-2xl p-5 shadow-[0_2px_12px_rgba(13,28,50,0.04)] hover:shadow-[0_8px_24px_rgba(13,28,50,0.08)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[24px]">
                              {r.itemName.toLowerCase().includes('cement')
                                ? 'package'
                                : r.itemName.toLowerCase().includes('concrete')
                                ? 'layers'
                                : r.itemName.toLowerCase().includes('steel') || r.itemName.toLowerCase().includes('rebar')
                                ? 'hardware'
                                : 'shopping_bag'}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-bold text-on-surface text-base">{r.itemName}</h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                              <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                                {r.quantity} {r.unit}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">store</span>
                                {r.supplier?.name || 'Any Supplier'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-outline-variant/30 pt-3 md:pt-0">
                          <div className="md:text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{statusConfig.icon}</span>
                              {statusConfig.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {r.status === 'REQUESTED' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, 'APPROVED')}
                                className="h-9 px-4 bg-gradient-to-r from-primary to-[#1a3a6e] hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                                Approve
                              </button>
                            )}
                            {r.status === 'APPROVED' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, 'ORDERED')}
                                className="h-9 px-4 bg-gradient-to-r from-[#b87500] to-[#e09800] hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                                Mark Ordered
                              </button>
                            )}
                            {r.status === 'ORDERED' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, 'RECEIVED')}
                                className="h-9 px-4 bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Received
                              </button>
                            )}
                            {r.status === 'RECEIVED' && (
                              <span className="text-xs text-on-surface-variant font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                                Done
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {/* TAB 2: INVENTORY STOCK */}
          {activeTab === 'stock' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stock.length === 0 ? (
                <div className="col-span-2 bg-white border border-outline-variant rounded-2xl p-10 text-center shadow-sm">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">inventory_2</span>
                  <p className="text-sm font-bold text-on-surface-variant mt-2">No items currently in stock.</p>
                </div>
              ) : (
                stock.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-outline-variant/60 rounded-2xl p-5 shadow-[0_2px_12px_rgba(13,28,50,0.04)] hover:shadow-[0_8px_24px_rgba(13,28,50,0.08)] transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[24px]">
                          {item.itemName.toLowerCase().includes('cement')
                            ? 'package'
                            : item.itemName.toLowerCase().includes('concrete')
                            ? 'layers'
                            : item.itemName.toLowerCase().includes('steel') || item.itemName.toLowerCase().includes('rebar')
                            ? 'hardware'
                            : 'inventory_2'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-on-surface text-base">{item.itemName}</h4>
                        <p className="text-xs text-on-surface-variant mt-0.5">On-site Stock level</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-lg font-black text-primary block">
                          {item.quantityOnHand}
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          {item.unit}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedStockItem(item);
                          setShowUseStockModal(true);
                        }}
                        className="h-9 px-3 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}


          {/* TAB 3: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suppliers.length === 0 ? (
                <p className="text-sm text-on-surface-variant p-6">No suppliers registered.</p>
              ) : (
                suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border border-outline-variant rounded-xl p-6 shadow-[0_2px_8px_rgba(13,28,50,0.05)] space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base text-primary">{s.name}</h4>
                      <span className="text-xs text-on-surface-variant font-mono">{s.phone}</span>
                    </div>
                    <div className="text-xs text-on-surface-variant pt-2 border-t border-outline-variant/30">
                      <span className="font-bold uppercase tracking-wider block mb-1">Materials Supplied:</span>
                      <p>{s.materialsSupplied}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Request Materials Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">File Material Request</h3>
              <span
                onClick={() => { setShowRequestModal(false); setModalError(null); }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Portland Cement, Gravel"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                    placeholder="e.g. 100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                    placeholder="e.g. Bags, Tons"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                  Preferred Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full border border-outline-variant p-2.5 rounded-lg text-sm bg-white"
                >
                  <option value="">Choose Supplier (Optional)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  File Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Register New Supplier</h3>
              <span
                onClick={() => { setShowSupplierModal(false); setModalError(null); }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Apex Steel Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  required
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. +1 (555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Materials Supplied
                </label>
                <textarea
                  required
                  rows={2}
                  value={supplierMaterials}
                  onChange={(e) => setSupplierMaterials(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder="e.g. Structural steel plates, Rebars, Cement"
                />
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Use Stock Modal */}
      {showUseStockModal && selectedStockItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full border border-outline-variant p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-primary">Use Stock: {selectedStockItem.itemName}</h3>
              <span
                onClick={() => {
                  setSelectedStockItem(null);
                  setShowUseStockModal(false);
                }}
                className="material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-primary"
              >
                close
              </span>
            </div>
            <form onSubmit={handleUseStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Quantity to Deduct ({selectedStockItem.unit})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedStockItem.quantityOnHand}
                  value={useQty}
                  onChange={(e) => setUseQty(e.target.value)}
                  className="w-full border border-outline-variant p-2 rounded-lg text-sm"
                  placeholder={`Max: ${selectedStockItem.quantityOnHand}`}
                />
              </div>
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStockItem(null);
                    setShowUseStockModal(false);
                  }}
                  className="px-4 py-2 border border-outline-variant text-xs font-bold uppercase tracking-wider rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ba1a1a] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow"
                >
                  Deduct Quantity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
