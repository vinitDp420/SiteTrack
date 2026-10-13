'use client';

import React from 'react';
import CCTVFeed from '@/components/CCTVFeed';

export default function MonitoringPage() {
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
            Real-time edge PPE computer vision with multi-frame temporal confirmation & environmental filters.
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

      {/* Grid of Cameras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-bold text-sm text-on-surface">Channel 01 — Main Entrance</span>
            <span className="text-xs text-emerald-600 font-bold font-mono">GATE 1 • ONLINE</span>
          </div>
          <CCTVFeed
            cameraName="GATE 1 - MAIN ENTRANCE"
            hlsUrl="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
            peerId="sitetrack-admin-1"
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
          />
        </div>
      </div>
    </div>
  );
}
