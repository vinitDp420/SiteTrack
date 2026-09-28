'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-webgpu';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import Hls from 'hls.js';

interface CCTVFeedProps {
  cameraName?: string;
  hlsUrl?: string;
  projectId?: string;
}

export default function CCTVFeed({
  cameraName = 'GATE 01 - SAFETY CAM',
  hlsUrl,
  projectId,
}: CCTVFeedProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState(false);

  // Automatic AI Recognition States
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [helmetDetected, setHelmetDetected] = useState<boolean>(true);
  const [helmetColor, setHelmetColor] = useState<string>('Any');

  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Real AI States
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [predictions, setPredictions] = useState<cocoSsd.DetectedObject[]>([]);
  const [modelLoading, setModelLoading] = useState(true);

  // Violation tracking
  const [missingHelmetTime, setMissingHelmetTime] = useState<number>(0);
  const violationSentRef = useRef<boolean>(false);

  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Load TensorFlow.js Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Optimizing Edge Inference as per Paper's Gap 3
        try {
          setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tf.version_core}/dist/`);
          await tf.setBackend('webgpu');
          await tf.ready();
          console.log('Edge AI: WebGPU backend active');
        } catch (e1) {
          try {
            await tf.setBackend('wasm');
            await tf.ready();
            console.log('Edge AI: WASM backend active');
          } catch (e2) {
            await tf.ready();
            console.log('Edge AI: WebGL default active');
          }
        }

        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
      } catch (err) {
        console.error("Failed to load TFJS model:", err);
      } finally {
        setModelLoading(false);
      }
    };
    loadModel();
  }, []);

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

  // HLS stream loader
  useEffect(() => {
    if (hlsUrl && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = hlsUrl;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [hlsUrl]);

  // Violation reporting logic (Phi_compliance integration)
  useEffect(() => {
    let interval: number;
    if (!helmetDetected) {
      interval = window.setInterval(() => {
        setMissingHelmetTime((prev) => prev + 1);
      }, 1000);
    } else {
      setMissingHelmetTime(0);
      violationSentRef.current = false;
    }
    return () => clearInterval(interval);
  }, [helmetDetected]);

  useEffect(() => {
    // If missing helmet for 5+ seconds, log violation to backend
    if (missingHelmetTime >= 5 && !violationSentRef.current) {
      violationSentRef.current = true;
      fetch('/api/safety-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || 'demo',
          cameraName,
        }),
      }).then(res => res.json())
        .then(data => console.log('Safety violation API response:', data))
        .catch(console.error);
    }
  }, [missingHelmetTime, cameraName, projectId]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopWebcam();
      // Explicitly clear srcObject so the browser respects the src attribute
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  // Attach webcam stream when video tag mounts
  useEffect(() => {
    if (useWebcam && webcamStreamRef.current && videoRef.current) {
      // Explicitly clear src so srcObject takes full precedence
      videoRef.current.removeAttribute('src');
      videoRef.current.srcObject = webcamStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [useWebcam]);

  // Webcam handler
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      webcamStreamRef.current = stream;
      setUseWebcam(true);
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setUseWebcam(false);
    setPredictions([]);
    setHelmetDetected(true);
  };

  // Live AI Inference Loop for WebCam/Video
  useEffect(() => {
    let animId: number;
    const detectFrame = async () => {
      if (model && videoRef.current && videoRef.current.readyState >= 2) {
        if ((useWebcam || videoSrc) && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
           try {
             const preds = await model.detect(videoRef.current);
             setPredictions(preds);
           } catch (e) {
             console.error('TFJS Detection Error:', e);
           }
        }
      }
      animId = requestAnimationFrame(detectFrame);
    };
    detectFrame();
    return () => cancelAnimationFrame(animId);
  }, [model, useWebcam, videoSrc]);

  // Drawing AI Overlays for Real Inference + Color Heuristic
  useEffect(() => {
    if (!useWebcam && !videoSrc) return;
    const canvas = aiCanvasRef.current;
    if (!canvas || !videoRef.current) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Hidden canvas for reading pixel data
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    let animId: number;
    const renderOverlays = () => {
       if (videoRef.current) {
         canvas.width = videoRef.current.videoWidth || 640;
         canvas.height = videoRef.current.videoHeight || 360;
         
         if (hiddenCtx) {
           hiddenCanvas.width = canvas.width;
           hiddenCanvas.height = canvas.height;
           hiddenCtx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
         }
       }

       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       let allHelmetsOk = true;
       let personCount = 0;
       
       predictions.forEach(prediction => {
         const [x, y, width, height] = prediction.bbox;
         const isPerson = prediction.class === 'person';
         
         let hasHelmet = false;

         if (isPerson) {
             personCount++;
             if (hiddenCtx) {
                 // Crop the top 20% of the bounding box (Head region)
                 const headY = Math.max(0, y);
                 const headX = Math.max(0, x);
                 const headW = Math.min(canvas.width - headX, width);
                 const headH = Math.min(canvas.height - headY, height * 0.2);

                 if (headW > 0 && headH > 0) {
                     const imgData = hiddenCtx.getImageData(headX, headY, headW, headH);
                     const data = imgData.data;
                     let safetyColorPixels = 0;

                     for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i+1];
                        const b = data[i+2];
                        
                        let isMatch = false;
                        
                        // Dynamic Color Heuristics (Robust to lighting)
                        if (helmetColor === 'Yellow' || helmetColor === 'Any') {
                            if (r > 100 && g > 100 && b < Math.min(r, g) * 0.75) isMatch = true;
                        }
                        if (helmetColor === 'Orange' || helmetColor === 'Any') {
                            if (r > 120 && g > 50 && g < r * 0.85 && b < g * 0.8) isMatch = true;
                        }
                        // WARNING: White is excluded from 'Any' because white walls/windows cause 99% of false positives indoors.
                        if (helmetColor === 'White') {
                            if (r > 160 && g > 160 && b > 160 && Math.abs(r-g) < 30 && Math.abs(r-b) < 30) isMatch = true;
                        }
                        if (helmetColor === 'Blue' || helmetColor === 'Any') {
                            if (b > 100 && r < b * 0.7 && g < b * 0.8) isMatch = true;
                        }
                        if (helmetColor === 'Red' || helmetColor === 'Any') {
                            if (r > 120 && g < r * 0.6 && b < r * 0.6) isMatch = true;
                        }
                        
                        if (isMatch) {
                           safetyColorPixels++;
                        }
                     }
                     // Require 15% of the head region to match the selected color (was 3%, too low)
                     hasHelmet = (safetyColorPixels / (headW * headH)) > 0.15; 
                 }
             }
             if (!hasHelmet) allHelmetsOk = false;
         }
         
         const boxColor = isPerson ? (hasHelmet ? '#10b981' : '#ef4444') : '#3b82f6';
         
         ctx.strokeStyle = boxColor;
         ctx.lineWidth = 4;
         ctx.strokeRect(x, y, width, height);

         ctx.fillStyle = boxColor;
         ctx.fillRect(x, y - 36, 220, 36);
         
         ctx.fillStyle = '#ffffff';
         ctx.font = 'bold 18px monospace';
         
         let labelText = `${prediction.class.toUpperCase()} (${Math.round(prediction.score * 100)}%)`;
         if (isPerson) {
             labelText = hasHelmet ? 'HELMET: OK ✓' : '⚠️ HELMET: MISSING';
         }
         ctx.fillText(labelText, x + 8, y - 12);
       });

       // Update global state for UI
       if (personCount > 0) {
           setHelmetDetected(allHelmetsOk);
       } else {
           setHelmetDetected(true);
       }

       animId = requestAnimationFrame(renderOverlays);
    };
    renderOverlays();
    return () => cancelAnimationFrame(animId);
  }, [predictions, useWebcam, videoSrc]);


  // Canvas CCTV Animation Loop (Fallback when no video feed)
  useEffect(() => {
    if (videoSrc || useWebcam) return;

    const canvas = fallbackCanvasRef.current;
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

      // Dark CCTV Background Gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0c1524');
      grad.addColorStop(1, '#050a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Perspective Construction Grid Lines
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

      // Moving Worker Silhouette
      workerX += workerDirection;
      if (workerX > w - 180 || workerX < 140) workerDirection *= -1;

      const workerY = h / 2 - 20;

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

      // AI Detection Bounding Box on Worker
      const boxW = 80;
      const boxH = 95;
      const boxX = workerX - boxW / 2;
      const boxY = workerY - 45;

      const accentColor = isScanning ? '#3b82f6' : '#ef4444';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = isScanning
        ? 'rgba(59, 130, 246, 0.2)'
        : 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // Tag Label
      ctx.fillStyle = isScanning ? '#1d4ed8' : '#dc2626';
      ctx.fillRect(boxX - 10, boxY - 24, 150, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      const labelText = isScanning ? '🔍 SCANNING PPE...' : '⚠️ HELMET: MISSING';
      ctx.fillText(labelText, boxX - 5, boxY - 10);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [videoSrc, useWebcam, isScanning]);

  return (
    <div className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(13,28,50,0.06)] flex flex-col relative">
      {/* Top Header / Channel controls */}
      <div className="p-3 bg-surface-container-low border-b border-outline-variant/40 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">videocam</span>
          <span className="font-bold text-sm text-on-surface">{cameraName}</span>
          {modelLoading && <span className="text-xs text-on-surface-variant font-mono animate-pulse bg-surface-variant px-2 py-0.5 rounded ml-2">Loading Live AI...</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Helmet Color Filter */}
          <select 
            value={helmetColor} 
            onChange={(e) => setHelmetColor(e.target.value)}
            className="text-xs border border-outline-variant rounded-lg px-2 py-1 bg-surface-container-low text-on-surface-variant font-bold cursor-pointer hover:bg-surface-variant transition"
          >
            <option value="Any">All Helmets</option>
            <option value="Yellow">Yellow</option>
            <option value="Orange">Orange</option>
            <option value="White">White</option>
            <option value="Blue">Blue</option>
            <option value="Red">Red</option>
          </select>

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
              disabled={modelLoading}
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
        
        <video
          ref={videoRef}
          src={(!useWebcam && videoSrc) ? videoSrc : undefined}
          autoPlay
          loop={!useWebcam}
          muted
          playsInline
          className={`absolute top-0 left-0 w-full h-full object-cover ${(useWebcam || videoSrc || hlsUrl) ? 'block' : 'hidden'}`}
        />

        {/* Real AI Overlay Canvas */}
        <canvas 
          ref={aiCanvasRef} 
          className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${(useWebcam || videoSrc || hlsUrl) ? 'block' : 'hidden'}`} 
        />

        {/* HTML5 Canvas AI Simulation (Fallback) */}
        {!videoSrc && !useWebcam && !hlsUrl && (
          <canvas
            ref={fallbackCanvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
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
                <span className="font-bold text-white text-sm">Hybrid CV & AI Inference</span>
                <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold">COCO-SSD + HEURISTIC</span>
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  isScanning ? 'text-sky-400' : helmetDetected ? 'text-emerald-400' : 'text-red-400 animate-pulse'
                }`}
              >
                {predictions.length > 0 
                    ? `Live Detect: ${predictions.map(p => p.class).join(', ')}`
                    : (isScanning ? 'Analyzing video frames...' : `Status: All Clear`)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
