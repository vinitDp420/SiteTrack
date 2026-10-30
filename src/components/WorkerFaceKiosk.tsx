'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as tf from '@tensorflow/tfjs';
import {
  ScanFace,
  Camera,
  CameraOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
  ShieldCheck,
  LogIn,
  LogOut,
  ChevronDown,
} from 'lucide-react';

let faceapi: any;
if (typeof window !== 'undefined') {
  faceapi = require('face-api.js');

  // Suppress duplicate IO handlers & WebGL tensor broadcast collisions
  try {
    const tfAny = tf as any;
    if (tfAny?.io?.getLoadHandlers) {
      const origGetLoadHandlers = tfAny.io.getLoadHandlers.bind(tfAny.io);
      tfAny.io.getLoadHandlers = function (url: any, loadOptions: any) {
        const handlers = origGetLoadHandlers(url, loadOptions);
        if (Array.isArray(handlers) && handlers.length > 1) {
          return [handlers[0]];
        }
        return handlers;
      };
    }
  } catch (e) {}

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (
      msg.includes('broadcast') ||
      msg.includes('Operands could not be broadcast') ||
      msg.includes('forwardFunc') ||
      msg.includes('WebGL') ||
      msg.includes('tensor') ||
      msg.includes('loadHandlers') ||
      msg.includes('backend')
    ) {
      event.preventDefault();
      console.warn('[Face Machine] Suppressed transient AI runtime warning:', msg);
    }
  });
}

export interface EnrolledWorker {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  paymentType: string;
  projectId: string;
  facePhotoUrl?: string | null;
  descriptor?: Float32Array | null;
  isCheckedIn?: boolean;
  activeAttendanceId?: string | null;
  checkInTime?: string | null;
}

interface WorkerFaceKioskProps {
  onSwitchToPasswordLogin?: () => void;
}

