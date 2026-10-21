'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function CameraNode() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState('Ready to broadcast');
  const [channel, setChannel] = useState('sitetrack-admin-1');
  const [isStreaming, setIsStreaming] = useState(false);
  const [httpRestriction, setHttpRestriction] = useState(false);
  const peerRef = useRef<any>(null);

  // Read ?channel= from URL if scanned or shared
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlChannel = params.get('channel');
      if (urlChannel) setChannel(urlChannel);

      // Check if browser blocks getUserMedia because of HTTP origin
      if (!window.isSecureContext && !navigator.mediaDevices?.getUserMedia) {
        setHttpRestriction(true);
      }
    }
  }, []);

  const startBroadcast = async () => {
    try {
      setStatus('Checking camera support...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHttpRestriction(true);
        setStatus('Camera blocked by browser on HTTP.');
        return;
      }

      setStatus('Requesting camera permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setStatus('Connecting to WebRTC cloud server...');
      const { default: Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
        setStatus(`Calling Target: ${channel}...`);
        const call = peer.call(channel, stream);
        
        call.on('error', (err) => {
          setStatus('Call Error: ' + err.message);
        });

        setIsStreaming(true);
        setStatus(`LIVE: Streaming to PC (${channel})`);
      });

      peer.on('error', (err) => {
        setStatus(`Signaling Error: ${err.type}`);
        setIsStreaming(false);
      });

    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('Camera permission denied.');
      } else {
        setStatus(`Error: ${err.message || 'Camera unavailable'}`);
        if (!window.isSecureContext) setHttpRestriction(true);
      }
      setIsStreaming(false);
    }
  };

  const stopBroadcast = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    setIsStreaming(false);
    setStatus('Broadcast stopped.');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-emerald-400 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined">satellite_alt</span>
          Edge Stream Node
        </h1>
        <p className="text-gray-400 text-sm mb-4">
          Stream this phone live to the PC Dashboard for real-time Edge AI PPE detection.
        </p>

        {/* HTTP Restriction Alert & Solution */}
        {httpRestriction && (
          <div className="mb-4 bg-amber-950/85 border border-amber-600/70 p-4 rounded-xl text-xs text-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <span className="material-symbols-outlined text-[18px]">security</span>
              Mobile Chrome HTTP Restriction
            </div>
            <p className="leading-relaxed">
              Mobile Chrome blocks camera access on local HTTP IP addresses. To unlock your camera in 20 seconds:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] font-mono text-amber-100">
              <li>In phone Chrome address bar, open: <strong className="text-white">chrome://flags</strong></li>
              <li>Search: <strong className="text-white">unsafely-treat-insecure-origin-as-secure</strong></li>
              <li>Add: <strong className="text-white">{typeof window !== 'undefined' ? window.location.origin : 'http://192.168.0.102:3000'}</strong></li>
              <li>Set to <strong>Enabled</strong> &amp; tap <strong>Relaunch</strong>.</li>
            </ol>
            <p className="text-[10px] text-amber-300/80 pt-1 border-t border-amber-800">
              Tip: You can also open this link in <strong>Firefox for Android</strong> or connect via <strong>Iriun Webcam USB cable</strong> for zero configuration.
            </p>
          </div>
        )}

        {/* Target Channel Input */}
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Target PC Channel ID
          </label>
          <input 
            type="text"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            value={channel}
            onChange={(e) => setChannel(e.target.value.trim())}
            disabled={isStreaming}
            placeholder="e.g. sitetrack-admin-1"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Type or check the ID shown on your PC dashboard button (e.g. <span className="font-mono text-emerald-400">sitetrack-admin-1</span>).
          </p>
        </div>

        {/* Live Preview Viewport */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-gray-700 mb-4 flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`} 
          />
          {!isStreaming && (
            <span className="material-symbols-outlined text-gray-700 text-6xl">
              videocam_off
            </span>
          )}
          {isStreaming && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full"></span> LIVE STREAMING
            </div>
          )}
        </div>

        {/* Status Pill */}
        <div className="text-center mb-5">
          <span className={`text-xs font-mono px-3 py-1.5 rounded-full inline-block ${isStreaming ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-gray-800 text-gray-300'}`}>
            {status}
          </span>
        </div>

        {/* Action Button */}
        {!isStreaming ? (
          <button 
            onClick={startBroadcast}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/40"
          >
            <span className="material-symbols-outlined">sensors</span>
            Start Live Broadcast
          </button>
        ) : (
          <button 
            onClick={stopBroadcast}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <span className="material-symbols-outlined">stop_circle</span>
            Stop Broadcast
          </button>
        )}
      </div>
    </div>
  );
}
