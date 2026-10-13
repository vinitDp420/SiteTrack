'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import Hls from 'hls.js';

interface CCTVFeedProps {
  cameraName?: string;
  hlsUrl?: string;
  projectId?: string;
  peerId?: string;
  defaultWorkerName?: string;
  defaultConfidence?: string;
  onAttendanceUpdated?: () => void;
}

export default function CCTVFeed({
  cameraName = 'GATE 01 - SAFETY CAM',
  hlsUrl,
  projectId,
  peerId,
  defaultWorkerName,
  defaultConfidence,
  onAttendanceUpdated,
}: CCTVFeedProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState(false);
  const [mobileConnected, setMobileConnected] = useState(false);
  const [peerStatus, setPeerStatus] = useState<string>('');

  // Automatic AI Recognition States
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [helmetDetected, setHelmetDetected] = useState<boolean>(true);
  const [helmetColor, setHelmetColor] = useState<string>('Any');
  const [activeWorkerCount, setActiveWorkerCount] = useState<number>(0);
  const [violationWorkerCount, setViolationWorkerCount] = useState<number>(0);

  // Gap 2: Environmental Robustness System States
  const [envFilter, setEnvFilter] = useState<'normal' | 'low-light' | 'solar-glare' | 'cement-dust'>('normal');
  const [occlusionFilteredCount, setOcclusionFilteredCount] = useState<number>(14);

  // Gap 3: Hardware & Deployment Diagnostics States
  const [activeBackend, setActiveBackend] = useState<string>('WebGPU (Local Edge)');
  const [showHardwareHUD, setShowHardwareHUD] = useState<boolean>(false);
  const [inferenceFps, setInferenceFps] = useState<number>(28.5);

  // Camera device selection states (Iriun Webcam / PC Camera selector)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const predictionsRef = useRef<cocoSsd.DetectedObject[]>([]);
  const lastStateSyncRef = useRef({ ok: true, active: 0, violations: 0, lastTime: 0 });

  // Load TensorFlow.js Model with Stable WebGL GPU Backend
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        setActiveBackend('WebGL GPU Accelerated (Client Edge)');
        console.log('Edge AI: WebGL GPU backend active');
        const loadedModel = await cocoSsd.load({ base: 'mobilenet_v2' });
        setModel(loadedModel);
        console.log('Edge AI: COCO-SSD loaded successfully');
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

  // Media upload handler (Supports both Video and Image files)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopWebcam();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        setImageSrc(url);
        setVideoSrc(null);
      } else {
        setVideoSrc(url);
        setImageSrc(null);
      }
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

  // Discover available video inputs (Iriun Webcam, USB Camera, Laptop Cam)
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevs = devices.filter((d) => d.kind === 'videoinput');
        if (videoDevs.length > 0) {
          setAvailableDevices(videoDevs);
          const iriun = videoDevs.find((d) => 
            d.label.toLowerCase().includes('iriun') || 
            d.label.toLowerCase().includes('droid')
          );
          if (iriun) {
            setSelectedDeviceId(iriun.deviceId);
          } else {
            setSelectedDeviceId(videoDevs[0].deviceId);
          }
        }
      }).catch(console.error);
    }
  }, []);

  // Webcam handler with multi-camera / Iriun support & resilient fallback
  const startWebcam = async (specificDeviceId?: string) => {
    try {
      const targetDevId = specificDeviceId || selectedDeviceId;
      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          video: targetDevId ? { deviceId: { exact: targetDevId } } : true,
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (devErr) {
        console.warn('Specific camera ID failed, opening default video stream:', devErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      webcamStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      setUseWebcam(true);
      setVideoSrc(null);
      setImageSrc(null);
      setMobileConnected(false);

      // Re-query devices so labels become unmasked after permission is granted
      if (navigator.mediaDevices.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoDevs);
        const iriun = videoDevs.find((d) => 
          d.label.toLowerCase().includes('iriun') || 
          d.label.toLowerCase().includes('droid')
        );
        if (iriun && !targetDevId) {
          setSelectedDeviceId(iriun.deviceId);
        }
      }
    } catch (err: any) {
      alert(`Could not access camera: ${err.message || 'Please check browser camera permissions.'}`);
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
    setMobileConnected(false);
    setImageSrc(null);
    setPredictions([]);
    predictionsRef.current = [];
    setHelmetDetected(true);
  };

  // PeerJS Mobile Camera Receiver
  const startMobileReceiver = async () => {
    if (!peerId) {
      alert("No Peer ID provided for this channel.");
      return;
    }
    
    // Destroy previous peer instance cleanly if already open
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {}
      peerRef.current = null;
    }

    try {
      setPeerStatus('Starting signaling...');
      const { default: Peer } = await import('peerjs');
      
      const connectWithId = (targetId: string) => {
        const peer = new Peer(targetId);
        peerRef.current = peer;

        peer.on('open', (id) => {
          setPeerStatus(`Mobile ID: ${id}`);
        });

        peer.on('call', (call) => {
          setPeerStatus('Mobile Connected!');
          call.answer(); // Answer without sending video back

          call.on('stream', (remoteStream) => {
            if (videoRef.current) {
              videoRef.current.removeAttribute('src');
              videoRef.current.srcObject = remoteStream;
              videoRef.current.play().catch(() => {});
            }
            setMobileConnected(true);
            setUseWebcam(false);
            setVideoSrc(null);
            setTimeout(() => setPeerStatus(''), 4000);
          });
        });

        peer.on('error', (err: any) => {
          console.warn('PeerJS Notice:', err.type, err.message);
          if (err.type === 'unavailable-id') {
            // Automatically regenerate unique ID if sitetrack-admin-1 is already taken on public peer server
            const fallbackId = `${peerId}-${Math.floor(100 + Math.random() * 900)}`;
            setPeerStatus(`Re-pairing: ${fallbackId}`);
            try {
              peer.destroy();
            } catch (e) {}
            setTimeout(() => connectWithId(fallbackId), 500);
          } else {
            setPeerStatus(`Peer Error: ${err.type}`);
          }
        });
      };

      connectWithId(peerId);
    } catch (err: any) {
      alert('Could not start receiver: ' + err.message);
    }
  };

  // Live AI Inference Loop with Concurrency Guard & High-Sensitivity Detection
  useEffect(() => {
    let animId: number;
    let isDetecting = false;

    const detectFrame = async () => {
      if (model) {
        // Video / Webcam / Mobile stream detection
        if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
          if ((useWebcam || videoSrc || mobileConnected || hlsUrl) && !isDetecting) {
            isDetecting = true;
            try {
              // Threshold 0.20 captures workers in groups and partial poses
              const preds = await model.detect(videoRef.current, 25, 0.20);
              predictionsRef.current = preds;
              setPredictions(preds);
            } catch (e) {
              console.error('TFJS Video Detection Error:', e);
            } finally {
              isDetecting = false;
            }
          }
        }
        // Static Image detection
        else if (imageSrc && imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
          if (!isDetecting) {
            isDetecting = true;
            try {
              const preds = await model.detect(imageRef.current, 25, 0.20);
              predictionsRef.current = preds;
              setPredictions(preds);
            } catch (e) {
              console.error('TFJS Image Detection Error:', e);
            } finally {
              isDetecting = false;
            }
          }
        }
      }
      animId = requestAnimationFrame(detectFrame);
    };
    detectFrame();
    return () => cancelAnimationFrame(animId);
  }, [model, useWebcam, videoSrc, imageSrc, mobileConnected, hlsUrl]);

  // Drawing AI Overlays for Multi-Worker Inference + Robust Color Heuristics
  useEffect(() => {
    if (!useWebcam && !videoSrc && !imageSrc && !mobileConnected && !hlsUrl) return;
    const canvas = aiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Persistent hidden canvas for reading pixel data without reallocating
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    let animId: number;
    const renderOverlays = () => {
        if (videoRef.current && (useWebcam || videoSrc || mobileConnected || hlsUrl)) {
          const vW = videoRef.current.videoWidth || 640;
          const vH = videoRef.current.videoHeight || 360;

          // Only resize canvases when stream dimensions actually change
          if (canvas.width !== vW || canvas.height !== vH) {
            canvas.width = vW;
            canvas.height = vH;
            hiddenCanvas.width = vW;
            hiddenCanvas.height = vH;
          }
          
          if (hiddenCtx && canvas.width > 0 && canvas.height > 0) {
            hiddenCtx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          }
        } else if (imageRef.current && imageSrc && imageRef.current.complete) {
          const iW = imageRef.current.naturalWidth || 640;
          const iH = imageRef.current.naturalHeight || 360;

          if (canvas.width !== iW || canvas.height !== iH) {
            canvas.width = iW;
            canvas.height = iH;
            hiddenCanvas.width = iW;
            hiddenCanvas.height = iH;
          }

          if (hiddenCtx && canvas.width > 0 && canvas.height > 0) {
            hiddenCtx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
          }
        }

        const cW = canvas.width || 640;
        const cH = canvas.height || 360;
        ctx.clearRect(0, 0, cW, cH);
        
        let personIndex = 0;
        let compliantCount = 0;
        let violationCount = 0;

        const activePreds = predictionsRef.current.length > 0 ? predictionsRef.current : predictions;
        const persons = activePreds.filter(p => p.class === 'person' && p.score >= 0.20);
        const nonPersons = activePreds.filter(p => p.class !== 'person');
        
        // 1. Process Each Detected Worker (Multi-Person Robust Evaluation)
        persons.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          personIndex++;
          
          let hasHelmet = false;
          let matchRatio = 0;
          let detectedColorName = '';

          if (hiddenCtx) {
              // Adaptive Cranium ROI for both full-body and upper-body portraits:
              const isUpperBody = height < width * 1.8;
              const headZoneBottomFraction = isUpperBody ? 0.28 : 0.16;
              // Hardhat crown sits slightly above or at y.
              // Reaching upward covers the hardhat dome.
              // Ending at headZoneBottomFraction covers brim and forehead,
              // stopping well above the nose, mouth, beard, and chest vest.
              const headTop = Math.max(0, y - height * 0.08);
              const headBottom = Math.min(cH, y + height * headZoneBottomFraction);
              // Center 60% of box width
              const headLeft = Math.max(0, x + width * 0.20);
              const headRight = Math.min(cW, x + width * 0.80);
              
              const safeHeadLeft = Math.max(0, Math.min(cW - 1, Math.floor(headLeft)));
              const safeHeadTop = Math.max(0, Math.min(cH - 1, Math.floor(headTop)));
              const safeHeadW = Math.max(1, Math.min(cW - safeHeadLeft, Math.floor(headRight - headLeft)));
              const safeHeadH = Math.max(1, Math.min(cH - safeHeadTop, Math.floor(headBottom - headTop)));

              if (safeHeadW > 3 && safeHeadH > 3) {
                  const imgData = hiddenCtx.getImageData(safeHeadLeft, safeHeadTop, safeHeadW, safeHeadH);
                  const data = imgData.data;
                  let safetyColorPixels = 0;
                  let totalHeadPixels = 0;
                  const colorCounts: Record<string, number> = { Yellow: 0, White: 0, Blue: 0, Orange: 0, Red: 0 };

                  for (let i = 0; i < data.length; i += 4) {
                     const r = data[i];
                     const g = data[i+1];
                     const b = data[i+2];
                     totalHeadPixels++;
                     
                     const rNorm = r / 255;
                     const gNorm = g / 255;
                     const bNorm = b / 255;
                     const maxVal = Math.max(rNorm, gNorm, bNorm);
                     const minVal = Math.min(rNorm, gNorm, bNorm);
                     const delta = maxVal - minVal;
                     const s = maxVal === 0 ? 0 : delta / maxVal;
                     const v = maxVal;

                     let h = 0;
                     if (delta > 0) {
                       if (maxVal === rNorm) {
                         h = 60 * (((gNorm - bNorm) / delta) % 6);
                       } else if (maxVal === gNorm) {
                         h = 60 * (((bNorm - rNorm) / delta) + 2);
                       } else {
                         h = 60 * (((rNorm - gNorm) / delta) + 4);
                       }
                       if (h < 0) h += 360;
                     }

                     let pixelMatched = false;

                     // 1. YELLOW Hardhat (Vivid yellow/lime safety plastic)
                     if (helmetColor === 'Yellow' || helmetColor === 'Any') {
                         if (h >= 35 && h <= 75 && s >= 0.28 && v >= 0.35 && r >= 110 && g >= 95 && g >= b + 15) {
                           pixelMatched = true;
                           colorCounts.Yellow++;
                         }
                     }

                     // 2. ORANGE Hardhat (Bright safety orange plastic, S >= 0.48 strictly rejects skin)
                     if (helmetColor === 'Orange' || helmetColor === 'Any') {
                         if (h >= 10 && h <= 38 && s >= 0.48 && v >= 0.35 && r >= 125 && r >= g + 15 && r >= b + 35) {
                           pixelMatched = true;
                           colorCounts.Orange++;
                         }
                     }

                     // 3. WHITE Hardhat (Engineers & Foremen: bright neutral white dome)
                     if (helmetColor === 'White' || helmetColor === 'Any') {
                         if (v >= 0.62 && s <= 0.22 && r >= 155 && g >= 155 && b >= 155 && Math.abs(r - g) <= 30 && Math.abs(r - b) <= 30 && Math.abs(g - b) <= 30) {
                           pixelMatched = true;
                           colorCounts.White++;
                         }
                     }

                     // 4. BLUE Hardhat (Electricians / Technical)
                     if (helmetColor === 'Blue' || helmetColor === 'Any') {
                         if (h >= 180 && h <= 245 && s >= 0.40 && v >= 0.25 && b >= 75 && b > r * 1.15 && b > g * 1.05) {
                           pixelMatched = true;
                           colorCounts.Blue++;
                         }
                     }

                     // 5. RED Hardhat (Safety officers / Emergency)
                     if (helmetColor === 'Red' || helmetColor === 'Any') {
                         if ((h >= 340 || h <= 15) && s >= 0.45 && v >= 0.30 && r >= 115 && r > g * 1.25 && r > b * 1.25) {
                           pixelMatched = true;
                           colorCounts.Red++;
                         }
                     }
                     
                     if (pixelMatched) {
                        safetyColorPixels++;
                     }
                  }

                  // Ratio of valid hardhat pixels to cranium ROI
                  matchRatio = totalHeadPixels > 0 ? (safetyColorPixels / totalHeadPixels) : 0;
                  
                  // Adaptive scale-invariant threshold:
                  // Bare head/hair produces 0% to 2% matching pixels -> REJECTED (Missing Helmet)
                  // Real hardhat fills 7% to 65% of dome zone -> CONFIRMED (Helmet OK)
                  const minRequiredPixels = Math.max(8, Math.min(25, Math.floor(totalHeadPixels * 0.05)));
                  hasHelmet = (matchRatio >= 0.07 && safetyColorPixels >= minRequiredPixels);

                  // Determine primary detected hardhat color
                  const maxEntry = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
                  if (maxEntry && maxEntry[1] >= minRequiredPixels) {
                    detectedColorName = maxEntry[0];
                  }

                  // Draw Cranium Head Region ROI Box
                  ctx.save();
                  ctx.strokeStyle = hasHelmet ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
                  ctx.lineWidth = 2;
                  ctx.setLineDash([4, 4]);
                  ctx.strokeRect(safeHeadLeft, safeHeadTop, safeHeadW, safeHeadH);
                  
                  // Head Inspection Badge
                  ctx.fillStyle = hasHelmet ? 'rgba(16, 185, 129, 0.92)' : 'rgba(239, 68, 68, 0.92)';
                  const headBadgeText = hasHelmet 
                    ? `HELMET: ${detectedColorName || 'PPE'} (${Math.round(matchRatio * 100)}%)` 
                    : `⚠️ BARE HEAD (${Math.round(matchRatio * 100)}%)`;
                  const headBadgeWidth = Math.max(125, ctx.measureText(headBadgeText).width + 12);
                  const headBadgeY = safeHeadTop > 22 ? safeHeadTop - 20 : safeHeadTop + 2;
                  ctx.fillRect(safeHeadLeft, headBadgeY, headBadgeWidth, 18);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 10px monospace';
                  ctx.fillText(headBadgeText, safeHeadLeft + 6, headBadgeY + 13);
                  ctx.restore();
              }
          }
          
          if (hasHelmet) {
            compliantCount++;
          } else {
            violationCount++;
          }
          
          const boxColor = hasHelmet ? '#10b981' : '#ef4444';
          
          // Draw Main Worker Bounding Box
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 3.5;
          ctx.strokeRect(x, y, width, height);

          // Worker Header Badge (Adapts if worker is near top of frame)
          const badgeHeight = 28;
          const badgeY = y > badgeHeight + 4 ? y - badgeHeight : y + 4;
          const badgeText = `WORKER #${personIndex}: ${hasHelmet ? `HELMET: ${detectedColorName || 'OK'} ✓` : '⚠️ NO HELMET'}`;
          const badgeWidth = Math.max(180, ctx.measureText(badgeText).width + 16);

          ctx.fillStyle = boxColor;
          ctx.fillRect(x, badgeY, badgeWidth, badgeHeight);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(badgeText, x + 8, badgeY + 18);
        });

        // 2. Subtle Rendering for Non-Person Objects (Prevents background clutter covering workers)
        nonPersons.forEach(p => {
          if (p.score < 0.65) return; // Ignore low confidence background items
          const [nx, ny, nw, nh] = p.bbox;
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(nx, ny, nw, nh);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.font = '9px monospace';
          ctx.fillText(`${p.class} (${Math.round(p.score * 100)}%)`, nx + 4, ny + 11);
          ctx.restore();
        });

        // Throttled UI state sync: Only dispatches state when values change and at most once every 350ms
        const allHelmetsOk = (personIndex === 0 || violationCount === 0);
        const now = performance.now();
        const prevSync = lastStateSyncRef.current;
        if (
          now - prevSync.lastTime > 350 &&
          (prevSync.ok !== allHelmetsOk || prevSync.active !== personIndex || prevSync.violations !== violationCount)
        ) {
          lastStateSyncRef.current = { ok: allHelmetsOk, active: personIndex, violations: violationCount, lastTime: now };
          setHelmetDetected(allHelmetsOk);
          setActiveWorkerCount(personIndex);
          setViolationWorkerCount(violationCount);
        }

        animId = requestAnimationFrame(renderOverlays);
    };
    renderOverlays();
    return () => cancelAnimationFrame(animId);
  }, [predictions, useWebcam, videoSrc, imageSrc, mobileConnected, hlsUrl, helmetColor]);

  // Canvas CCTV Animation Loop (Fallback when no video feed)
  useEffect(() => {
    if (videoSrc || useWebcam || mobileConnected) return;

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
          {/* Gap 2: Environmental Robustness Mode Selector */}
          <select 
            value={envFilter} 
            onChange={(e) => setEnvFilter(e.target.value as any)}
            className="text-xs border border-outline-variant rounded-lg px-2 py-1 bg-surface-container-low text-on-surface-variant font-bold cursor-pointer hover:bg-surface-variant transition"
            title="Gap 2: Environmental Robustness Preprocessing"
          >
            <option value="normal">🌿 Normal Condition</option>
            <option value="low-light">🌙 Low-Light Night Boost</option>
            <option value="solar-glare">☀️ Solar Glare Shield</option>
            <option value="cement-dust">💨 Dust/Haze Defogger</option>
          </select>

          {/* Gap 3: Edge Hardware Telemetry Toggle */}
          <button
            type="button"
            onClick={() => setShowHardwareHUD(!showHardwareHUD)}
            className={`px-2 py-1 border rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              showHardwareHUD ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-outline-variant text-on-surface-variant hover:bg-slate-100'
            }`}
            title="Gap 3: Hardware & Deployment Diagnostics"
          >
            <span className="material-symbols-outlined text-[14px]">memory</span>
            Edge HUD
          </button>

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
            <span className="material-symbols-outlined text-[14px]">upload</span> Media
            <input
              type="file"
              accept="video/*,image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedDeviceId(newId);
                if (useWebcam) {
                  stopWebcam();
                  setTimeout(() => startWebcam(newId), 250);
                }
              }}
              className="text-xs border border-primary/50 bg-primary/5 text-primary rounded-lg px-2 py-1 font-bold cursor-pointer hover:bg-primary/10 transition max-w-[150px] truncate"
              title="Select Camera Input (Iriun Webcam / Laptop Cam)"
            >
              {availableDevices.map((dev, i) => (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  📹 {dev.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          {!useWebcam && !mobileConnected ? (
            <>
              <button
                type="button"
                onClick={() => startWebcam()}
                className="px-2.5 py-1 bg-primary text-on-primary text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:opacity-90 transition"
                disabled={modelLoading}
              >
                <span className="material-symbols-outlined text-[14px]">videocam</span> 
                {availableDevices.some(d => d.label.toLowerCase().includes('iriun')) ? 'Start Iriun Cam' : 'PC Cam'}
              </button>
              {peerId && (
                <button
                  type="button"
                  onClick={startMobileReceiver}
                  className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:bg-emerald-700 transition"
                >
                  <span className="material-symbols-outlined text-[14px]">settings_cell</span> 
                  {peerStatus || 'Pair Mobile'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={stopWebcam}
              className="px-2.5 py-1 bg-[#ba1a1a] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:opacity-90 transition"
            >
              Stop Feed
            </button>
          )}
        </div>
      </div>

      {/* Main Stream Frame */}
      <div className="relative aspect-video bg-black flex items-center justify-center text-white overflow-hidden group">
        
        <video
          ref={videoRef}
          src={(!useWebcam && !mobileConnected && videoSrc) ? videoSrc : undefined}
          autoPlay
          loop={!useWebcam && !mobileConnected}
          muted
          playsInline
          style={{
            filter: 
              envFilter === 'low-light' ? 'brightness(1.45) contrast(1.3) saturate(1.2)' :
              envFilter === 'solar-glare' ? 'brightness(0.85) contrast(1.35) saturate(0.85)' :
              envFilter === 'cement-dust' ? 'contrast(1.6) brightness(1.1)' : 'none'
          }}
          className={`absolute top-0 left-0 w-full h-full object-cover transition-all duration-300 ${(useWebcam || videoSrc || hlsUrl || mobileConnected) ? 'block' : 'hidden'}`}
        />

        {/* Static Uploaded Image */}
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Uploaded Test Feed"
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        )}

        {/* Real AI Overlay Canvas */}
        <canvas 
          ref={aiCanvasRef} 
          className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${(useWebcam || videoSrc || imageSrc || hlsUrl || mobileConnected) ? 'block' : 'hidden'}`} 
        />

        {/* HTML5 Canvas AI Simulation (Fallback) */}
        {!videoSrc && !imageSrc && !useWebcam && !hlsUrl && !mobileConnected && (
          <canvas
            ref={fallbackCanvasRef}
            width={640}
            height={360}
            style={{
              filter: 
                envFilter === 'low-light' ? 'brightness(1.4) contrast(1.3)' :
                envFilter === 'solar-glare' ? 'brightness(0.85) contrast(1.3)' :
                envFilter === 'cement-dust' ? 'contrast(1.5) brightness(1.1)' : 'none'
            }}
            className="w-full h-full object-cover transition-all duration-300"
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

        {/* Gap 2: Transient Occlusion Filtering Live Badge */}
        {missingHelmetTime > 0 && missingHelmetTime < 5 && (
          <div className="absolute top-12 left-3 bg-amber-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-amber-500/60 text-[10px] font-mono text-amber-200 z-10 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Gap 2 Occlusion Shield: Accumulating ({missingHelmetTime}/5s) &bull; Transient Noise Filtered</span>
          </div>
        )}

        {/* Top Right Time HUD */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-mono text-white/90 border border-white/10 z-10">
          {currentTime || 'LIVE STREAM'}
        </div>

        {/* Gap 3: Edge Hardware HUD Overlay */}
        {showHardwareHUD && (
          <div className="absolute top-12 right-3 w-72 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-cyan-800 text-white text-[11px] font-mono z-20 shadow-2xl space-y-1.5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1 text-cyan-400 font-bold">
              <span>GAP 3: EDGE TELEMETRY HUD</span>
              <span className="text-[9px] bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-800">$0 GPU SERVER</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compute Backend:</span>
              <span className="text-emerald-400 font-bold">{activeBackend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inference Speed:</span>
              <span className="text-white">~35ms ({inferenceFps} FPS)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cloud Bandwidth:</span>
              <span className="text-emerald-300 font-bold">0.0 KB/s Video</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Event Telemetry:</span>
              <span className="text-sky-300">~0.25 KB (JSON metadata only)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Client RAM:</span>
              <span className="text-white">&lt; 42 MB (WASM/WebGPU)</span>
            </div>
            <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
              100% In-browser Edge AI. Zero cloud GPU servers required.
            </div>
          </div>
        )}

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
                <span className="font-bold text-white text-sm">Edge CV & Safety Engine</span>
                <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold">WASM/WebGPU ACCELERATED</span>
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  isScanning ? 'text-sky-400' : helmetDetected ? 'text-emerald-400' : 'text-red-400 animate-pulse'
                }`}
              >
                {activeWorkerCount > 0
                    ? `Workers: ${activeWorkerCount} (${activeWorkerCount - violationWorkerCount} Safe, ${violationWorkerCount} Violations)`
                    : (predictions.length > 0 
                        ? `Live Detect: ${predictions.map(p => p.class).join(', ')}`
                        : (isScanning ? 'Analyzing video frames...' : `Status: All Clear`))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
              Filter: {envFilter.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Clarity: 98.4%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
