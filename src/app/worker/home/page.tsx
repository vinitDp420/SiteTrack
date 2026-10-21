'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

let faceapi: any;
if (typeof window !== 'undefined') {
  faceapi = require('face-api.js');
}

interface EnrolledWorker {
  id: string;
  name: string;
  phone: string;
  projectId: string;
  wageRate: number;
  paymentType: string;
  facePhotoUrl?: string | null;
  descriptor?: Float32Array | null;
  isCheckedIn?: boolean;
  activeAttendanceId?: string | null;
  checkInTime?: string | null;
}

export default function WorkerHome() {
  const [currentWorker, setCurrentWorker] = useState<EnrolledWorker | null>(null);
  const [allWorkers, setAllWorkers] = useState<EnrolledWorker[]>([]);
  const [enrolledWorkers, setEnrolledWorkers] = useState<EnrolledWorker[]>([]);
  const [matcherLoading, setMatcherLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Active Session & Shift status of currently logged-in worker
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [checkInTimeStr, setCheckInTimeStr] = useState('--:-- AM');
  const [todayHours, setTodayHours] = useState('0.0');

  // Scanner UI States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('Initializing AI Face Matcher...');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [detectedWorker, setDetectedWorker] = useState<EnrolledWorker | null>(null);
  const [detectedFaceInFrame, setDetectedFaceInFrame] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedWorkerToLink, setSelectedWorkerToLink] = useState<string>('');

  // Toast / Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{
    name: string;
    title: string;
    subtitle: string;
    type: 'in' | 'out';
  } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const enrolledWorkersRef = useRef<EnrolledWorker[]>([]);
  const latestDescriptorRef = useRef<Float32Array | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef<boolean>(false);

  // Play pleasant audio chime
  const playSuccessChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    loadFaceModels();
    loadAllWorkersAndBuildMatcher();

    return () => {
      stopCamera();
    };
  }, []);

  // 1. Load AI Face Recognition Models
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

  // 2. Fetch all workers and check attendance status (Check In vs Check Out)
  const loadAllWorkersAndBuildMatcher = async () => {
    setMatcherLoading(true);
    try {
      // Fetch active attendance logs to identify who is checked in right now
      const attRes = await fetch(`/api/attendance?_t=${Date.now()}`, { cache: 'no-store' });
      const attendanceLogs = await attRes.json();
      const activeMap = new Map<string, any>();
      if (Array.isArray(attendanceLogs)) {
        for (const log of attendanceLogs) {
          if (log.checkOutTime === null && !activeMap.has(log.workerId)) {
            activeMap.set(log.workerId, log);
          }
        }
      }

      // Fetch logged-in worker status
      const meRes = await fetch(`/api/workers/me?_t=${Date.now()}`, { cache: 'no-store' });
      const meData = await meRes.json();
      if (meRes.ok && meData.worker) {
        setCurrentWorker(meData.worker);
        setIsCheckedIn(meData.isCheckedIn);
        setActiveSession(meData.activeSession);

        if (meData.activeSession) {
          const checkIn = new Date(meData.activeSession.checkInTime);
          setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
          const diffMs = new Date().getTime() - checkIn.getTime();
          setTodayHours((diffMs / (1000 * 60 * 60)).toFixed(1));
        } else {
          setCheckInTimeStr('--:-- AM');
          setTodayHours('0.0');
        }
      }

      // Fetch all workers from DB
      const res = await fetch(`/api/workers?_t=${Date.now()}`, { cache: 'no-store' });
      const workers = await res.json();
      if (Array.isArray(workers)) {
        setAllWorkers(workers);
        if (workers.length > 0) {
          setSelectedWorkerToLink(workers[0].id);
        }

        // Process descriptors and active status for each worker
        const preparedList: EnrolledWorker[] = [];

        for (const w of workers) {
          let descriptor: Float32Array | null = null;
          const activeEntry = activeMap.get(w.id);

          // Priority 1: Stored FaceEmbedding vector in database
          if (w.faceEmbeddings && w.faceEmbeddings.length > 0) {
            try {
              const vector = JSON.parse(w.faceEmbeddings[0].embedding);
              descriptor = new Float32Array(vector);
            } catch (err) {
              console.error('Vector parse error for:', w.name);
            }
          }

          // Priority 2: Extract descriptor from facePhotoUrl if model is loaded and no vector exists
          if (!descriptor && w.facePhotoUrl && typeof window !== 'undefined') {
            try {
              const img = await faceapi.fetchImage(w.facePhotoUrl);
              const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (detection) {
                descriptor = detection.descriptor;
                fetch(`/api/workers/${w.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ faceDescriptor: Array.from(detection.descriptor) }),
                }).catch(() => {});
              }
            } catch (imgErr) {
              console.warn(`Could not compute face descriptor from photo for ${w.name}`);
            }
          }

          if (descriptor) {
            preparedList.push({
              ...w,
              descriptor,
              isCheckedIn: !!activeEntry,
              activeAttendanceId: activeEntry?.id || null,
              checkInTime: activeEntry?.checkInTime || null,
            });
          }
        }

        setEnrolledWorkers(preparedList);
        enrolledWorkersRef.current = preparedList;
      }
    } catch (err) {
      console.error('Failed to load workers database for face matching:', err);
    } finally {
      setMatcherLoading(false);
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setErrorMsg(null);
    setIsScanning(true);
    setDetectedFaceInFrame(false);
    setDetectedWorker(null);
    setMatchScore(null);
    isExecutingRef.current = false;
    setScanStatus('Position your face in camera frame...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          startFaceTrackingLoop();
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('Camera access unavailable. Please check camera permissions.');
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
    setDetectedFaceInFrame(false);
    setDetectedWorker(null);
    isExecutingRef.current = false;
  };

  // Real-time Facial Landmark Tracking & Check-In / Check-Out Matching Loop
  const startFaceTrackingLoop = () => {
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
            setDetectedFaceInFrame(true);
            latestDescriptorRef.current = detection.descriptor;
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            const box = resizedDetection.detection.box;

            // 1:N Matching against all enrolled workers
            let bestWorker: EnrolledWorker | null = null;
            let minDistance = 1.0;
            const currentEnrolled = enrolledWorkersRef.current;

            for (const candidate of currentEnrolled) {
              if (!candidate.descriptor) continue;
              const distance = faceapi.euclideanDistance(detection.descriptor, candidate.descriptor);
              if (distance < minDistance) {
                minDistance = distance;
                bestWorker = candidate;
              }
            }

            const confidenceScore = Math.max(0, Math.min(100, Math.round((1 - minDistance) * 100)));
            const isMatchConfirmed = bestWorker !== null && minDistance < 0.55;
            const isClockingOut = isMatchConfirmed && bestWorker?.isCheckedIn;

            setMatchScore(confidenceScore);
            setDetectedWorker(isMatchConfirmed ? bestWorker : null);

            // Draw Real-time Canvas Label & Landmarks
            if (ctx) {
              const boxColor = isMatchConfirmed ? (isClockingOut ? '#ef4444' : '#10b981') : '#f59e0b';
              ctx.lineWidth = 3;
              ctx.strokeStyle = boxColor;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Draw Facial Landmark Dots
              const landmarks = resizedDetection.landmarks.positions;
              ctx.fillStyle = isMatchConfirmed ? (isClockingOut ? '#f87171' : '#34d399') : '#fbbf24';
              for (let i = 0; i < landmarks.length; i += 2) {
                ctx.beginPath();
                ctx.arc(landmarks[i].x, landmarks[i].y, 2, 0, 2 * Math.PI);
                ctx.fill();
              }

              // Draw Worker Name Badge directly over the face box
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);

              const actionTag = isClockingOut ? '2ND SCAN • CLOCK OUT' : '1ST SCAN • CLOCK IN';
              const nameTag = isMatchConfirmed
                ? `✔ ${bestWorker?.name?.toUpperCase()} • ${actionTag}`
                : `⚠ UNKNOWN WORKER (${confidenceScore}%)`;

              ctx.font = 'bold 12px system-ui, sans-serif';
              const textWidth = ctx.measureText(nameTag).width;
              const unmirroredBoxX = canvas.width - (box.x + box.width);
              const badgeY = Math.max(26, box.y - 8);

              // Background pill
              ctx.fillStyle = isMatchConfirmed
                ? isClockingOut
                  ? 'rgba(127, 29, 29, 0.95)'
                  : 'rgba(6, 78, 59, 0.95)'
                : 'rgba(120, 53, 15, 0.95)';
              ctx.fillRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);

              // Border
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1;
              ctx.strokeRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);

              // Text
              ctx.fillStyle = '#ffffff';
              ctx.fillText(nameTag, unmirroredBoxX + 8, badgeY - 5);

              ctx.restore();
            }

            // Auto-trigger Check In (1st Scan) or Check Out (2nd Scan)
            if (isMatchConfirmed && bestWorker) {
              const matchedWorkerName = bestWorker.name;

              if (isClockingOut) {
                setScanStatus(`🔴 2nd Scan Detected: ${matchedWorkerName} is currently Checked In. Clocking Out & ending shift in 1s...`);
              } else {
                setScanStatus(`🟢 1st Scan Detected: ${matchedWorkerName} is currently Checked Out. Clocking In & starting shift in 1s...`);
              }

              if (!verificationTimerRef.current && !isExecutingRef.current) {
                playSuccessChime();
                const targetWorkerId = bestWorker.id;
                const targetWorkerName = bestWorker.name;
                const targetProjectId = bestWorker.projectId;

                verificationTimerRef.current = setTimeout(() => {
                  handleExecuteAttendanceForWorker(targetWorkerId, targetWorkerName, targetProjectId);
                }, 900);
              }
            } else {
              setScanStatus(
                bestWorker
                  ? `⚠️ Face looks like ${bestWorker.name} (${confidenceScore}%), but confidence is low. Please look straight at camera.`
                  : `⚠️ Face not recognized in worker database. Please register your face below.`
              );
              if (verificationTimerRef.current) {
                clearTimeout(verificationTimerRef.current);
                verificationTimerRef.current = null;
              }
            }
          } else {
            setDetectedFaceInFrame(false);
            setDetectedWorker(null);
            setMatchScore(null);
            setScanStatus('Position face inside the frame...');
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

  // Smart Check-In (1st Scan) or Check-Out (2nd Scan) Execution
  const handleExecuteAttendanceForWorker = async (workerId: string, workerName: string, projectId: string) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setProcessing(true);
    setErrorMsg(null);
    stopCamera();

    try {
      // 1. Check if this worker currently has an active check-in (checkOutTime === null)
      const checkRes = await fetch(`/api/attendance?workerId=${workerId}&_t=${Date.now()}`, { cache: 'no-store' });
      const logs = await checkRes.json();
      const activeEntry = Array.isArray(logs) ? logs.find((l: any) => l.checkOutTime === null) : null;

      if (activeEntry) {
        // === 2ND SCAN: CLOCK OUT ===
        const outRes = await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, attendanceId: activeEntry.id }),
        });
        const outData = await outRes.json();

        if (outRes.ok) {
          if (!currentWorker || workerId === currentWorker.id) {
            setIsCheckedIn(false);
            setTodayHours('0.0');
            setCheckInTimeStr('--:-- AM');
          }

          // Instant in-memory update for all worker lists
          setEnrolledWorkers((prev) =>
            prev.map((w) => (w.id === workerId ? { ...w, isCheckedIn: false, activeAttendanceId: null } : w))
          );
          enrolledWorkersRef.current = enrolledWorkersRef.current.map((w) =>
            w.id === workerId ? { ...w, isCheckedIn: false, activeAttendanceId: null } : w
          );

          const pay = outData.payment?.payment;
          const wageMsg = pay?.amount ? `₹${pay.amount} wage payout initiated.` : 'Shift completed.';

          setSuccessToast({
            name: workerName,
            title: `👋 2nd Scan: Checked Out!`,
            subtitle: `Goodbye, ${workerName}! Shift clocked out successfully. ${wageMsg}`,
            type: 'out',
          });
          setTimeout(() => setSuccessToast(null), 6000);
        } else {
          setErrorMsg(outData.error || `Failed to clock out ${workerName}.`);
        }
      } else {
        // === 1ST SCAN: CLOCK IN ===
        const inRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId,
            projectId,
            manualBackup: false,
            latitude: 18.5204,
            longitude: 73.8567,
          }),
        });
        const inData = await inRes.json();

        if (inRes.ok) {
          const checkIn = new Date(inData.session.checkInTime);
          if (!currentWorker || workerId === currentWorker.id) {
            setIsCheckedIn(true);
            setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
          }

          // Instant in-memory update for all worker lists
          setEnrolledWorkers((prev) =>
            prev.map((w) =>
              w.id === workerId
                ? { ...w, isCheckedIn: true, activeAttendanceId: inData.session?.id, checkInTime: inData.session?.checkInTime }
                : w
            )
          );
          enrolledWorkersRef.current = enrolledWorkersRef.current.map((w) =>
            w.id === workerId
              ? { ...w, isCheckedIn: true, activeAttendanceId: inData.session?.id, checkInTime: inData.session?.checkInTime }
              : w
          );

          setSuccessToast({
            name: workerName,
            title: `🎉 1st Scan: Checked In!`,
            subtitle: `Welcome, ${workerName}! Shift started at ${checkIn.toLocaleTimeString('en-IN')}. Scan again when shift ends to Clock Out.`,
            type: 'in',
          });
          setTimeout(() => setSuccessToast(null), 6000);
        } else {
          setErrorMsg(inData.error || `Attendance recording failed for ${workerName}.`);
        }
      }

      // Refresh all statuses from database
      await loadAllWorkersAndBuildMatcher();
    } catch {
      setErrorMsg(`Failed to record attendance for ${workerName}.`);
    } finally {
      setProcessing(false);
      isExecutingRef.current = false;
    }
  };

  // Register live webcam face to any selected worker
  const handleRegisterLiveFace = async () => {
    if (!latestDescriptorRef.current) {
      setErrorMsg('No face currently detected in camera frame to register.');
      return;
    }
    if (!selectedWorkerToLink) {
      setErrorMsg('Please select a worker name from the list.');
      return;
    }

    const targetWorker = allWorkers.find((w) => w.id === selectedWorkerToLink);
    if (!targetWorker) return;

    setEnrolling(true);
    try {
      const descriptorArray = Array.from(latestDescriptorRef.current);
      const res = await fetch(`/api/workers/${targetWorker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: descriptorArray,
        }),
      });

      if (res.ok) {
        // Update local reference immediately
        const updatedList = enrolledWorkers.filter((w) => w.id !== targetWorker.id);
        const newEnrolled: EnrolledWorker = {
          ...targetWorker,
          descriptor: new Float32Array(descriptorArray),
          isCheckedIn: targetWorker.isCheckedIn || false,
        };
        updatedList.push(newEnrolled);
        setEnrolledWorkers(updatedList);
        enrolledWorkersRef.current = updatedList;

        setScanStatus(`✅ Face successfully registered for ${targetWorker.name}! Marking attendance...`);
        playSuccessChime();

        // Trigger attendance for this newly linked worker
        setTimeout(() => {
          handleExecuteAttendanceForWorker(targetWorker.id, targetWorker.name, targetWorker.projectId);
        }, 700);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to enroll face.');
      }
    } catch {
      setErrorMsg('Server connection error while enrolling face.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-start py-2 pb-16 gap-5">
      
      {/* Smart Biometric Scanner Header */}
      <div className="w-full max-w-sm bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isCheckedIn ? 'Active Shift • Ready for Check-Out' : 'Ready for Shift Check-In'}
          </span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Site Face Scanner
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          1st Scan = <strong>Check In</strong> • 2nd Scan = <strong>Check Out</strong>
        </p>

        {/* Database Enrolled Workers Counter */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">Registered Workers:</span>
          <span className="font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 text-[11px]">
            {enrolledWorkers.length} Face Profiles Ready
          </span>
        </div>
      </div>

      {/* Prominent Real-Time Name Confirmation Alert */}
      {successToast && (
        <div className={`w-full max-w-sm px-4 py-3.5 rounded-2xl border flex gap-3 items-center shadow-lg animate-in fade-in zoom-in-95 duration-300 ${successToast.type === 'in' ? 'bg-emerald-950 border-emerald-500 text-emerald-100' : 'bg-rose-950 border-rose-500 text-rose-100'}`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${successToast.type === 'in' ? 'bg-emerald-800 text-emerald-200' : 'bg-rose-800 text-rose-200'}`}>
            <span className="material-symbols-outlined text-[24px]">
              {successToast.type === 'in' ? 'login' : 'logout'}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <span>{successToast.title}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/20">
                {successToast.type === 'in' ? 'Shift Check-In' : 'Shift Check-Out'}
              </span>
            </h4>
            <p className="text-xs text-white/80 mt-0.5 leading-snug">{successToast.subtitle}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="w-full max-w-sm px-4 py-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex gap-2 items-center">
          <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Biometric Camera Scanner */}
      {isScanning ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          {/* Active Status Badge */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                detectedWorker?.isCheckedIn ? 'bg-rose-600' : 'bg-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-[20px]">
                  {detectedWorker?.isCheckedIn ? 'logout' : 'login'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {detectedWorker ? detectedWorker.name : 'Scanning Face...'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {detectedWorker
                    ? detectedWorker.isCheckedIn
                      ? `2ND SCAN: Clock Out (${matchScore}%)`
                      : `1ST SCAN: Clock In (${matchScore}%)`
                    : 'Comparing with Database Photos...'}
                </p>
              </div>
            </div>
            {detectedWorker && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                detectedWorker.isCheckedIn
                  ? 'bg-rose-950 border-rose-600 text-rose-300'
                  : 'bg-emerald-950 border-emerald-600 text-emerald-300'
              }`}>
                {detectedWorker.isCheckedIn ? 'CLOCK OUT' : 'CLOCK IN'}
              </span>
            )}
          </div>

          {/* Video Preview with AI Landmark Canvas */}
          <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-4 border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.35)] bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />

            {/* Top Floating Match Alert */}
            <div className="absolute top-2 left-2 right-2 z-20 flex justify-center pointer-events-none">
              <div className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md flex items-center gap-2 ${
                detectedWorker
                  ? detectedWorker.isCheckedIn
                    ? 'bg-rose-950/90 border-rose-500/80 text-rose-200'
                    : 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200'
                  : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${detectedWorker ? (detectedWorker.isCheckedIn ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-ping') : 'bg-amber-400'}`} />
                <span className="text-[11px] font-bold font-mono tracking-wide uppercase truncate max-w-[220px]">
                  {detectedWorker
                    ? detectedWorker.isCheckedIn
                      ? `2nd Scan: Clock Out ${detectedWorker.name}`
                      : `1st Scan: Clock In ${detectedWorker.name}`
                    : 'Searching Database...'}
                </span>
              </div>
            </div>

            {/* Bottom Match Percentage */}
            <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-center pointer-events-none z-20">
              <span className={`text-xs font-mono font-bold ${
                detectedWorker ? (detectedWorker.isCheckedIn ? 'text-rose-400' : 'text-emerald-400') : 'text-blue-300'
              }`}>
                {detectedWorker
                  ? `✔ ${detectedWorker.name} • ${matchScore}% • ${detectedWorker.isCheckedIn ? '2nd Scan' : '1st Scan'}`
                  : matchScore !== null
                  ? `Scanning Face (${matchScore}%)`
                  : 'Align face in camera'}
              </span>
            </div>
          </div>

          {/* Feedback Status */}
          <p className="text-xs font-semibold text-center text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-full leading-tight">
            {scanStatus}
          </p>

          {/* Quick Action when Face is Recognized */}
          {detectedWorker && (
            <button
              type="button"
              onClick={() => {
                if (verificationTimerRef.current) {
                  clearTimeout(verificationTimerRef.current);
                  verificationTimerRef.current = null;
                }
                handleExecuteAttendanceForWorker(detectedWorker.id, detectedWorker.name, detectedWorker.projectId);
              }}
              disabled={processing}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                detectedWorker.isCheckedIn
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {detectedWorker.isCheckedIn ? 'logout' : 'login'}
              </span>
              <span>
                {detectedWorker.isCheckedIn
                  ? `Confirm 2nd Scan: Clock Out ${detectedWorker.name}`
                  : `Confirm 1st Scan: Clock In ${detectedWorker.name}`}
              </span>
            </button>
          )}

          {/* Fallback / Face Registration Linker */}
          {detectedFaceInFrame && (
            <div className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Face Registration / Re-assign:
              </span>
              <div className="flex gap-2">
                <select
                  value={selectedWorkerToLink}
                  onChange={(e) => setSelectedWorkerToLink(e.target.value)}
                  className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-800"
                >
                  {allWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.facePhotoUrl ? '📷' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleRegisterLiveFace}
                  disabled={enrolling}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap cursor-pointer transition-all"
                >
                  {enrolling ? 'Saving...' : '📸 Link & Process'}
                </button>
              </div>
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={stopCamera}
            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
          >
            Close Camera
          </button>

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
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={startCamera}
            disabled={processing || matcherLoading}
            className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-xl border-4 cursor-pointer text-white ${
              isCheckedIn
                ? 'bg-rose-700 border-rose-500 hover:bg-rose-800'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="absolute inset-0 rounded-full border-4 border-white opacity-10"></div>
            <span className={`material-symbols-outlined text-[64px] animate-bounce ${
              isCheckedIn ? 'text-rose-200' : 'text-blue-400'
            }`}>
              {isCheckedIn ? 'logout' : 'face'}
            </span>
            <div className="flex flex-col items-center px-4">
              <span className="text-[11px] font-bold tracking-widest uppercase opacity-80">
                {isCheckedIn ? '2nd Scan' : '1st Scan'}
              </span>
              <span className="text-base font-extrabold tracking-wider uppercase text-center leading-tight mt-0.5">
                {processing
                  ? 'Processing...'
                  : matcherLoading
                  ? 'Loading Face DB...'
                  : isCheckedIn
                  ? 'FACE SCAN TO\nCLOCK OUT'
                  : 'FACE SCAN TO\nCLOCK IN'}
              </span>
              <span className="text-[10px] font-mono mt-1 opacity-70">
                {currentWorker?.name || 'Worker'}
              </span>
            </div>
          </button>

          <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200/80 text-center max-w-xs">
            <p className="text-xs text-slate-700 font-semibold">
              {isCheckedIn
                ? '🟢 Currently on shift. Scan face a 2nd time to Clock Out.'
                : '⚪ Currently off duty. Scan face for the 1st time to Clock In.'}
            </p>
          </div>
        </div>
      )}

      {/* Enrolled Workers Photo Roster with Live Status */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Worker Face Database ({enrolledWorkers.length})</span>
          <span className="text-[10px] text-blue-600 font-semibold">Live Shift Status</span>
        </h3>
        <div className="space-y-2">
          {enrolledWorkers.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center font-bold text-slate-600">
                  {w.facePhotoUrl ? (
                    <img src={w.facePhotoUrl} alt={w.name} className="w-full h-full object-cover" />
                  ) : (
                    w.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{w.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{w.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  w.isCheckedIn
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {w.isCheckedIn ? '🟢 Shift Active' : '⚪ Off Duty'}
                </span>
                <button
                  type="button"
                  onClick={() => handleExecuteAttendanceForWorker(w.id, w.name, w.projectId)}
                  disabled={processing}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border ${
                    w.isCheckedIn
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title={w.isCheckedIn ? '2nd Scan: Clock Out' : '1st Scan: Clock In'}
                >
                  {w.isCheckedIn ? 'Clock Out' : 'Clock In'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
