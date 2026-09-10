'use client';

import React from 'react';

export default function FraudAlertsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-2 text-xs font-bold uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Dashboard
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Alert Details</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[#ffdad6] text-[#ba1a1a] px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border border-error/20">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
            High Priority
          </span>
          <span className="text-on-surface-variant text-sm font-mono font-bold">#FA-8924</span>
        </div>
      </div>

      {/* Alert Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Worker Info Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-[0_2px_8px_rgba(13,28,50,0.05)] col-span-1 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <img
              alt="Worker photo"
              className="w-32 h-32 rounded-full object-cover border-4 border-surface shadow-sm"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAR2S7PqSA95qy0A4tmI_Up1efgaco0ekaVf0RxeESWDvaw0zNhIsGTLZNRt5n2iKU2LCZYWJ3DQYHF4OqkHj5KE2cKrae8ep9SbeM7qwTqbl2d57pVvEdMOCbQF9Ftaw4TjClbmpwwuVRcy1hSJsQ_w6zMiJgDolp3m31gCy-lG-O-ngFDKE_ILqcCg5Ckm9IeGX-Io3-B3lfO9acasN9PVyKOdMd7qtS0f0LLdCIcJlXXmWM0b5zxPQ"
            />
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#ba1a1a] rounded-full border-2 border-surface flex items-center justify-center text-white shadow">
              <span className="material-symbols-outlined text-[16px] fill">warning</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-on-surface">Marcus Thorne</h2>
          <p className="text-sm text-on-surface-variant mb-6">ID: W-492-B • Heavy Operator</p>
          <div className="w-full flex flex-col gap-1 mt-auto">
            <div className="flex justify-between py-2 border-b border-outline-variant/30 text-sm">
              <span className="font-bold text-on-surface-variant">Check-In</span>
              <span className="text-on-surface">06:45 AM</span>
            </div>
            <div className="flex justify-between py-2 border-b border-outline-variant/30 text-sm">
              <span className="font-bold text-on-surface-variant">Last Seen</span>
              <span className="font-bold text-[#ba1a1a]">07:15 AM</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="font-bold text-on-surface-variant">Zone</span>
              <span className="text-on-surface">Sector 4 (Excavation)</span>
            </div>
          </div>
        </div>

        {/* Incident Details & Timeline */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
          {/* Flagged Event Card */}
          <div className="bg-[#ffdad6]/20 border border-[#ffdad6] rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffdad6]/10 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
            <h3 className="text-xs font-bold text-[#93000a] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">flag</span>
              Flagged Event
            </h3>
            <p className="text-lg md:text-xl font-bold text-on-surface mb-2">
              Checked in, not seen on cameras or access points for 4+ hours.
            </p>
            <p className="text-sm text-on-surface-variant">
              System detected an anomaly between physical gate access logs and internal facial recognition camera feeds
              in Sector 4.
            </p>
          </div>

          {/* Timeline / Evidence */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-[0_2px_8px_rgba(13,28,50,0.05)] flex-1">
            <h3 className="text-sm font-bold text-on-surface-variant mb-6 uppercase tracking-wider">
              Evidence Timeline
            </h3>
            <div className="relative pl-6 border-l-2 border-surface-variant flex flex-col gap-6">
              {/* Timeline Item 1 */}
              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-4 h-4 bg-primary rounded-full border-2 border-surface"></div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-on-surface">Main Gate Entry</span>
                  <span className="text-xs text-on-surface-variant">06:45 AM</span>
                </div>
                <p className="text-xs text-on-surface-variant">NFC Badge Swipe recognized.</p>
              </div>

              {/* Timeline Item 2 */}
              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-4 h-4 bg-outline-variant rounded-full border-2 border-surface"></div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-on-surface">Sector 4 Camera 02</span>
                  <span className="text-xs text-on-surface-variant">07:15 AM</span>
                </div>
                <p className="text-xs text-on-surface-variant">Visual confirmation via FR system.</p>
              </div>

              {/* Timeline Item 3 (Alert) */}
              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-4 h-4 bg-[#ba1a1a] rounded-full border-2 border-surface"></div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-[#ba1a1a]">System Alert Generated</span>
                  <span className="text-xs text-on-surface-variant">11:15 AM</span>
                </div>
                <p className="text-xs text-on-surface-variant font-bold text-[#ba1a1a]">
                  Threshold of 4 hours without movement/visual ping exceeded.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-end">
            <button className="w-full sm:w-auto px-6 h-[48px] border-2 border-outline-variant text-on-surface hover:bg-surface-variant transition-colors rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">done</span>
              Acknowledge
            </button>
            <button className="w-full sm:w-auto px-6 h-[48px] bg-primary-container text-on-primary hover:opacity-90 transition-all rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md">
              <span className="material-symbols-outlined text-[18px]">search</span>
              Investigate Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
