'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';

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
  project: {
    name: string;
  };
}

export default function WorkerHome() {
  const { data: session } = useSession();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [todayHours, setTodayHours] = useState('0.0');
  const [checkInTimeStr, setCheckInTimeStr] = useState('--:-- AM');
  
  // Face Recognition State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchWorkerStatus();
    loadFaceModels();
  }, []);

  const loadFaceModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      setModelsLoaded(true);
    } catch (e) {
      console.error('Error loading face models:', e);
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
        if (data.activeSession) {
          const checkIn = new Date(data.activeSession.checkInTime);
          setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
          // Calculate running hours
          const diffMs = new Date().getTime() - checkIn.getTime();
          setTodayHours((diffMs / (1000 * 60 * 60)).toFixed(1));
        } else {
          setCheckInTimeStr('--:-- AM');
          setTodayHours('0.0');
        }
      } else {
        setErrorMsg(data.error || 'Failed to load worker profile.');
      }
    } catch (e) {
      setErrorMsg('Failed to communicate with server.');
    }
    setLoading(false);
  };

  const executeClockIn = async () => {
    setProcessing(true);
    try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: worker!.id,
            projectId: worker!.projectId,
            manualBackup: false,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setIsCheckedIn(true);
          const checkIn = new Date(data.session.checkInTime);
          setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        } else {
          setErrorMsg(data.error || 'Check-in failed.');
        }
    } catch (e) {
      setErrorMsg('Failed to process check-in.');
    }
    setProcessing(false);
    setIsScanning(false);
  };

  const handleClockInOut = async () => {
    if (!worker || processing) return;
    setErrorMsg(null);

    try {
      if (!isCheckedIn) {
        // Trigger Liveness/Face Scan before Clocking In
        if (!modelsLoaded) {
          setErrorMsg('Biometric models are still loading. Please wait.');
          return;
        }
        setIsScanning(true);
        startVideo();
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: worker.id,
            projectId: worker.projectId,
            manualBackup: true,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setIsCheckedIn(true);
          const checkIn = new Date(data.session.checkInTime);
          setCheckInTimeStr(checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        } else {
          setErrorMsg(data.error || 'Check-in failed.');
        }
      } else {
        // Clock Out (PUT)
        setProcessing(true);
        const res = await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: worker.id,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setIsCheckedIn(false);
          setCheckInTimeStr('--:-- AM');
          setTodayHours('0.0');
          if (data.payment && data.payment.payment) {
            const pay = data.payment.payment;
            alert(
              `Clocked out successfully!\nDaily wage payout status: ${pay.status} ${
                pay.status === 'SUCCESS' ? '₹' + pay.amount + ' deposited.' : 'Reason: ' + pay.failureReason
              }`
            );
          } else {
            alert('Clocked out successfully!');
          }
        } else {
          setErrorMsg(data.error || 'Check-out failed.');
        }
      }
    } catch (e) {
      setErrorMsg('Failed to process request.');
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

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        setErrorMsg('Camera access denied. Cannot verify identity.');
        setIsScanning(false);
      });
  };

  const handleFaceScan = async () => {
    if (videoRef.current) {
      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      );
      if (detections.length > 0) {
        // Face detected! Proceed to clock in
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        executeClockIn();
      } else {
        setErrorMsg('No face detected. Please look directly at the camera.');
      }
    }
  };

  const cancelScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsScanning(false);
  };

  if (errorMsg && !worker) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-6 gap-4">
        <span className="material-symbols-outlined text-[48px] text-[#ba1a1a]">warning</span>
        <p className="text-sm font-bold text-[#ba1a1a] text-center">{errorMsg}</p>
        <p className="text-xs text-on-surface-variant text-center">Please make sure you are logged in with your worker credentials.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-6 gap-8">
      {/* Status Header */}
      <div className="text-center w-full max-w-sm">
        <h1 className="text-2xl font-bold text-on-background mb-1">Today's Shift</h1>
        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">{worker?.name}</p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-outline-variant shadow-sm mt-3">
          <span className={`w-3 h-3 rounded-full animate-pulse ${isCheckedIn ? 'bg-[#008000]' : 'bg-[#ba1a1a]'}`}></span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="w-full max-w-sm px-4 py-2.5 bg-[#ffdad6] text-[#93000a] text-xs rounded-xl border border-[#ba1a1a]/20 flex gap-2 items-center">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Giant Check In / Out Button & Scanner */}
      {isScanning ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-4 border-[#0ea5e9] shadow-[0_0_20px_rgba(14,165,233,0.5)]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Scanning Overlay Animation */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#0ea5e9] shadow-[0_0_10px_#0ea5e9] animate-[scan_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleFaceScan} className="px-6 py-2 bg-[#0ea5e9] text-white font-bold rounded-full shadow-md active:scale-95">
              Verify Face
            </button>
            <button onClick={cancelScan} className="px-6 py-2 bg-transparent text-[#ba1a1a] font-bold rounded-full active:scale-95">
              Cancel
            </button>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan {
              0% { top: 0; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}} />
        </div>
      ) : (
        <button
          onClick={handleClockInOut}
          disabled={processing || (!isCheckedIn && !modelsLoaded)}
          className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-lg border-4 ${
            isCheckedIn
              ? 'bg-[#ba1a1a] border-[#e05a5a] text-white hover:bg-opacity-95'
              : 'bg-[#1e293b] border-[#334155] text-white hover:bg-opacity-95'
          } ${(!isCheckedIn && !modelsLoaded) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="absolute inset-0 rounded-full border-4 border-white opacity-10"></div>
          <span className="material-symbols-outlined text-[64px] fill animate-bounce">
            {isCheckedIn ? 'pin_drop' : 'face'}
          </span>
          <span className="text-xl font-bold tracking-wide uppercase text-center px-4">
            {processing ? 'Processing...' : isCheckedIn ? 'CLOCK OUT' : (!modelsLoaded ? 'LOADING BIOMETRICS...' : 'SCAN FACE TO CLOCK IN')}
          </span>
        </button>
      )}

      {/* Hours Worked Summary */}
      <div className="w-full max-w-sm bg-white rounded-xl border border-outline-variant p-6 shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Hours Worked Today</h2>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-bold text-on-background">{todayHours}</span>
          <span className="text-sm text-on-surface-variant mb-1 font-bold">hrs</span>
        </div>
        <div className="mt-6 flex justify-between items-center border-t border-outline-variant/30 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Start Time</span>
            <span className="text-sm text-on-background font-bold">{checkInTimeStr}</span>
          </div>
          <div className="w-px h-8 bg-outline-variant/30"></div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Location</span>
            <span className="text-sm text-on-background font-bold truncate max-w-[120px]">{worker?.project.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
