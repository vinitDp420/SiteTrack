'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useProject } from '@/lib/project-context';

const CCTVFeed = dynamic(() => import('@/components/CCTVFeed'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-3 border border-outline-variant/30">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-slate-300">Loading AI Camera Stream...</span>
    </div>
  ),
});

interface DemoMode {
  id: string;
  label: string;
  description: string;
  color: string;
  borderColor: string;
  textColor: string;
  scenario: string;
  mode: 'helmet' | 'no-helmet';
}

const DEMO_MODES: DemoMode[] = [
  {
    id: 'helmet',
    label: 'Worker WITH Helmet (Compliant)',
    description: 'Canvas simulation — green box, HELMET: OK badge, no violation',
    color: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-800',
    scenario: 'Compliant worker — PPE check passed',
    mode: 'helmet',
  },
  {
    id: 'no-helmet',
    label: 'Worker WITHOUT Helmet (Violation)',
    description: 'Canvas simulation — red box, NO HELMET badge, auto-alert to Fraud Surveillance',
    color: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-800',
    scenario: 'Non-compliant worker — 10% payroll penalty applied',
    mode: 'no-helmet',
  },
];

export default function MonitoringPage() {
  const { selectedProject } = useProject();
  const [selectedDemo, setSelectedDemo] = useState<DemoMode | null>(null);
  const [autoDispatchViolations, setAutoDispatchViolations] = useState<boolean>(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Camera Monitoring</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
              GAPS 2 & 3 FULFILLED
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time edge PPE computer vision with multi-frame temporal confirmation &amp; environmental filters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            2 Channels Active
          </span>
        </div>
      </div>

      {/* Research Gap 2 & Gap 3 System Architecture Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-800/60 p-4 rounded-xl text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-emerald-400 text-base">filter_drama</span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-mono">
              GAP 2: Environmental Robustness (System Level)
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Overcomes single-frame academic benchmark failures via <strong className="text-white">5-second Multi-Frame Temporal Filtering</strong> (rejects transient occlusion noise) and <strong className="text-white">Active Environmental Preprocessing</strong> (Night Boost, Solar Glare Shield, Dust Defogger).
          </p>
        </div>

        <div className="bg-gradient-to-r from-cyan-950/70 to-indigo-950/70 border border-cyan-800/60 p-4 rounded-xl text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-cyan-400 text-base">memory</span>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
              GAP 3: Zero-Overhead Edge Deployment
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Eliminates high-cost $5,000+ GPU servers and remote RTSP bandwidth bottlenecks using <strong className="text-white">Browser-Based WebGPU/WASM Inference</strong>. Only <strong className="text-white">0.25 KB JSON telemetry</strong> leaves the edge—no video streamed to cloud.
          </p>
        </div>
      </div>

      {/* ============================================
           DEMO MODE SELECTOR — For Faculty Demonstration
           Works 100% — no video files, no camera, no pixel analysis
           ============================================ */}
      <div className="bg-[#f8fafc] border border-blue-200/50 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-blue-600 text-xl">play_circle</span>
          <h2 className="text-lg font-bold text-slate-800">Faculty Demo — Worker PPE Detection</h2>
          <span className="ml-auto text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            Click → Channel 01 (canvas simulation)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {DEMO_MODES.map((demo) => (
            <button
              key={demo.id}
              onClick={() => setSelectedDemo(demo)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                selectedDemo?.id === demo.id
                  ? 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-200/50'
                  : `${demo.color} ${demo.borderColor} hover:border-blue-400 hover:bg-blue-50/50`
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center ${
                demo.mode === 'helmet' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
              }">
                <span className="material-symbols-outlined text-[20px]">
                  {demo.mode === 'helmet' ? 'construction' : 'warning'}
                </span>
              </div>
              <span className="text-sm font-bold text-slate-700 leading-tight text-center">{demo.label}</span>
              <span className="text-[10px] text-slate-500 leading-tight text-center">{demo.scenario}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoDispatchViolations}
              onChange={(e) => setAutoDispatchViolations(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Auto-dispatch violation to Fraud Surveillance &amp; Payroll (no-helmet demo)
          </label>
          {selectedDemo && (
            <div className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold ${
              selectedDemo.mode === 'helmet'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-rose-100 text-rose-700 border border-rose-200'
            }`}>
              {selectedDemo.mode === 'helmet' ? '✅ COMPLIANT' : '🚨 VIOLATION'}
            </div>
          )}
        </div>

        <p className="mt-3 text-sm text-slate-600">
          {selectedDemo ? (
            <>
              <span className="font-semibold text-slate-800">{selectedDemo.label}</span>{' '}
              - {selectedDemo.description}
            </>
          ) : (
            'Select a demo mode above to load the canvas simulation into Channel 01 below.'
          )}
        </p>
      </div>

      {/* Grid of Cameras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-bold text-sm text-on-surface">
              Channel 01 — Main Entrance {selectedDemo ? `• ${selectedDemo.label}` : ''}
            </span>
            <span className="text-xs text-emerald-600 font-bold font-mono">GATE 1 • ONLINE</span>
          </div>
          <CCTVFeed
            cameraName={selectedDemo ? `Demo: ${selectedDemo.label}` : 'GATE 1 - MAIN ENTRANCE'}
            peerId="sitetrack-admin-1"
            projectId={selectedProject?.id}
            demoMode={selectedDemo ? selectedDemo.mode : 'none'}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-bold text-sm text-on-surface">Channel 02 — Back Logistics</span>
            <span className="text-xs text-sky-600 font-bold font-mono">GATE 2 • ONLINE</span>
          </div>
          <CCTVFeed
            cameraName="GATE 2 - LOGISTICS"
            peerId="sitetrack-admin-2"
            projectId={selectedProject?.id}
          />
        </div>
      </div>
    </div>
  );
}
