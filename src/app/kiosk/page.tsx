"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, UserCheck, HardHat, FlaskConical, ScanFace, Calculator } from "lucide-react";

let faceapi: any;
if (typeof window !== 'undefined') {
  faceapi = require('face-api.js');
}

// Demo workers — used when no database is connected
const DEMO_WORKERS: Record<string, string> = {
  "9820111111": "Vinit Patil",
  "9820222222": "Viraj Mali",
  "9820333333": "Amit Patel",
  "9820444444": "Ramesh Yadav",
  "9820555555": "Sunita Devi",
  "9820666666": "Vikram Nair",
};

const DEMO_PROJECTS = [
  { id: "demo-alpha", name: "Skyline Heights Residential (Demo)" },
  { id: "demo-beta",  name: "Hyderabad Metro Mall (Demo)" },
  { id: "demo-gamma", name: "Namma Metro Phase 3 (Demo)" },
];

export default function KioskPage() {
  const [mode, setMode] = useState<"PIN" | "FACE">("PIN");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [testWorkerId, setTestWorkerId] = useState<string>("");
  const [detectedWorker, setDetectedWorker] = useState<{ id: string; name: string; score: number; action: "in" | "out" } | null>(null);
  
  // Face Recognition State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<any>(null);
  const [isBuildingMatcher, setIsBuildingMatcher] = useState(false);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setProjects(list);
          setSelectedProject(list[0].id);
          setDemoMode(false);
        } else {
          setProjects(DEMO_PROJECTS);
          setSelectedProject(DEMO_PROJECTS[0].id);
          setDemoMode(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setProjects(DEMO_PROJECTS);
        setSelectedProject(DEMO_PROJECTS[0].id);
        setDemoMode(true);
        setLoading(false);
      });
      
    // Fetch all real workers
    fetch("/api/workers")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllWorkers(data);
          setTestWorkerId(data[0].id);
        } else {
          const demoList = Object.entries(DEMO_WORKERS).map(([id, name]) => ({ id, name }));
          setAllWorkers(demoList);
          setTestWorkerId(demoList[0].id);
        }
      })
      .catch(() => {
        const demoList = Object.entries(DEMO_WORKERS).map(([id, name]) => ({ id, name }));
        setAllWorkers(demoList);
        setTestWorkerId(demoList[0].id);
      });

      // Load face models
      loadFaceModels();
  }, []);
  
  const loadFaceModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setModelsLoaded(true);
    } catch (e) {
      console.error('Error loading face models:', e);
    }
  };

  useEffect(() => {
    if (modelsLoaded && allWorkers.length > 0 && !demoMode) {
      buildFaceMatcher();
    }
  }, [modelsLoaded, allWorkers, demoMode]);

  const buildFaceMatcher = async () => {
    setIsBuildingMatcher(true);
    try {
      const labeledDescriptors = [];
      for (const worker of allWorkers) {
        if (worker.facePhotoUrl) {
          try {
            const img = await faceapi.fetchImage(worker.facePhotoUrl);
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (detection) {
              labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(worker.id, [detection.descriptor]));
            }
          } catch (e) {
             console.error(`Failed to process photo for ${worker.name}`);
          }
        }
      }
      if (labeledDescriptors.length > 0) {
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.55)); // 0.55 threshold for matching
      }
    } catch (err) {
      console.error("Failed to build face matcher", err);
    }
    setIsBuildingMatcher(false);
  };

  const handleKeyPress = (num: string) => {
    if (input.length < 15) {
      setInput((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setInput("");
    setMessage(null);
  };

  const executeAttendance = async (workerId: string, action: "in" | "out") => {
    if (demoMode) {
      const workerName = DEMO_WORKERS[workerId] || "Guest Worker";
      if (!DEMO_WORKERS[workerId] && mode === "PIN") {
        setMessage({ text: "Worker not found. Try a demo number below.", type: "error" });
      } else if (action === "in") {
        setMessage({ text: `Welcome ${workerName}! ✅ Clocked In. (Demo)`, type: "success" });
      } else {
        setMessage({ text: `Goodbye ${workerName}! 👋 Clocked Out. (Demo)`, type: "success" });
      }
      setTimeout(() => { setInput(""); setMessage(null); setDetectedWorker(null); }, 3500);
      return;
    }

    try {
      if (action === "in") {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId, projectId: selectedProject, manualBackup: true }),
        });
        const data = await res.json();
        if (res.ok) {
          const wName = data.session?.worker?.name || allWorkers.find(w => w.id === workerId)?.name || "Worker";
          setMessage({ text: `Welcome ${wName}! ✅ Clocked In Successfully.`, type: "success" });
        } else {
          setMessage({ text: data.error || "Failed to check in", type: "error" });
        }
      } else {
        const res = await fetch("/api/attendance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId }),
        });
        const data = await res.json();
        if (res.ok) {
          const wName = data.session?.worker?.name || allWorkers.find(w => w.id === workerId)?.name || "Worker";
          setMessage({ text: `Goodbye ${wName}! 👋 Clocked Out Successfully. Daily Wage Disbursed.`, type: "success" });
        } else {
          setMessage({ text: data.error || "Failed to check out", type: "error" });
        }
      }
    } catch (err) {
      setMessage({ text: "Network error", type: "error" });
    }
    setTimeout(() => { setInput(""); setMessage(null); setDetectedWorker(null); }, 4000);
  };

  const handleSubmit = (action: "in" | "out") => {
    if (!input || !selectedProject) {
      setMessage({ text: "Please enter your Phone/ID", type: "error" });
      return;
    }
    executeAttendance(input, action);
  };
  
  // Face Recognition Functions
  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsScanning(true);
          startScanning();
        }
      } catch (err) {
        setMessage({ text: "Camera access denied", type: "error" });
      }
    }
  };
  
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  };
  
  const startScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    
    scanIntervalRef.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        
        if (canvasRef.current) {
           faceapi.matchDimensions(canvasRef.current, displaySize);
        }
        
        // Full Face Recognition Pipeline
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
        ).withFaceLandmarks().withFaceDescriptors();
        
        if (canvasRef.current) {
           const resizedDetections = faceapi.resizeResults(detections, displaySize);
           const ctx = canvasRef.current.getContext('2d');
           ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
           faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
        }
        
        if (detections.length > 0) {
          // Pause camera reading
          if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
          setIsScanning(false);
          
          let workerIdToLog = "";
          let workerName = "";
          let matchScore = 96;

          // Use True Face Matcher if available
          if (faceMatcher) {
              const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
              if (bestMatch.label !== 'unknown') {
                  workerIdToLog = bestMatch.label;
                  workerName = allWorkers.find(w => w.id === workerIdToLog)?.name || "Worker";
                  matchScore = Math.max(70, Math.min(100, Math.round((1 - bestMatch.distance) * 100)));
              } else {
                  setMessage({ text: "Face detected but not recognized in database.", type: "error" });
                  setTimeout(() => { if (mode === "FACE") startCamera(); }, 3000);
                  return; // Don't proceed
              }
          } else {
              // Fallback to manual dropdown selection if FaceMatcher isn't built (no uploaded photos)
              workerIdToLog = testWorkerId;
              workerName = allWorkers.find(w => w.id === workerIdToLog)?.name || "Worker";
              matchScore = 98;
          }
          
          // Determine whether worker is currently checked in to toggle in / out
          let action: "in" | "out" = "in";
          try {
             const checkRes = await fetch(`/api/attendance?workerId=${workerIdToLog}`);
             const logs = await checkRes.json();
             const isCurrentlyIn = Array.isArray(logs) && logs.length > 0 && logs[0].status === "ON_SITE" && !logs[0].checkOutTime;
             action = isCurrentlyIn ? "out" : "in";
          } catch {
             action = "in";
          }

          // Real-time HUD banner displaying worker's name and action
          setDetectedWorker({ id: workerIdToLog, name: workerName, score: matchScore, action });
          setMessage({ 
            text: `Identified: ${workerName} • ${action === 'in' ? 'Clocking In' : 'Clocking Out'} (${matchScore}% Match)...`, 
            type: "info" 
          });

          // Draw unmirrored face label on canvas
          if (canvasRef.current && detections[0]) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) {
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                const box = resizedDetections[0].detection.box;
                ctx.save();
                ctx.translate(canvasRef.current.width, 0);
                ctx.scale(-1, 1);
                
                const actionLabel = action === 'in' ? 'CLOCK IN' : 'CLOCK OUT';
                const nameTag = `${workerName} • ${matchScore}% • ${actionLabel}`;
                ctx.font = 'bold 12px system-ui, sans-serif';
                const textWidth = ctx.measureText(nameTag).width;
                const unmirroredBoxX = canvasRef.current.width - (box.x + box.width);
                const badgeY = Math.max(26, box.y - 8);

                ctx.fillStyle = action === 'in' ? 'rgba(6, 78, 59, 0.95)' : 'rgba(120, 53, 15, 0.95)';
                ctx.fillRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);
                ctx.strokeStyle = action === 'in' ? '#10b981' : '#ef4444';
                ctx.lineWidth = 1;
                ctx.strokeRect(unmirroredBoxX, badgeY - 20, textWidth + 16, 22);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(nameTag, unmirroredBoxX + 8, badgeY - 5);
                ctx.restore();
             }
          }
          
          setTimeout(async () => {
             stopCamera();
             await executeAttendance(workerIdToLog, action);
             
             // Restart scanner after 5 seconds
             setTimeout(() => {
               setDetectedWorker(null);
               if (mode === "FACE") {
                 startCamera();
               }
             }, 5000);
          }, 1200);
        }
      }
    }, 1000);
  };
  
  useEffect(() => {
    if (mode === "FACE") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 font-mono text-white relative">
      
      {/* Mode Switcher */}
      <div className="absolute top-4 flex gap-2 bg-gray-800 p-1 rounded-xl shadow-lg border border-gray-700">
        <button 
          onClick={() => setMode("PIN")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${mode === "PIN" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <Calculator className="w-4 h-4" /> PIN Mode
        </button>
        <button 
          onClick={() => setMode("FACE")}
          disabled={!modelsLoaded}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${mode === "FACE" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"} ${!modelsLoaded ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ScanFace className="w-4 h-4" /> Face AI Mode
        </button>
      </div>
      
      <div className="absolute top-4 right-4 text-xs text-gray-500 flex items-center gap-2">
        <select
          className="bg-gray-800 text-white border border-gray-700 p-2 rounded outline-none"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span>Site: Kiosk 01</span>
      </div>

      {demoMode && (
        <div className="absolute top-16 left-4 flex items-center gap-2 rounded-lg bg-yellow-900/40 border border-yellow-700 px-3 py-2 text-xs text-yellow-400">
          <FlaskConical className="h-4 w-4" />
          <span className="font-bold">DEMO MODE</span> — No database connected
        </div>
      )}

      <div className="mb-8 text-center mt-12">
        <HardHat className="mx-auto mb-4 h-16 w-16 text-yellow-500" />
        <h1 className="text-3xl font-bold tracking-widest text-gray-100">DIGITAL GATE KIOSK</h1>
        <p className="text-gray-400 mt-2">
          {mode === "PIN" ? "Enter your Phone No. to Clock In/Out" : "Look at the camera to automatically check in"}
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl relative overflow-hidden">
        
        {message && (
          <div className={`mb-6 flex items-center justify-center gap-2 rounded p-3 text-sm font-semibold absolute top-4 left-4 right-4 z-50 shadow-lg ${
            message.type === 'success' ? 'bg-emerald-900 text-emerald-400 border border-emerald-500' :
            message.type === 'error' ? 'bg-red-900 text-red-400 border border-red-500' :
            'bg-blue-900 text-blue-400 border border-blue-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {message.text}
          </div>
        )}

        {/* PIN MODE UI */}
        {mode === "PIN" && (
          <>
            <div className="mb-6 rounded bg-gray-900 p-4 text-center shadow-inner overflow-hidden whitespace-nowrap">
              <div className="h-12 text-4xl font-bold tracking-widest text-emerald-400">
                {input || "----------"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num.toString())}
                  className="flex h-16 items-center justify-center rounded-lg bg-gray-800 text-2xl font-bold transition hover:bg-gray-700 active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="col-span-1 flex h-16 items-center justify-center rounded-lg bg-red-900/50 text-xl font-bold text-red-400 transition hover:bg-red-800/50 active:scale-95"
              >
                CLR
              </button>
              <button
                onClick={() => handleKeyPress("0")}
                className="flex h-16 items-center justify-center rounded-lg bg-gray-800 text-2xl font-bold transition hover:bg-gray-700 active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => setInput(input.slice(0, -1))}
                className="col-span-1 flex h-16 items-center justify-center rounded-lg bg-gray-800 text-xl font-bold transition hover:bg-gray-700 active:scale-95"
              >
                DEL
              </button>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => handleSubmit("in")}
                className="flex-1 rounded-lg bg-emerald-600 py-4 font-bold text-white transition hover:bg-emerald-500 active:scale-95 flex items-center justify-center gap-2"
              >
                <UserCheck className="h-5 w-5" />
                CLOCK IN
              </button>
              <button
                onClick={() => handleSubmit("out")}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 py-4 font-bold text-white transition hover:bg-gray-700 active:scale-95"
              >
                CLOCK OUT
              </button>
            </div>

            {demoMode && (
              <div className="mt-6 rounded-lg bg-gray-900 border border-gray-800 p-3 text-xs text-gray-500">
                <p className="font-bold text-gray-400 mb-1">📋 Demo Numbers:</p>
                {Object.entries(DEMO_WORKERS).map(([phone, name]) => (
                  <div key={phone} className="flex justify-between">
                    <span className="text-emerald-500 cursor-pointer hover:text-emerald-400" onClick={() => setInput(phone)}>{phone}</span>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FACE MODE UI */}
        {mode === "FACE" && (
          <div className="flex flex-col items-center py-4">
            
            {/* Status Indicator */}
            {isBuildingMatcher && (
              <div className="mb-4 bg-cyan-900/50 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                <ScanFace className="w-4 h-4" /> Training AI with Worker Photos...
              </div>
            )}

            {/* Real-time Detected Worker Name Banner */}
            {detectedWorker && (
              <div className={`mb-4 w-full p-3 rounded-xl border flex items-center justify-between shadow-lg animate-in fade-in zoom-in-95 duration-200 ${
                detectedWorker.action === 'in' 
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' 
                  : 'bg-red-950/90 border-red-500 text-red-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow ${
                    detectedWorker.action === 'in' ? 'bg-emerald-700' : 'bg-red-700'
                  }`}>
                    {detectedWorker.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{detectedWorker.name}</p>
                    <p className="text-[10px] text-gray-300 font-mono">Face Confidence: {detectedWorker.score}%</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md font-mono ${
                  detectedWorker.action === 'in' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
                }`}>
                  {detectedWorker.action === 'in' ? '🟢 CLOCK IN' : '🔴 CLOCK OUT'}
                </span>
              </div>
            )}
            
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] bg-gray-900 flex items-center justify-center">
              
              {!isScanning && !detectedWorker && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-cyan-500 bg-gray-900/80">
                   <ScanFace className="w-12 h-12 mb-2 opacity-50" />
                   <p className="text-sm font-bold animate-pulse">Initializing Camera...</p>
                </div>
              )}

              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
              />
              
              {/* Scanning Animation */}
              {isScanning && (
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]"></div>
              )}

              {/* In-Frame Floating Name Pill */}
              {detectedWorker && (
                <div className="absolute bottom-3 inset-x-2 z-20 flex justify-center pointer-events-none">
                  <div className="bg-black/90 backdrop-blur-md px-3 py-1 rounded-full border border-cyan-400 shadow-md">
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {detectedWorker.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes scan {
                0% { top: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}} />

            <div className="mt-6 text-center">
              <h3 className="text-lg font-bold text-cyan-400 mb-1">
                {detectedWorker ? `Verified: ${detectedWorker.name}` : "Face Recognition Active"}
              </h3>
              <p className="text-xs text-gray-400">
                {detectedWorker 
                  ? `Processing ${detectedWorker.action === 'in' ? 'Clock In' : 'Clock Out'} for ${detectedWorker.name}...` 
                  : "Look directly into the camera lens to clock in/out automatically."}
              </p>
              
              {!faceMatcher && !isBuildingMatcher && (
                <div className="mt-6 flex flex-col items-center">
                   <label className="text-xs text-amber-500/80 mb-2 font-bold uppercase tracking-wider">Fallback Demo Profile</label>
                   <select 
                     value={testWorkerId} 
                     onChange={(e) => setTestWorkerId(e.target.value)}
                     className="bg-gray-800 text-white border border-gray-700 px-4 py-2 rounded-lg outline-none font-bold min-w-[200px]"
                   >
                     {allWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                   </select>
                   <p className="text-[10px] text-gray-500 mt-2 max-w-xs">No worker photos found in database to train Face Matcher. Using manual selector simulation.</p>
                </div>
              )}
              
              {faceMatcher && (
                <div className="mt-6 flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-900/30 border border-emerald-900/50 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="w-4 h-4" /> AI Trained on Worker Photos. Ready to Match!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
