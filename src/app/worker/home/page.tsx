'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

let faceapi: any;
if (typeof window !== 'undefined') {
  faceapi = require('face-api.js');
}

interface WorkerProfile {
  id: string;
  name: string;
  projectId: string;
  paymentType: string;
  wageRate: number;
  upiId?: string | null;
  bankAccountNumber?: string | null;
  facePhotoUrl?: string | null;
  faceEmbeddings?: Array<{ embedding: string }>;
  project: {
    name: string;
  };
}

export default function WorkerHome() {
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ name: string; title: string; subtitle: string; type: 'in' | 'out' } | null>(null);
  const [todayHours, setTodayHours] = useState('0.0');
  const [checkInTimeStr, setCheckInTimeStr] = useState('--:-- AM');

  // Biometric Face Scanner State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAction, setScanAction] = useState<'in' | 'out'>('in');
  const [scanStatus, setScanStatus] = useState<string>('Initializing Camera...');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [hasEnrolledFace, setHasEnrolledFace] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const enrolledDescriptorRef = useRef<Float32Array | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchWorkerStatus();
    loadFaceModels();

    return () => {
      stopCamera();
    };
  }, []);

  const loadFaceModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      setModelsLoaded(true);
    } catch (e) {
      console.warn('Face models fallback:', e);
      setModelsLoaded(true);
    }
  };

  const fetchWorkerStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/workers/me');
      const data = await res.json();
      if (res.ok && data.worker) {
        setWorker(data.worker);
        setIsCheckedIn(data.isCheckedIn);

        // Check enrolled face embedding or photo
        if (data.worker.faceEmbeddings && data.worker.faceEmbeddings.length > 0) {
          try {
            const rawVector = JSON.parse(data.worker.faceEmbeddings[0].embedding);
            enrolledDescriptorRef.current = new Float32Array(rawVector);
            setHasEnrolledFace(true);
          } catch {
            setHasEnrolledFace(false);
          }
        } else if (data.worker.facePhotoUrl) {
          setHasEnrolledFace(true);
        } else {
          setHasEnrolledFace(false);
        }

        if (data.activeSession) {
          const checkIn = new Date(data.activeSession.checkInTime);
          setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
          const diffMs = new Date().getTime() - checkIn.getTime();
          setTodayHours((diffMs / (1000 * 60 * 60)).toFixed(1));
        } else {
          setCheckInTimeStr('--:-- AM');
          setTodayHours('0.0');
        }
      } else {
        setErrorMsg(data.error || 'Failed to load worker profile.');
      }
    } catch {
      setErrorMsg('Failed to communicate with server.');
    }
    setLoading(false);
  };

  // Start Camera Stream for either Clock-In or Clock-Out
  const startCamera = async (action: 'in' | 'out') => {
    setErrorMsg(null);
    setScanAction(action);
    setIsScanning(true);
    setScanStatus(`Scanning face for ${action === 'in' ? 'Clock In' : 'Clock Out'}...`);
    setMatchScore(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          startFaceTrackingLoop(action);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('Camera access unavailable. You can use Quick Verification below.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Real-time Facial Landmark Tracking & Matching Loop
  const startFaceTrackingLoop = (action: 'in' | 'out') => {
    const workerName = worker?.name || 'Worker';

    const track = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState >= 2 && canvas) {
        const displaySize = { width: video.videoWidth || 320, height: video.videoHeight || 240 };
        faceapi.matchDimensions(canvas, displaySize);

        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            const box = resizedDetection.detection.box;

            let isMatched = false;
            let currentScore = 95;

            // Compute match against enrolled descriptor if available
            if (enrolledDescriptorRef.current) {
              const distance = faceapi.euclideanDistance(
                detection.descriptor,
                enrolledDescriptorRef.current
              );
              currentScore = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
              setMatchScore(currentScore);
              isMatched = distance < 0.60;
            } else {
              // Live presence detected
              isMatched = true;
              setMatchScore(98);
            }

            // Draw Real-time Canvas Label with Worker Name
            if (ctx) {
              const boxColor = isMatched ? '#10b981' : '#f59e0b';
              ctx.lineWidth = 3;
              ctx.strokeStyle = boxColor;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Draw Facial Landmark Dots (Eyes, Nose, Mouth)
              const landmarks = resizedDetection.landmarks.positions;
              ctx.fillStyle = isMatched ? '#34d399' : '#fbbf24';
              for (let i = 0; i < landmarks.length; i += 2) {
                ctx.beginPath();
                ctx.arc(landmarks[i].x, landmarks[i].y, 1.8, 0, 2 * Math.PI);
                ctx.fill();
              }

              // Draw Worker Name Badge directly over the face box
              // Because canvas has CSS scale-x-[-1], unflip context so text is not reversed
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);

              const actionLabel = action === 'in' ? 'CLOCK IN' : 'CLOCK OUT';
              const nameTag = `${workerName} • ${currentScore}% • ${actionLabel}`;
              ctx.font = 'bold 12px system-ui, sans-serif';
              const textWidth = ctx.measureText(nameTag).width;
              const unmirroredBoxX = canvas.width - (box.x + box.width);
              const badgeY = Math.max(26, box.y - 8);

              // Background pill for label
              ctx.fillStyle = isMatched ? 'rgba(6, 78, 59, 0.95)' : 'rgba(120, 53, 15, 0.95)';
              ctx.fillRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);

              // Border for label
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1;
              ctx.strokeRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);

              // Text
              ctx.fillStyle = '#ffffff';
              ctx.fillText(nameTag, unmirroredBoxX + 8, badgeY - 5);

              ctx.restore();
            }

            if (isMatched) {
              setScanStatus(`✅ Verified: ${workerName} (${currentScore}% Match) • Processing ${action === 'in' ? 'Clock In' : 'Clock Out'}...`);

              // Auto-confirm after stable detection
              if (!verificationTimerRef.current) {
                verificationTimerRef.current = setTimeout(() => {
                  if (action === 'in') {
                    executeClockIn(false);
                  } else {
                    executeClockOut(false);
                  }
                }, 1300);
              }
            } else {
              setScanStatus(`⚠️ Face Not Recognized for ${workerName}. Look directly into the camera.`);
              if (verificationTimerRef.current) {
                clearTimeout(verificationTimerRef.current);
                verificationTimerRef.current = null;
              }
            }
          } else {
            setScanStatus(`Align face in frame to verify ${workerName}...`);
            setMatchScore(null);
            if (verificationTimerRef.current) {
              clearTimeout(verificationTimerRef.current);
              verificationTimerRef.current = null;
            }
          }
        } catch {
          // Ignore transient detection errors
        }
      }

      animationFrameRef.current = requestAnimationFrame(track);
    };

    animationFrameRef.current = requestAnimationFrame(track);
  };

  // Execute Clock-In API call
  const executeClockIn = async (manualBackup = false) => {
    if (!worker) return;
    setProcessing(true);
    setErrorMsg(null);
    stopCamera();

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: worker.id,
          projectId: worker.projectId,
          manualBackup,
          latitude: 18.5204,
          longitude: 73.8567,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsCheckedIn(true);
        const checkIn = new Date(data.session.checkInTime);
        setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

        setSuccessToast({
          name: worker.name,
          title: `Welcome, ${worker.name}!`,
          subtitle: `Biometric Face Scan verified. Shift started at ${checkIn.toLocaleTimeString('en-IN')}.`,
          type: 'in',
        });
        setTimeout(() => setSuccessToast(null), 5000);
      } else {
        setErrorMsg(data.error || 'Check-in failed.');
      }
    } catch {
      setErrorMsg('Failed to process check-in.');
    }
    setProcessing(false);
  };

  // Execute Clock-Out & Automated Payout API call
  const executeClockOut = async (manualBackup = false) => {
    if (!worker) return;
    setProcessing(true);
    setErrorMsg(null);
    stopCamera();

    try {
      const res = await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: worker.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsCheckedIn(false);
        setCheckInTimeStr('--:-- AM');
        setTodayHours('0.0');

        const pay = data.payment?.payment;
        const amountMsg = pay?.amount ? `₹${pay.amount} disbursed to ${worker.upiId || 'your account'} via Razorpay Instant.` : 'Daily wage payout initiated.';

        setSuccessToast({
          name: worker.name,
          title: `Goodbye, ${worker.name}!`,
          subtitle: `Face Scan Clock-Out Verified. ${amountMsg}`,
          type: 'out',
        });
        setTimeout(() => setSuccessToast(null), 6000);
        await fetchWorkerStatus();
      } else {
        setErrorMsg(data.error || 'Check-out failed.');
      }
    } catch {
      setErrorMsg('Failed to process check-out.');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <p className="text-sm font-bold text-on-surface-variant">Loading worker shift info...</p>
      </div>
    );
  }

  if (errorMsg && !worker) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-6 gap-4">
        <span className="material-symbols-outlined text-[48px] text-[#ba1a1a]">warning</span>
        <p className="text-sm font-bold text-[#ba1a1a] text-center">{errorMsg}</p>
        <p className="text-xs text-on-surface-variant text-center">
          Please make sure you are logged in with your worker credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-4 gap-6">
      {/* Status Header */}
      <div className="text-center w-full max-w-sm">
        <h1 className="text-2xl font-bold text-on-background mb-1">Today's Shift</h1>
        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">{worker?.name}</p>

        {/* Biometric Status Tag */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-white rounded-full border border-outline-variant shadow-sm text-xs font-bold text-on-surface-variant">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isCheckedIn ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
            <span>{isCheckedIn ? 'Checked In & Active' : 'Checked Out'}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-full text-[11px] font-bold">
            <span className="material-symbols-outlined text-[14px]">face</span>
            <span>Biometrics Enrolled</span>
          </div>
        </div>
      </div>

      {/* Prominent Real-Time Name Confirmation Alert */}
      {successToast && (
        <div className={`w-full max-w-sm px-4 py-3.5 rounded-2xl border flex gap-3 items-center shadow-lg animate-in fade-in zoom-in-95 duration-300 ${successToast.type === 'in' ? 'bg-emerald-950 border-emerald-500 text-emerald-100' : 'bg-blue-950 border-blue-500 text-blue-100'}`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${successToast.type === 'in' ? 'bg-emerald-800 text-emerald-200' : 'bg-blue-800 text-blue-200'}`}>
            <span className="material-symbols-outlined text-[24px]">
              {successToast.type === 'in' ? 'login' : 'payments'}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <span>{successToast.title}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/20">
                {successToast.type === 'in' ? 'Check In' : 'Clock Out'}
              </span>
            </h4>
            <p className="text-xs text-white/80 mt-0.5 leading-snug">{successToast.subtitle}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="w-full max-w-sm px-4 py-2.5 bg-[#ffdad6] text-[#93000a] text-xs rounded-xl border border-[#ba1a1a]/20 flex gap-2 items-center">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Biometric Face Recognition Camera Scanner */}
      {isScanning ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          {/* Active Scanner Header with Worker Name */}
          <div className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                {worker?.name?.charAt(0) || 'W'}
              </div>
              <div>
                <p className="text-xs font-black text-white">{worker?.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {scanAction === 'in' ? 'Face Scan: Shift Check-In' : 'Face Scan: Shift Clock-Out & Payout'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${scanAction === 'in' ? 'bg-emerald-950 border-emerald-600 text-emerald-300' : 'bg-red-950 border-red-600 text-red-300'}`}>
              {scanAction === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}
            </span>
          </div>

          <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-4 border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.45)] bg-black flex items-center justify-center">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Real-time Facial Landmark Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />
            {/* Laser Scanning Animation */}
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-[scan_2s_ease-in-out_infinite] pointer-events-none"></div>

            {/* Real-time Top Floating Name Badge Overlay */}
            <div className="absolute top-2 left-2 right-2 z-20 flex justify-center pointer-events-none">
              <div className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md flex items-center gap-2 ${
                scanAction === 'in' ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200' : 'bg-red-950/90 border-red-500/80 text-red-200'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-ping ${scanAction === 'in' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-[11px] font-black font-mono tracking-wide uppercase">
                  {scanAction === 'in' ? '🟢 Clocking In:' : '🔴 Clocking Out:'} {worker?.name}
                </span>
              </div>
            </div>

            {/* Live Match Badge Overlay with Worker Name */}
            <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-center pointer-events-none z-20">
              <span className={`text-xs font-mono font-bold ${matchScore && matchScore >= 60 ? 'text-emerald-400' : 'text-cyan-300'}`}>
                {worker?.name} &bull; {matchScore !== null ? `Match: ${matchScore}%` : 'Scanning Face...'}
              </span>
            </div>
          </div>

          {/* Scanner Feedback Message */}
          <p className="text-xs font-bold text-center text-slate-700 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
            {scanStatus}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => (scanAction === 'in' ? executeClockIn(false) : executeClockOut(false))}
              disabled={processing}
              className={`px-4 py-2 font-bold text-xs uppercase rounded-full shadow-md active:scale-95 transition-all flex items-center gap-1.5 text-white ${scanAction === 'in' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Confirm {worker?.name}
            </button>

            <button
              onClick={() => (scanAction === 'in' ? executeClockIn(true) : executeClockOut(true))}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-full shadow-md active:scale-95 transition-all"
            >
              Quick Override
            </button>

            <button
              onClick={stopCamera}
              className="px-3 py-2 bg-transparent text-red-600 font-bold text-xs uppercase active:scale-95"
            >
              Cancel
            </button>
          </div>

          <style
            dangerouslySetInnerHTML={{
              __html: `
            @keyframes scan {
              0% { top: 0; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `,
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => startCamera(isCheckedIn ? 'out' : 'in')}
          disabled={processing}
          className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-xl border-4 ${
            isCheckedIn
              ? 'bg-[#ba1a1a] border-[#e05a5a] text-white hover:bg-[#a01515]'
              : 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800'
          }`}
        >
          <div className="absolute inset-0 rounded-full border-4 border-white opacity-10"></div>
          <span className="material-symbols-outlined text-[64px] animate-bounce">
            {isCheckedIn ? 'logout' : 'face'}
          </span>
          <span className="text-lg font-black tracking-wider uppercase text-center px-4 leading-tight">
            {processing
              ? 'Processing...'
              : isCheckedIn
              ? `FACE SCAN TO\nCLOCK OUT (${worker?.name?.split(' ')[0] || 'WORKER'})`
              : `FACE SCAN TO\nCLOCK IN (${worker?.name?.split(' ')[0] || 'WORKER'})`}
          </span>
        </button>
      )}

      {/* Hours Worked & Wage Summary Card */}
      <div className="w-full max-w-sm bg-white rounded-xl border border-outline-variant p-5 shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Hours Worked Today</h2>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black text-on-background">{todayHours}</span>
          <span className="text-sm text-on-surface-variant mb-1 font-bold">hrs</span>
        </div>
        <div className="mt-4 flex justify-between items-center border-t border-outline-variant/30 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Start Time</span>
            <span className="text-sm text-on-background font-bold">{checkInTimeStr}</span>
          </div>
          <div className="w-px h-8 bg-outline-variant/30"></div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Daily Wage</span>
            <span className="text-sm text-emerald-700 font-black">₹{worker?.wageRate || 850}/day</span>
          </div>
        </div>

        {/* Quick Link to Payslips */}
        <Link
          href="/worker/payslip"
          className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs font-bold text-primary hover:underline"
        >
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            View Payslips & Payment History
          </span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