export default function WorkerFaceKiosk({ onSwitchToPasswordLogin }: WorkerFaceKioskProps) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [allWorkers, setAllWorkers] = useState<EnrolledWorker[]>([]);
  const [enrolledWorkers, setEnrolledWorkers] = useState<EnrolledWorker[]>([]);
  
  // Camera & Device states
  const [isScanning, setIsScanning] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live detection HUD
  const [scanStatus, setScanStatus] = useState<string>('Initializing AI engine...');
  const [detectedWorker, setDetectedWorker] = useState<EnrolledWorker | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Celebration Result Toast
  const [attendanceResult, setAttendanceResult] = useState<{
    type: 'in' | 'out';
    workerName: string;
    photoUrl?: string | null;
    timestamp: string;
    hours?: string;
    wage?: string;
    message: string;
  } | null>(null);

  const [countdown, setCountdown] = useState<number | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const enrolledWorkersRef = useRef<EnrolledWorker[]>([]);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceHoldStartRef = useRef<number | null>(null);
  const currentTargetWorkerIdRef = useRef<string | null>(null);
  const recentWorkerScansRef = useRef<Map<string, number>>(new Map());

  // Sound effects
  const playChime = (type: 'in' | 'out') => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (type === 'in') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.12);
      }

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  // Load Models & Worker Data sequentially on mount
  useEffect(() => {
    let active = true;

    const init = async () => {
      await loadModels();
      if (active) {
        await loadWorkersData();
      }
    };

    init();
    enumerateCameras();

    return () => {
      active = false;
      stopCamera();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const enumerateCameras = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          // Prefer Iriun if available, else first camera
          const iriun = videoInputs.find((d) => d.label.toLowerCase().includes('iriun'));
          setSelectedDeviceId(iriun ? iriun.deviceId : videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Device enumeration error:', err);
    }
  };

  const loadModels = async (): Promise<boolean> => {
    try {
      if (typeof window === 'undefined' || !faceapi) return false;

      setScanStatus('Initializing TensorFlow AI engine...');
      await tf.ready();

      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      }
      if (!faceapi.nets.faceLandmark68Net.isLoaded) {
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      }
      if (!faceapi.nets.faceRecognitionNet.isLoaded) {
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      }

      setModelsLoaded(true);
      setScanStatus('AI Models loaded. Ready to start face scanner.');
      return true;
    } catch (err: any) {
      console.error('Failed to load faceapi models:', err);
      setErrorMsg(`AI Model Loading failed: ${err?.message || 'Check /models folder'}`);
      return false;
    }
  };

  const loadWorkersData = async () => {
    setLoadingWorkers(true);
    try {
      // 1. Fetch live active attendance
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

      // 2. Fetch workers
      const res = await fetch(`/api/workers?_t=${Date.now()}`, { cache: 'no-store' });
      const workers = await res.json();

      if (Array.isArray(workers)) {
        setAllWorkers(workers);
        const preparedList: EnrolledWorker[] = [];

        for (const w of workers) {
          let descriptor: Float32Array | null = null;
          const activeEntry = activeMap.get(w.id);

          // Priority 1: Precomputed vector in database (Instant!)
          if (w.faceEmbeddings && w.faceEmbeddings.length > 0) {
            try {
              const vector = JSON.parse(w.faceEmbeddings[0].embedding);
              descriptor = new Float32Array(vector);
            } catch (e) {
              console.warn('Embedding parse error for:', w.name);
            }
          }

          // Priority 2: Compute from photo URL if model is ready
          if (!descriptor && w.facePhotoUrl && typeof window !== 'undefined' && faceapi?.nets?.tinyFaceDetector?.isLoaded) {
            try {
              const img = await faceapi.fetchImage(w.facePhotoUrl);
              const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (detection) {
                descriptor = detection.descriptor;
                // Save asynchronously so future scans are instant
                fetch(`/api/workers/${w.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ faceDescriptor: Array.from(detection.descriptor) }),
                }).catch(() => {});
              }
            } catch {
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
      console.error('Failed to load workers for Face Kiosk:', err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  // Start Camera
  const startCamera = async (deviceId?: string) => {
    setErrorMsg(null);
    setDetectedWorker(null);
    setMatchScore(null);
    setAttendanceResult(null);
    isExecutingRef.current = false;
    setScanStatus('Starting camera stream...');

    try {
      // Ensure models are loaded before starting
      if (!faceapi?.nets?.tinyFaceDetector?.isLoaded) {
        const ok = await loadModels();
        if (!ok) {
          setErrorMsg('AI models are still initializing. Please wait a moment and click again.');
          return;
        }
      }

      const targetDevice = deviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDevice
          ? { deviceId: { exact: targetDevice }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsScanning(true);
          setScanStatus('Looking for faces in camera...');
          startTracking();
        };
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setErrorMsg('Camera access failed. Check permissions or select another camera device.');
      setIsScanning(false);
    }
  };

  // Stop Camera
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
    setDetectedWorker(null);
    isExecutingRef.current = false;
    faceHoldStartRef.current = null;
    currentTargetWorkerIdRef.current = null;
  };

  // Real-time Facial Tracking Loop
  const startTracking = () => {
    const track = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Ensure model is ready
      if (!faceapi?.nets?.tinyFaceDetector?.isLoaded) {
        setScanStatus('Waiting for AI models...');
        animationFrameRef.current = requestAnimationFrame(track);
        return;
      }

      if (video.readyState >= 2 && canvas) {
        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            const box = resizedDetection.detection.box;

            // Match face against enrolled workers
            const currentEnrolled = enrolledWorkersRef.current;
            let bestWorker: EnrolledWorker | null = null;
            let minDistance = 1.0;

            for (const candidate of currentEnrolled) {
              if (!candidate.descriptor) continue;
              const dist = faceapi.euclideanDistance(detection.descriptor, candidate.descriptor);
              if (dist < minDistance) {
                minDistance = dist;
                bestWorker = candidate;
              }
            }

            const confidence = Math.max(0, Math.min(100, Math.round((1 - minDistance) * 100)));
            const isMatch = bestWorker !== null && minDistance < 0.58;
            const isClockOut = isMatch && bestWorker?.isCheckedIn;

            setMatchScore(confidence);
            setDetectedWorker(isMatch ? bestWorker : null);

            // Check if this worker scanned recently (25s cooldown to prevent double-scanning)
            let isCoolingDown = false;
            let cooldownRemaining = 0;
            if (isMatch && bestWorker) {
              const lastScan = recentWorkerScansRef.current.get(bestWorker.id) || 0;
              const secondsSince = (Date.now() - lastScan) / 1000;
              if (secondsSince < 25) {
                isCoolingDown = true;
                cooldownRemaining = Math.ceil(25 - secondsSince);
              }
            }

            // 3-second steady face hold calculation
            let holdRemainingSec: number | null = null;
            if (isMatch && bestWorker && !isCoolingDown) {
              if (currentTargetWorkerIdRef.current !== bestWorker.id) {
                currentTargetWorkerIdRef.current = bestWorker.id;
                faceHoldStartRef.current = Date.now();
              }
              const elapsedMs = Date.now() - (faceHoldStartRef.current || Date.now());
              const elapsedSec = elapsedMs / 1000;
              holdRemainingSec = Math.max(0, Math.ceil(3.2 - elapsedSec));

              if (elapsedSec >= 3.2 && !isExecutingRef.current) {
                faceHoldStartRef.current = null;
                currentTargetWorkerIdRef.current = null;
                const targetWorkerId = bestWorker.id;
                const targetWorkerName = bestWorker.name;
                const targetProjectId = bestWorker.projectId;
                executeAttendance(targetWorkerId, targetWorkerName, targetProjectId);
              }
            } else {
              faceHoldStartRef.current = null;
              currentTargetWorkerIdRef.current = null;
            }

            // Draw HUD Box & Facial Landmarks
            if (ctx) {
              const boxColor = isMatch
                ? isCoolingDown
                  ? '#3b82f6'
                  : isClockOut
                  ? '#ef4444'
                  : '#10b981'
                : '#f59e0b';

              ctx.lineWidth = 3;
              ctx.strokeStyle = boxColor;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Landmark dots
              const landmarks = resizedDetection.landmarks.positions;
              ctx.fillStyle = isMatch
                ? isCoolingDown
                  ? '#60a5fa'
                  : isClockOut
                  ? '#f87171'
                  : '#34d399'
                : '#fbbf24';
              for (let i = 0; i < landmarks.length; i += 2) {
                ctx.beginPath();
                ctx.arc(landmarks[i].x, landmarks[i].y, 2.5, 0, 2 * Math.PI);
                ctx.fill();
              }

              // Over-head name tag
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);

              const actionTag = isClockOut ? '2ND SCAN • CLOCK OUT' : '1ST SCAN • CLOCK IN';
              let nameTag = `🔍 DETECTED FACE (${confidence}%)`;

              if (isMatch && bestWorker) {
                if (isCoolingDown) {
                  nameTag = `✔ ${bestWorker.name.toUpperCase()} • RECORDED (STEP ASIDE)`;
                } else if (holdRemainingSec !== null && holdRemainingSec > 0) {
                  nameTag = `⏳ ${bestWorker.name.toUpperCase()} • HOLD ${holdRemainingSec}s • ${actionTag}`;
                } else {
                  nameTag = `✔ ${bestWorker.name.toUpperCase()} • VERIFIED!`;
                }
              }

              ctx.font = 'bold 13px system-ui, sans-serif';
              const textWidth = ctx.measureText(nameTag).width;
              const unmirroredBoxX = canvas.width - (box.x + box.width);
              const badgeY = Math.max(28, box.y - 10);

              ctx.fillStyle = isMatch
                ? isCoolingDown
                  ? 'rgba(30, 58, 138, 0.95)'
                  : isClockOut
                  ? 'rgba(127, 29, 29, 0.95)'
                  : 'rgba(6, 78, 59, 0.95)'
                : 'rgba(120, 53, 15, 0.95)';
              ctx.fillRect(unmirroredBoxX, badgeY - 22, textWidth + 18, 24);

              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(unmirroredBoxX, badgeY - 22, textWidth + 18, 24);

              ctx.fillStyle = '#ffffff';
              ctx.fillText(nameTag, unmirroredBoxX + 9, badgeY - 6);
              ctx.restore();
            }

            // Update live status text
            if (isMatch && bestWorker) {
              const matchedName = bestWorker.name;
              if (isCoolingDown) {
                const actionPast = bestWorker.isCheckedIn ? 'Clocked In' : 'Clocked Out';
                setScanStatus(`✔ ${matchedName} already ${actionPast}. Cooldown active (${cooldownRemaining}s). Please step aside for next worker.`);
              } else if (holdRemainingSec !== null && holdRemainingSec > 0) {
                const actionText = isClockOut ? 'Clock Out' : 'Clock In';
                setScanStatus(`⏳ Hold still: ${holdRemainingSec}s remaining to ${actionText} ${matchedName}...`);
              } else {
                setScanStatus(`✔ Verified! Processing attendance for ${matchedName}...`);
              }
            } else {
              setScanStatus(
                bestWorker
                  ? `⚠️ Looking like ${bestWorker.name} (${confidence}%), but low confidence. Look straight at camera.`
                  : '⚠️ Unknown face. Please register worker photo in Admin dashboard.'
              );
              faceHoldStartRef.current = null;
              currentTargetWorkerIdRef.current = null;
            }
          } else {
            setDetectedWorker(null);
            setMatchScore(null);
            faceHoldStartRef.current = null;
            currentTargetWorkerIdRef.current = null;
            setScanStatus('Position your face inside the camera frame...');
          }
        } catch {
          // Suppress transient loop error
        }
      }

      animationFrameRef.current = requestAnimationFrame(track);
    };

    animationFrameRef.current = requestAnimationFrame(track);
  };

  // Smart Attendance Execution (1st Scan = Clock In, 2nd Scan = Clock Out)
  const executeAttendance = async (workerId: string, workerName: string, projectId: string) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setIsProcessing(true);
    stopCamera();

    try {
      // Check live status
      const checkRes = await fetch(`/api/attendance?workerId=${workerId}&_t=${Date.now()}`, { cache: 'no-store' });
      const logs = await checkRes.json();
      const activeEntry = Array.isArray(logs) ? logs.find((l: any) => l.checkOutTime === null) : null;
      const matchedWorkerObj = allWorkers.find((w) => w.id === workerId);

      recentWorkerScansRef.current.set(workerId, Date.now());

      if (activeEntry) {
        // === 2ND SCAN: CLOCK OUT ===
        const outRes = await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, attendanceId: activeEntry.id }),
        });
        const outData = await outRes.json();

        if (outRes.ok) {
          playChime('out');
          speak(`Goodbye ${workerName}! Shift clocked out successfully.`);

          // Update in-memory state
          setEnrolledWorkers((prev) =>
            prev.map((w) => (w.id === workerId ? { ...w, isCheckedIn: false, activeAttendanceId: null } : w))
          );
          enrolledWorkersRef.current = enrolledWorkersRef.current.map((w) =>
            w.id === workerId ? { ...w, isCheckedIn: false, activeAttendanceId: null } : w
          );

          const hours = outData.session?.hoursWorked || '0.0';
          const pay = outData.payment?.payment?.amount || (matchedWorkerObj?.wageRate ? `₹${matchedWorkerObj.wageRate}` : 'Calculated');

          setAttendanceResult({
            type: 'out',
            workerName,
            photoUrl: matchedWorkerObj?.facePhotoUrl,
            timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            hours: `${hours} hrs`,
            wage: typeof pay === 'number' ? `₹${pay}` : pay,
            message: `2nd Scan Verified • Shift Clocked Out Successfully!`,
          });

          startQueueAutoReset();
        } else {
          setErrorMsg(outData.error || `Failed to clock out ${workerName}.`);
          startQueueAutoReset();
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
          }),
        });
        const inData = await inRes.json();

        if (inRes.ok) {
          playChime('in');
          speak(`Welcome ${workerName}! Shift clocked in successfully.`);

          const checkIn = new Date(inData.session?.checkInTime || Date.now());

          // Update in-memory state
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

          setAttendanceResult({
            type: 'in',
            workerName,
            photoUrl: matchedWorkerObj?.facePhotoUrl,
            timestamp: checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            hours: 'Shift Active',
            wage: `Daily Rate: ₹${matchedWorkerObj?.wageRate || 0}`,
            message: `1st Scan Verified • Shift Clocked In Successfully!`,
          });

          startQueueAutoReset();
        } else {
          setErrorMsg(inData.error || `Attendance recording failed for ${workerName}.`);
          startQueueAutoReset();
        }
      }

      // Refresh statuses from database
      await loadWorkersData();
    } catch {
      setErrorMsg(`Failed to record attendance for ${workerName}.`);
      startQueueAutoReset();
    } finally {
      setIsProcessing(false);
      isExecutingRef.current = false;
    }
  };

  // Continuous Queue: Countdown & Automatically restart scanner for next worker
  const startQueueAutoReset = () => {
    let timeLeft = 4;
    setCountdown(timeLeft);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setAttendanceResult(null);
        setCountdown(null);
        // Automatically restart scanner for next worker
        startCamera();
      }
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Camera device switcher (only if multiple cameras are detected) */}
      {cameraDevices.length > 1 && (
        <div className="w-full flex items-center justify-end gap-1.5 text-xs text-slate-500 mb-2">
          <Camera className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              if (isScanning) {
                stopCamera();
                setTimeout(() => startCamera(e.target.value), 300);
              }
            }}
            className="bg-slate-100 text-slate-700 text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none"
          >
            {cameraDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Scanner Alert</p>
            <p className="text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* SUCCESS CARD: Large Celebration HUD with Auto-Queue Reset */}
      {attendanceResult ? (
        <div
          className={`w-full p-6 rounded-2xl border text-center shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden ${
            attendanceResult.type === 'in'
              ? 'bg-gradient-to-b from-emerald-950 to-slate-950 border-emerald-500 text-white shadow-emerald-950/50'
              : 'bg-gradient-to-b from-rose-950 to-slate-950 border-rose-500 text-white shadow-rose-950/50'
          }`}
        >
          {/* Action Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-3 border font-mono">
            {attendanceResult.type === 'in' ? (
              <span className="text-emerald-300 flex items-center gap-1">
                <LogIn className="w-4 h-4 text-emerald-400" /> 1ST SCAN • CLOCKED IN
              </span>
            ) : (
              <span className="text-rose-300 flex items-center gap-1">
                <LogOut className="w-4 h-4 text-rose-400" /> 2ND SCAN • CLOCKED OUT
              </span>
            )}
          </div>

          {/* Photo & Name */}
          <div className="flex flex-col items-center justify-center my-2">
            <div
              className={`w-24 h-24 rounded-2xl overflow-hidden border-4 shadow-xl mb-3 flex items-center justify-center font-black text-3xl ${
                attendanceResult.type === 'in'
                  ? 'border-emerald-400 bg-emerald-900 text-emerald-200'
                  : 'border-rose-400 bg-rose-900 text-rose-200'
              }`}
            >
              {attendanceResult.photoUrl ? (
                <img
                  src={attendanceResult.photoUrl}
                  alt={attendanceResult.workerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                attendanceResult.workerName.charAt(0).toUpperCase()
              )}
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">
              {attendanceResult.workerName}
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xs">{attendanceResult.message}</p>
          </div>

          {/* Shift Details Grid */}
          <div className="grid grid-cols-2 gap-2 my-4 max-w-sm mx-auto text-left">
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Timestamp</span>
              <span className="text-sm font-black text-white">{attendanceResult.timestamp}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                {attendanceResult.type === 'in' ? 'Status' : 'Hours Worked'}
              </span>
              <span className="text-sm font-black text-white">{attendanceResult.hours}</span>
            </div>
          </div>

          {/* Wage Badge for Check Out */}
          {attendanceResult.type === 'out' && attendanceResult.wage && (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold py-2 px-4 rounded-xl inline-block mb-3">
              💰 Daily Wage Disbursed: {attendanceResult.wage}
            </div>
          )}

          {/* Auto Reset Countdown Pill */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>
              Next worker in line can scan in <strong className="text-white text-sm">{countdown ?? 4}s</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                setAttendanceResult(null);
                setCountdown(null);
                startCamera();
              }}
              className="ml-2 text-[11px] underline text-blue-300 hover:text-white cursor-pointer"
            >
              Scan Now
            </button>
          </div>
        </div>
      ) : (
        /* CAMERA STREAM & SCANNER VIEW */
        <div className="w-full flex flex-col items-center">
          
          {/* Real-time Recognition Banner */}
          {detectedWorker && (
            <div
              className={`w-full mb-3 p-3.5 rounded-2xl border flex items-center justify-between shadow-lg animate-in fade-in zoom-in-95 duration-200 ${
                detectedWorker.isCheckedIn
                  ? 'bg-rose-950/95 border-rose-500 text-rose-100'
                  : 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md ${
                    detectedWorker.isCheckedIn ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  {detectedWorker.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{detectedWorker.name}</h4>
                  <p className="text-[11px] text-slate-300 font-mono">
                    {detectedWorker.isCheckedIn
                      ? `2ND SCAN: Clock Out (${matchScore}%)`
                      : `1ST SCAN: Clock In (${matchScore}%)`}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-black uppercase px-3 py-1 rounded-lg border font-mono ${
                  detectedWorker.isCheckedIn
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-emerald-600 border-emerald-400 text-white'
                }`}
              >
                {detectedWorker.isCheckedIn ? '🔴 CLOCK OUT' : '🟢 CLOCK IN'}
              </span>
            </div>
          )}

          {/* Camera Frame */}
          <div className="relative w-full max-w-[380px] aspect-square rounded-3xl overflow-hidden border-4 border-slate-900 bg-slate-950 shadow-2xl flex items-center justify-center">
            
            {/* If camera is not active */}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-900/90 text-white">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4 text-blue-400">
                  <ScanFace className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Face Scan Attendance</h3>
                <p className="text-xs text-slate-400 mb-6 max-w-xs">
                  Stand in front of the camera. The system will recognize your face and automatically clock you IN or OUT.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Face Camera</span>
                </button>
              </div>
            )}

            {/* Video & Canvas */}
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

            {/* Scanning line animation */}
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
            )}

            {/* Floating In-Frame HUD Pill */}
            {isScanning && (
              <div className="absolute bottom-3 inset-x-3 z-20 flex justify-center pointer-events-none">
                <div className="bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-center shadow-lg">
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {detectedWorker
                      ? `✔ ${detectedWorker.name} • ${detectedWorker.isCheckedIn ? '2nd Scan: Clock Out' : '1st Scan: Clock In'}`
                      : matchScore !== null
                      ? `Scanning Face (${matchScore}%)`
                      : 'Look directly at camera lens'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Scanner Controls & Status */}
          <div className="w-full max-w-[380px] mt-4 flex flex-col items-center gap-2.5">
            <p className="text-xs font-semibold text-center text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-sm w-full leading-tight">
              {scanStatus}
            </p>

            <div className="w-full flex items-center gap-2">
              {isScanning ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Pause Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Resume Camera</span>
                </button>
              )}

              {/* Voice Speech Toggle */}
              <button
                type="button"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-center transition-colors cursor-pointer ${
                  voiceEnabled
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
                title={voiceEnabled ? 'Voice feedback active' : 'Voice feedback muted'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Direct Link to Standalone Kiosk Mode */}
              <Link
                href="/kiosk"
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                <span>Fullscreen Gate Kiosk</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Manual / Password Fallback Switcher */}
      {onSwitchToPasswordLogin && (
        <div className="mt-6 pt-4 border-t border-slate-200/80 w-full text-center">
          <button
            type="button"
            onClick={onSwitchToPasswordLogin}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium underline cursor-pointer"
          >
            Supervisor / Manual Password Login
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
