'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CCTVFeedProps {
  cameraName?: string;
}

export default function CCTVFeed({
  cameraName = 'GATE 01 - SAFETY CAM',
}: CCTVFeedProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState(false);

  // Automatic AI Recognition States
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [helmetDetected, setHelmetDetected] = useState<boolean>(true);

  const [currentTime, setCurrentTime] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Real-time HUD Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
          ' ' +
          new Date().toLocaleTimeString('en-IN')
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate periodic scanning
  useEffect(() => {
    const interval = setInterval(() => {
      setIsScanning(true);
      setTimeout(() => setIsScanning(false), 800);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopWebcam();
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  // Attach webcam stream when video tag mounts
  useEffect(() => {
    if (useWebcam && webcamStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = webcamStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [useWebcam]);

  // Webcam handler - Defaults Helmet: MISSING when webcam turns on
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      webcamStreamRef.current = stream;
      setUseWebcam(true);
      setHelmetDetected(false); // Live user webcam starts with Helmet MISSING until toggled
      setVideoSrc(null);
    } catch (err: any) {
      alert(`Could not access webcam: ${err.message || 'Please check browser camera permissions.'}`);
    }
  };

  const stopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
    setUseWebcam(false);
    setHelmetDetected(true);
  };

  // Canvas CCTV Animation Loop
  useEffect(() => {
    if (videoSrc || useWebcam) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let scanY = 50;
    let scanDirection = 1;
    let workerX = 180;
    let workerDirection = 0.5;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. Dark CCTV Background Gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0c1524');
      grad.addColorStop(1, '#050a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 2. Perspective Construction Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let j = 0; j < h; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }

      // 3. Construction Gate Outline
      ctx.strokeStyle = 'rgba(255, 185, 95, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 40, w - 60, h - 80);

      ctx.fillStyle = 'rgba(255, 185, 95, 0.08)';
      ctx.fillRect(30, 40, 25, h - 80);
      ctx.fillRect(w - 55, 40, 25, h - 80);

      // 4. Moving Worker Silhouette
      workerX += workerDirection;
      if (workerX > w - 180 || workerX < 140) workerDirection *= -1;

      const workerY = h / 2 - 20;

      // Draw Hardhat if Helmet detected
      if (helmetDetected) {
        ctx.fillStyle = '#e09800'; // Safety Yellow Helmet
        ctx.beginPath();
        ctx.arc(workerX, workerY - 30, 16, Math.PI, 0);
        ctx.fill();
      }

      // Head circle
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.arc(workerX, workerY - 20, 14, 0, Math.PI * 2);
      ctx.fill();

      // Torso / Vest
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.roundRect(workerX - 18, workerY - 5, 36, 45, 6);
      ctx.fill();

      // Vest stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(workerX - 14, workerY + 5, 8, 30);
      ctx.fillRect(workerX + 6, workerY + 5, 8, 30);

      // 5. AI Laser Scan Line
      scanY += scanDirection * 1.5;
      if (scanY > h - 60 || scanY < 50) scanDirection *= -1;

      ctx.strokeStyle = isScanning
        ? 'rgba(59, 130, 246, 0.8)'
        : helmetDetected
        ? 'rgba(16, 185, 129, 0.4)'
        : 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, scanY);
      ctx.lineTo(w - 30, scanY);
      ctx.stroke();

      // 6. AI Detection Bounding Box on Worker
      const boxW = 80;
      const boxH = 95;
      const boxX = workerX - boxW / 2;
      const boxY = workerY - 45;

      const accentColor = isScanning ? '#3b82f6' : helmetDetected ? '#10b981' : '#ef4444';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = isScanning
        ? 'rgba(59, 130, 246, 0.2)'
        : helmetDetected
        ? 'rgba(16, 185, 129, 0.12)'
        : 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // Bounding box corners
      ctx.fillStyle = accentColor;
      ctx.fillRect(boxX - 2, boxY - 2, 8, 8);
      ctx.fillRect(boxX + boxW - 6, boxY - 2, 8, 8);
      ctx.fillRect(boxX - 2, boxY + boxH - 6, 8, 8);
      ctx.fillRect(boxX + boxW - 6, boxY + boxH - 6, 8, 8);

      // Tag Label
      ctx.fillStyle = isScanning ? '#1d4ed8' : helmetDetected ? '#059669' : '#dc2626';
      ctx.fillRect(boxX - 10, boxY - 24, 130, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      const labelText = isScanning
        ? '🔍 SCANNING PPE...'
        : `${helmetDetected ? 'HELMET: OK ✓' : '⚠️ HELMET: MISSING'}`;
      ctx.fillText(labelText, boxX - 5, boxY - 10);

      // 7. Video Scanline Effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      for (let i = 0; i < h; i += 4) {
        ctx.fillRect(0, i, w, 2);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [videoSrc, useWebcam, isScanning, helmetDetected]);

  return (
    <div className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(13,28,50,0.06)] flex flex-col">
      {/* Top Header / Channel controls */}
      <div className="p-3 bg-surface-container-low border-b border-outline-variant/40 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">videocam</span>
          <span className="font-bold text-sm text-on-surface">{cameraName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Helmet Wear Detection Toggle */}
          <button
            onClick={() => setHelmetDetected(!helmetDetected)}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all border shadow-sm ${
              helmetDetected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-red-600 text-white border-red-700 animate-pulse font-extrabold'
            }`}
            title="Toggle PPE hardhat helmet detection status"
          >
            <span className="material-symbols-outlined text-[16px]">
              {helmetDetected ? 'shield' : 'warning'}
            </span>
            Helmet: {helmetDetected ? 'WORN ✓' : 'MISSING ⚠️'}
          </button>

          {/* Media Feed Controls */}
          <label className="cursor-pointer px-2.5 py-1 bg-white border border-outline-variant hover:bg-surface-variant text-primary text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition">
            <span className="material-symbols-outlined text-[14px]">upload</span> Video
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {!useWebcam ? (
            <button
              onClick={startWebcam}
              className="px-2.5 py-1 bg-primary text-on-primary text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:opacity-90 transition"
            >
              <span className="material-symbols-outlined text-[14px]">videocam</span> Webcam
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="px-2.5 py-1 bg-[#ba1a1a] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:opacity-90 transition"
            >
              Stop Webcam
            </button>
          )}
        </div>
      </div>

      {/* Main Stream Frame */}
      <div className="relative aspect-video bg-black flex items-center justify-center text-white overflow-hidden group">
        {/* 1. Custom Uploaded Video */}
        {videoSrc && !useWebcam && (
          <video
            key={videoSrc}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {/* 2. Live Webcam Stream */}
        {useWebcam && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* 3. HTML5 Canvas AI Simulation (Fallback) */}
        {!videoSrc && !useWebcam && (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
        )}

        {/* Dynamic Bounding Box Overlay for Video/Webcam */}
        {(videoSrc || useWebcam) && (
          <div
            className={`absolute top-[18%] left-[30%] w-[40%] h-[55%] border-2 rounded-2xl pointer-events-none transition-all duration-300 ${
              isScanning
                ? 'border-sky-400 bg-sky-500/20 shadow-[0_0_25px_rgba(56,189,248,0.6)] animate-pulse'
                : helmetDetected
                ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                : 'border-red-500 bg-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse'
            }`}
          >
            {/* Top Label Tag */}
            <div
              className={`absolute -top-7 left-0 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md shadow flex items-center gap-1.5 ${
                isScanning
                  ? 'bg-sky-600 animate-pulse'
                  : helmetDetected
                  ? 'bg-emerald-600'
                  : 'bg-red-600 animate-bounce'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">
                {isScanning ? 'sync' : helmetDetected ? 'shield' : 'warning'}
              </span>
              <span>
                {isScanning ? '🔍 SCANNING PPE...' : helmetDetected ? 'HELMET: OK ✓' : '⚠️ HELMET: MISSING!'}
              </span>
            </div>

            {/* Corner Brackets */}
            <div
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-r-2 border-b-2 ${
                isScanning ? 'border-sky-400' : helmetDetected ? 'border-emerald-400' : 'border-red-500'
              }`}
            />
            <div
              className={`absolute -top-1 -left-1 w-3.5 h-3.5 border-l-2 border-t-2 ${
                isScanning ? 'border-sky-400' : helmetDetected ? 'border-emerald-400' : 'border-red-500'
              }`}
            />
          </div>
        )}

        {/* Top Left HUD */}
        <div
          className={`absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 border border-white/10 z-10 ${
            isScanning ? 'text-sky-400' : helmetDetected ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-ping ${
              isScanning ? 'bg-sky-400' : helmetDetected ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          {cameraName} • REC 🔴
        </div>

        {/* Top Right Time HUD */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-mono text-white/90 border border-white/10 z-10">
          {currentTime || 'LIVE STREAM'}
        </div>

        {/* Bottom HUD Bar */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md p-2.5 rounded-xl border border-white/10 flex flex-wrap justify-between items-center text-xs z-10 gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border text-sm ${
              isScanning ? 'bg-sky-500/20 text-sky-400 border-sky-400 animate-pulse' :
              helmetDetected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' : 'bg-red-500/20 text-red-300 border-red-400 animate-pulse'
            }`}>
              <span className="material-symbols-outlined">{isScanning ? 'search' : helmetDetected ? 'health_and_safety' : 'warning'}</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm">AI Safety Monitor</span>
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  isScanning ? 'text-sky-400' : helmetDetected ? 'text-emerald-400' : 'text-red-400 animate-pulse'
                }`}
              >
                {isScanning ? 'Analyzing video frames...' : `Status: ${helmetDetected ? 'All Clear' : 'Violation Detected!'}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
