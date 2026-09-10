'use client';

import React from 'react';
import CCTVFeed from '@/components/CCTVFeed';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Camera Monitoring</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Automated facial recognition & PPE detection streams across gate channels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            2 Channels Active
          </span>
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
            defaultWorkerName="Raj Kumar Singh"
            defaultConfidence="98.4%"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-bold text-sm text-on-surface">Channel 02 — Back Logistics</span>
            <span className="text-xs text-sky-600 font-bold font-mono">GATE 2 • ONLINE</span>
          </div>
          <CCTVFeed
            cameraName="GATE 2 - LOGISTICS"
            defaultWorkerName="Ramesh Yadav"
            defaultConfidence="96.8%"
          />
        </div>
      </div>
    </div>
  );
}
