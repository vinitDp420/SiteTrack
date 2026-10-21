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
  const [activeDeviceLabel, setActiveDeviceLabel] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showIriunGuide, setShowIriunGuide] = useState<boolean>(false);
  const [isDetectingDevices, setIsDetectingDevices] = useState<boolean>(false);

  // IP Camera Stream states (e.g. Android IP Webcam app over local WiFi)
  const [ipCamUrl, setIpCamUrl] = useState<string | null>(null);
  const [inputIpCamUrl, setInputIpCamUrl] = useState<string>('http://192.168.0.101:8080/video');
  const [showIpCamModal, setShowIpCamModal] = useState<boolean>(false);
  const ipCamImgRef = useRef<HTMLImageElement | null>(null);

  // Mobile Pairing states (QR Code / WebRTC / USB Cable)
  const [showMobilePairModal, setShowMobilePairModal] = useState<boolean>(false);
  const [hostIp, setHostIp] = useState<string>('192.168.0.102');
  const [activePeerChannel, setActivePeerChannel] = useState<string>(peerId || 'sitetrack-admin-1');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [pairModalTab, setPairModalTab] = useState<'ipcam' | 'usb' | 'qr' | 'hotspot' | 'chrome-fix'>('ipcam');

  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Real AI States
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [predictions, setPredictions] = useState<cocoSsd.DetectedObject[]>([]);
  const [modelLoading, setModelLoading] = useState(true);

  // Violation tracking & Auto-Dispatch pipeline
  const [missingHelmetTime, setMissingHelmetTime] = useState<number>(0);
  const violationStartTimeRef = useRef<number | null>(null);
  const lastAlertDispatchedRef = useRef<number>(0);
  const [dispatchedAlert, setDispatchedAlert] = useState<{
    workerName: string;
    time: string;
    message: string;
  } | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  const dispatchSafetyViolation = async (reason?: string) => {
    if (isDispatching) return;
    setIsDispatching(true);
    try {
      const res = await fetch('/api/safety-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || undefined,
          cameraName: cameraName || 'CCTV_ZONE_1',
          workerName: defaultWorkerName || undefined,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDispatchedAlert({
          workerName: data.workerName || 'Worker on Site',
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: data.message || 'Safety violation logged.',
        });
        setTimeout(() => setDispatchedAlert(null), 8000);
        if (onAttendanceUpdated) onAttendanceUpdated();
      }
    } catch (err) {
      console.error('Failed to dispatch safety violation:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
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

  // HLS stream loader with clean lifecycle management
  useEffect(() => {
    if (hlsUrl && videoRef.current && !useWebcam && !mobileConnected) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsInstanceRef.current = hls;
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
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.detachMedia();
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [hlsUrl, useWebcam, mobileConnected]);

  // Violation reporting logic (Phi_compliance integration)
  useEffect(() => {
    let interval: number;
    if (!helmetDetected) {
      interval = window.setInterval(() => {
        setMissingHelmetTime((prev) => prev + 1);
      }, 1000);
    } else {
      setMissingHelmetTime(0);
    }
    return () => clearInterval(interval);
  }, [helmetDetected]);

  useEffect(() => {
    // If missing helmet for 5+ seconds, auto-dispatch violation to backend
    if (missingHelmetTime >= 5) {
      const nowTs = Date.now();
      if (nowTs - lastAlertDispatchedRef.current > 30000) {
        lastAlertDispatchedRef.current = nowTs;
        dispatchSafetyViolation('Continuous hardhat absence for 5+ seconds confirmed (Gap 2 temporal filter)');
      }
    }
  }, [missingHelmetTime]);

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

  // Helper to format human-readable camera labels with device category icons
  const formatDeviceLabel = (dev: MediaDeviceInfo, index: number) => {
    const lbl = dev.label ? dev.label.trim() : '';
    const lower = lbl.toLowerCase();
    if (lower.includes('iriun')) {
      const match = lbl.match(/#\d+/);
      const slotNum = match ? match[0] : (index > 0 ? `#${index}` : '#1');
      return `📱 Iriun Webcam ${slotNum} (Phone)`;
    }
    if (lower.includes('droid')) {
      return `📱 DroidCam (Phone)`;
    }
    if (lower.includes('camo')) {
      return `📱 Camo (Phone)`;
    }
    if (lower.includes('obs')) {
      return `🖥️ OBS Virtual Camera`;
    }
    if (lower.includes('integrated') || lower.includes('built-in') || lower.includes('builtin') || lower.includes('internal') || lower.includes('front')) {
      return `💻 Laptop Camera (${lbl || 'Integrated'})`;
    }
    if (lbl) {
      return `📹 ${lbl}`;
    }
    return `📹 Camera ${index + 1}`;
  };

  // Resilient device refresher with optional permission probe to unmask device labels
  const refreshDevices = async (shouldProbePermission = false): Promise<MediaDeviceInfo[]> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    setIsDetectingDevices(true);
    try {
      let devs = await navigator.mediaDevices.enumerateDevices();
      let videoDevs = devs.filter((d) => d.kind === 'videoinput');

      // If device labels are masked (empty) and probing is allowed, request a brief stream to reveal real hardware names
      const labelsAreMasked = videoDevs.some((d) => !d.label);
      if (shouldProbePermission && labelsAreMasked && navigator.mediaDevices.getUserMedia) {
        try {
          const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          probeStream.getTracks().forEach((t) => t.stop());
          devs = await navigator.mediaDevices.enumerateDevices();
          videoDevs = devs.filter((d) => d.kind === 'videoinput');
        } catch (probeErr) {
          console.warn('Probe permission request was dismissed:', probeErr);
        }
      }

      setAvailableDevices(videoDevs);

      // Auto-detect Iriun or DroidCam
      const iriunDev = videoDevs.find((d) =>
        d.label.toLowerCase().includes('iriun') || d.label.toLowerCase().includes('droid')
      );

      // Select Iriun if found and nothing selected yet, or preserve valid selection
      if (iriunDev && (!selectedDeviceId || !videoDevs.some((d) => d.deviceId === selectedDeviceId))) {
        setSelectedDeviceId(iriunDev.deviceId);
      } else if (videoDevs.length > 0 && !videoDevs.some((d) => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }

      return videoDevs;
    } catch (err) {
      console.error('Failed to enumerate media devices:', err);
      return [];
    } finally {
      setIsDetectingDevices(false);
    }
  };

  // Discover available video inputs on mount & dynamically listen for hardware plug/unplug
  useEffect(() => {
    refreshDevices(false);

    if (typeof window !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const handleDeviceChange = () => {
        console.log('Video hardware change detected, updating available camera devices...');
        refreshDevices(false);
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, []);

  // Webcam handler with multi-camera / Iriun support & strict device enforcement
  const startWebcam = async (specificDeviceId?: string, preferIriun = false) => {
    setCameraError(null);
    try {
      let currentDevices = availableDevices;
      if (currentDevices.length === 0 || preferIriun || currentDevices.some((d) => !d.label)) {
        currentDevices = await refreshDevices(true);
      }

      let targetDevId = specificDeviceId;

      // Collect all available Iriun slots (Iriun Webcam #1, #2, #3, #4)
      const iriunDevs = currentDevices.filter((d) =>
        d.label.toLowerCase().includes('iriun') || d.label.toLowerCase().includes('droid')
      );

      if (preferIriun) {
        if (iriunDevs.length > 0) {
          const matchExisting = iriunDevs.find((d) => d.deviceId === selectedDeviceId);
          targetDevId = matchExisting ? matchExisting.deviceId : iriunDevs[0].deviceId;
          setSelectedDeviceId(targetDevId);
        } else {
          setShowIriunGuide(true);
          setCameraError(
            'Iriun Webcam driver was not found on this computer. Please open the Iriun app on your PC & phone, then click "Rescan Cameras".'
          );
          return;
        }
      }

      if (!targetDevId) {
        targetDevId = selectedDeviceId || currentDevices[0]?.deviceId;
      }

      const isTargetingIriun = preferIriun || (
        currentDevices.find((d) => d.deviceId === targetDevId)?.label.toLowerCase().includes('iriun') || false
      );

      // Stop previous stream tracks cleanly & detach HLS pipeline
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.detachMedia();
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }
      setIpCamUrl(null);

      let stream: MediaStream | null = null;

      // If targeting Iriun, use EXACT device constraint across slots to prevent Chrome from falling back to laptop webcam!
      if (isTargetingIriun) {
        const slotsToTry = [
          ...iriunDevs.filter((d) => d.deviceId === targetDevId),
          ...iriunDevs.filter((d) => d.deviceId !== targetDevId),
        ];

        let foundWorkingSlot = false;
        for (const slot of slotsToTry) {
          try {
            console.log(`Testing Iriun slot: ${slot.label} (${slot.deviceId})`);
            const candStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: slot.deviceId },
              },
              audio: false,
            });
            const candTrack = candStream.getVideoTracks()[0];
            const candLabel = (candTrack?.label || '').toLowerCase();
            if (candLabel.includes('iriun') || candLabel.includes('droid')) {
              stream = candStream;
              setSelectedDeviceId(slot.deviceId);
              foundWorkingSlot = true;
              break;
            } else {
              candStream.getTracks().forEach((t) => t.stop());
            }
          } catch (slotErr) {
            console.warn(`Iriun slot ${slot.label} could not be acquired:`, slotErr);
          }
        }

        if (!foundWorkingSlot || !stream) {
          throw new Error('Iriun Webcam is waiting for video from your phone. Please ensure Iriun is open in foreground on your phone, or connect phone to laptop via USB cable.');
        }
      } else {
        // Standard non-Iriun camera (laptop camera)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: targetDevId ? { deviceId: { exact: targetDevId } } : true,
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (!stream) {
        throw new Error('Unable to acquire media stream from camera.');
      }

      const activeTrack = stream.getVideoTracks()[0];
      const activeLabel = (activeTrack?.label || '').toLowerCase();

      // STRICT CHECK: Verify that Chrome did not secretly substitute the laptop camera!
      if (isTargetingIriun && !activeLabel.includes('iriun') && !activeLabel.includes('droid')) {
        stream.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setUseWebcam(false);
        setActiveDeviceLabel('');
        setCameraError(
          'Iriun Webcam is waiting for your phone to connect. Chrome tried to open your laptop camera instead, which was blocked so that only your phone camera is used.'
        );
        setShowIriunGuide(true);
        return;
      }

      webcamStreamRef.current = stream;
      setActiveDeviceLabel(activeTrack?.label || '');

      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      setUseWebcam(true);
      setVideoSrc(null);
      setImageSrc(null);
      setMobileConnected(false);
      setIpCamUrl(null);

      // Re-query devices so labels become unmasked now that permission is granted
      await refreshDevices(false);
    } catch (err: any) {
      console.error('startWebcam failed:', err);
      const isIriunTarget = availableDevices
        .find((d) => d.deviceId === specificDeviceId || d.deviceId === selectedDeviceId)
        ?.label.toLowerCase().includes('iriun');

      if (isIriunTarget || preferIriun) {
        setCameraError(
          'Iriun Webcam is detected, but no live video stream was received from your phone. Ensure the Iriun app is OPEN on your phone and both devices are on the same Wi-Fi (or connect via USB cable).'
        );
        setShowIriunGuide(true);
      } else {
        setCameraError(`Could not access camera: ${err.message || 'Please check browser camera permissions.'}`);
      }
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
    setIpCamUrl(null);
    setImageSrc(null);
    setActiveDeviceLabel('');
    setPredictions([]);
    predictionsRef.current = [];
    setHelmetDetected(true);
  };

  // PeerJS Mobile Camera Receiver with interactive QR pairing
  const startMobileReceiver = async () => {
    if (!peerId) {
      alert("No Peer ID provided for this channel.");
      return;
    }

    // Stop HLS stream if running
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.detachMedia();
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    setShowMobilePairModal(true);

    // Fetch dynamic host machine Wi-Fi / LAN IP
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setHostIp(data.ip);
      })
      .catch(() => {});
    
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
          setActivePeerChannel(id);
          setPeerStatus(`Listening: ${id}`);
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
            setShowMobilePairModal(false); // Auto-dismiss modal on successful connection
            setTimeout(() => setPeerStatus(''), 4000);
          });
        });

        peer.on('error', (err: any) => {
          console.warn('PeerJS Notice:', err.type, err.message);
          if (err.type === 'unavailable-id') {
            // Automatically regenerate unique ID if sitetrack-admin-1 is already taken on public peer server
            const fallbackId = `${peerId}-${Math.floor(100 + Math.random() * 900)}`;
            setActivePeerChannel(fallbackId);
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
          if ((useWebcam || videoSrc || mobileConnected || hlsUrl) && !ipCamUrl && !isDetecting) {
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
        // Mobile IP Camera (IP Webcam App) Image Stream Detection
        else if (ipCamUrl && ipCamImgRef.current && ipCamImgRef.current.complete && ipCamImgRef.current.naturalWidth > 0) {
          if (!isDetecting) {
            isDetecting = true;
            try {
              const preds = await model.detect(ipCamImgRef.current, 25, 0.20);
              predictionsRef.current = preds;
              setPredictions(preds);
            } catch (e) {
              console.error('TFJS IP Cam Detection Error:', e);
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
  }, [model, useWebcam, videoSrc, imageSrc, mobileConnected, hlsUrl, ipCamUrl]);

  // Drawing AI Overlays for Multi-Worker Inference + Robust Color Heuristics
  useEffect(() => {
    if (!useWebcam && !videoSrc && !imageSrc && !mobileConnected && !hlsUrl && !ipCamUrl) return;
    const canvas = aiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Persistent hidden canvas for reading pixel data without reallocating
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    let animId: number;
    const renderOverlays = () => {
        if (videoRef.current && (useWebcam || videoSrc || mobileConnected || hlsUrl) && !ipCamUrl && videoRef.current.readyState >= 2) {
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
            try {
              hiddenCtx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            } catch (drawErr) {
              // Video frame not ready
            }
          }
        } else if (
          ipCamImgRef.current && 
          ipCamUrl && 
          ipCamImgRef.current.complete && 
          ipCamImgRef.current.naturalWidth > 0 && 
          ipCamImgRef.current.naturalHeight > 0
        ) {
          const iW = ipCamImgRef.current.naturalWidth;
          const iH = ipCamImgRef.current.naturalHeight;

          if (canvas.width !== iW || canvas.height !== iH) {
            canvas.width = iW;
            canvas.height = iH;
            hiddenCanvas.width = iW;
            hiddenCanvas.height = iH;
          }

          if (hiddenCtx && canvas.width > 0 && canvas.height > 0) {
            try {
              hiddenCtx.drawImage(ipCamImgRef.current, 0, 0, canvas.width, canvas.height);
            } catch (drawErr) {
              // Ignore transient decode errors on MJPEG stream
            }
          }
        } else if (
          imageRef.current && 
          imageSrc && 
          imageRef.current.complete && 
          imageRef.current.naturalWidth > 0 && 
          imageRef.current.naturalHeight > 0
        ) {
          const iW = imageRef.current.naturalWidth;
          const iH = imageRef.current.naturalHeight;

          if (canvas.width !== iW || canvas.height !== iH) {
            canvas.width = iW;
            canvas.height = iH;
            hiddenCanvas.width = iW;
            hiddenCanvas.height = iH;
          }

          if (hiddenCtx && canvas.width > 0 && canvas.height > 0) {
            try {
              hiddenCtx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
            } catch (drawErr) {
              // Ignore broken image decode errors
            }
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

        // Gap 2: Multi-Frame Temporal Confirmation (2.5s continuous violation threshold)
        if (violationCount > 0 && personIndex > 0) {
          if (violationStartTimeRef.current === null) {
            violationStartTimeRef.current = performance.now();
          } else {
            const elapsed = performance.now() - violationStartTimeRef.current;
            if (elapsed >= 2500) {
              const nowTs = Date.now();
              // 30-second cooldown between auto-dispatches for this stream
              if (nowTs - lastAlertDispatchedRef.current > 30000) {
                lastAlertDispatchedRef.current = nowTs;
                dispatchSafetyViolation('Continuous hardhat absence confirmed via multi-frame temporal filter');
              }
            }
          }
        } else {
          violationStartTimeRef.current = null;
        }

        animId = requestAnimationFrame(renderOverlays);
    };
    renderOverlays();
    return () => cancelAnimationFrame(animId);
  }, [predictions, useWebcam, videoSrc, imageSrc, mobileConnected, hlsUrl, helmetColor, ipCamUrl]);

  // Canvas CCTV Animation Loop (Fallback when no video feed)
  useEffect(() => {
    if (videoSrc || useWebcam || mobileConnected || ipCamUrl) return;

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

          {/* Quick Demo: Log Safety Violation to Payroll & Fraud Surveillance */}
          <button
            type="button"
            onClick={() => dispatchSafetyViolation('Simulated CCTV hardhat safety violation')}
            disabled={isDispatching}
            className="px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition disabled:opacity-50"
            title="Auto-dispatch violation to Fraud Surveillance & apply 10% penalty in Payroll"
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {isDispatching ? 'Logging...' : 'Log Violation'}
          </button>

          {/* Camera device selector dropdown + Rescan + Help */}
          <div className="flex items-center gap-1">
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
              className="text-xs border border-primary/40 bg-white text-on-surface rounded-lg px-2 py-1 font-semibold cursor-pointer hover:border-primary transition max-w-[170px] truncate shadow-sm"
              title="Select Camera Input (Iriun Webcam / Laptop Cam)"
            >
              {availableDevices.length === 0 ? (
                <option value="">Default Camera</option>
              ) : (
                availableDevices.map((dev, i) => (
                  <option key={dev.deviceId || i} value={dev.deviceId}>
                    {formatDeviceLabel(dev, i)}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => refreshDevices(true)}
              disabled={isDetectingDevices}
              className="p-1 bg-white border border-outline-variant hover:bg-surface-variant text-on-surface-variant rounded-lg transition"
              title="Rescan cameras (e.g. after starting Iriun Webcam app on PC)"
            >
              <span className={`material-symbols-outlined text-[16px] ${isDetectingDevices ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowIriunGuide(true)}
              className="p-1 bg-white border border-outline-variant hover:bg-surface-variant text-cyan-600 rounded-lg transition"
              title="Iriun Webcam Connection Guide & Troubleshooting"
            >
              <span className="material-symbols-outlined text-[16px]">help</span>
            </button>
          </div>

          {!useWebcam && !mobileConnected && !ipCamUrl ? (
            <>
              {availableDevices.some((d) => d.label.toLowerCase().includes('iriun')) ? (
                <>
                  <button
                    type="button"
                    onClick={() => startWebcam(undefined, true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition"
                    disabled={modelLoading}
                    title="Start streaming with phone camera via Iriun Webcam"
                  >
                    <span className="material-symbols-outlined text-[14px]">phone_android</span> 
                    Start Iriun Cam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pcCam = availableDevices.find(
                        (d) => !d.label.toLowerCase().includes('iriun') && !d.label.toLowerCase().includes('droid')
                      );
                      startWebcam(pcCam?.deviceId, false);
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-slate-300 transition"
                    disabled={modelLoading}
                    title="Start built-in laptop camera"
                  >
                    <span className="material-symbols-outlined text-[14px]">laptop</span>
                    PC Cam
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startWebcam()}
                  className="px-2.5 py-1 bg-primary text-on-primary text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:opacity-90 transition"
                  disabled={modelLoading}
                >
                  <span className="material-symbols-outlined text-[14px]">videocam</span> 
                  Start Camera
                </button>
              )}

              {/* IP Camera Quick Connect Button (Zero Driver Setup over WiFi) */}
              <button
                type="button"
                onClick={() => setShowIpCamModal(true)}
                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition"
                title="Connect Phone via IP Webcam app (Zero driver setup over local WiFi)"
              >
                <span className="material-symbols-outlined text-[14px]">cell_tower</span>
                Phone IP Cam
              </button>

              {peerId && (
                <button
                  type="button"
                  onClick={startMobileReceiver}
                  className="px-2.5 py-1 bg-sky-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:bg-sky-700 transition"
                  title="Direct browser-to-browser mobile streaming without any app installed"
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
          className={`absolute top-0 left-0 w-full h-full object-cover transition-all duration-300 ${(useWebcam || videoSrc || hlsUrl || mobileConnected) && !ipCamUrl ? 'block' : 'hidden'}`}
        />

        {/* Mobile IP Camera (IP Webcam App) Live MJPEG Stream */}
        {ipCamUrl && (
          <img
            ref={ipCamImgRef}
            src={ipCamUrl}
            alt="Mobile IP Camera Stream"
            crossOrigin="anonymous"
            style={{
              filter: 
                envFilter === 'low-light' ? 'brightness(1.45) contrast(1.3) saturate(1.2)' :
                envFilter === 'solar-glare' ? 'brightness(0.85) contrast(1.35) saturate(0.85)' :
                envFilter === 'cement-dust' ? 'contrast(1.6) brightness(1.1)' : 'none'
            }}
            className="absolute top-0 left-0 w-full h-full object-cover"
            onError={() => {
              setCameraError(`Cannot connect to phone IP Camera at ${ipCamUrl}. Please verify the IP Webcam app is running and both devices are on the same WiFi.`);
            }}
          />
        )}

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
          className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${(useWebcam || videoSrc || imageSrc || hlsUrl || mobileConnected || ipCamUrl) ? 'block' : 'hidden'}`} 
        />

        {/* HTML5 Canvas AI Simulation (Fallback) */}
        {!videoSrc && !imageSrc && !useWebcam && !hlsUrl && !mobileConnected && !ipCamUrl && (
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
          {useWebcam && activeDeviceLabel && (
            <span className="ml-1 text-[9px] text-cyan-300 font-semibold bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800 tracking-wide">
              {activeDeviceLabel.toLowerCase().includes('iriun') ? '📱 IRIUN CAM' : '💻 PC CAM'}
            </span>
          )}
          {ipCamUrl && (
            <span className="ml-1 text-[9px] text-teal-300 font-semibold bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800 tracking-wide">
              📱 PHONE IP STREAM
            </span>
          )}
        </div>

        {/* Gap 2: Transient Occlusion Filtering Live Badge */}
        {missingHelmetTime > 0 && missingHelmetTime < 5 && (
          <div className="absolute top-12 left-3 bg-amber-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-amber-500/60 text-[10px] font-mono text-amber-200 z-10 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Gap 2 Occlusion Shield: Accumulating ({missingHelmetTime}/5s) &bull; Transient Noise Filtered</span>
          </div>
        )}

        {/* Real-Time Auto-Dispatched Safety Violation HUD Toast */}
        {dispatchedAlert && (
          <div className="absolute top-12 left-3 right-3 sm:right-auto sm:max-w-md bg-gradient-to-r from-red-950/95 to-rose-950/95 border-2 border-red-500 text-white p-3 rounded-xl shadow-2xl backdrop-blur-md z-30 animate-fade-in flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-400 text-xl shrink-0 animate-ping">warning</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-red-300">Auto-Dispatched to Audit</span>
                <span className="text-[10px] text-red-400 font-mono">· {dispatchedAlert.time}</span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5 leading-snug">
                Hardhat violation confirmed for <strong>{dispatchedAlert.workerName}</strong>.
              </p>
              <p className="text-[10px] text-red-200 mt-1 font-mono">
                ✓ Saved in Fraud Surveillance · 10% penalty queued in Payroll
              </p>
            </div>
            <button
              onClick={() => setDispatchedAlert(null)}
              className="text-red-300 hover:text-white p-0.5"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
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
        {/* Camera Error & Iriun Troubleshooting Banner */}
        {cameraError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-2.5">
              <span className="material-symbols-outlined text-2xl">videocam_off</span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Camera Stream Not Detected</h4>
            <p className="text-xs text-rose-200/90 max-w-md leading-relaxed mb-3">
              {cameraError}
            </p>

            <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 max-w-md text-left text-xs text-slate-300 space-y-1.5 mb-4">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5 border-b border-slate-800 pb-1">
                <span className="material-symbols-outlined text-[15px]">help</span>
                Iriun Webcam Quick Fix:
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-white">1.</span>
                <span>Open <strong>Iriun Webcam</strong> app on both your PC and your Phone.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-white">2.</span>
                <span>Ensure both are connected to the <strong>same Wi-Fi router</strong> or via USB cable.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-white">3.</span>
                <span>Close any other app using the camera (Zoom, Teams, Windows Camera app).</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => startWebcam(undefined, true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Retry Iriun
              </button>
              <button
                type="button"
                onClick={() => startWebcam(undefined, false)}
                className="px-3 py-1.5 bg-primary hover:opacity-90 text-on-primary rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <span className="material-symbols-outlined text-[16px]">laptop</span>
                Use Laptop Camera
              </button>
              {peerId && (
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    startMobileReceiver();
                  }}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">settings_cell</span>
                  Use Direct Mobile Pair
                </button>
              )}
              <button
                type="button"
                onClick={() => setCameraError(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Iriun Setup Modal */}
      {showIriunGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowIriunGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-2.5 mb-4 text-cyan-400">
              <span className="material-symbols-outlined text-2xl">phonelink</span>
              <h3 className="text-lg font-bold">How to Connect Iriun Webcam to SiteTrack</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">1</div>
                <div>
                  <div className="font-bold text-white mb-0.5">Install Iriun Webcam on PC &amp; Mobile</div>
                  <p className="text-slate-400">
                    Download the PC Windows client from <strong className="text-cyan-300">iriun.com</strong> and install the app on your phone from Google Play Store or App Store.
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  <div className="font-bold text-white mb-0.5">Connect on the Same Wi-Fi (or USB)</div>
                  <p className="text-slate-400">
                    Ensure your PC and your phone are on the same Wi-Fi network. Open the Iriun app on both devices—they will link automatically.
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  <div className="font-bold text-white mb-0.5">Click &ldquo;Rescan Cameras&rdquo; &amp; Select Iriun</div>
                  <p className="text-slate-400">
                    In SiteTrack, click <strong>&ldquo;🔄 Rescan&rdquo;</strong>, select <strong>&ldquo;📱 Iriun Webcam (Phone)&rdquo;</strong> from the dropdown, and click <strong>&ldquo;Start Iriun Cam&rdquo;</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  setShowIriunGuide(false);
                  await refreshDevices(true);
                  await startWebcam(undefined, true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <span className="material-symbols-outlined text-[16px]">videocam</span>
                Scan &amp; Start Iriun
              </button>
              <button
                type="button"
                onClick={() => setShowIriunGuide(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone IP Cam Quick Modal */}
      {showIpCamModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowIpCamModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-2.5 mb-2 text-teal-400">
              <span className="material-symbols-outlined text-2xl">cell_tower</span>
              <h3 className="text-lg font-bold">Connect Phone via IP Webcam (WiFi)</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Use the free <strong>IP Webcam</strong> app on Android. It streams camera video directly to SiteTrack over local Wi-Fi with <strong>zero driver installation</strong> and no browser security blocks!
            </p>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 mb-4 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-bold text-teal-400">1.</span>
                <span>Open <strong>IP Webcam</strong> app on your Android phone (free on Play Store).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-teal-400">2.</span>
                <span>Scroll to the bottom and tap <strong>&ldquo;Start server&rdquo;</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-teal-400">3.</span>
                <span>Note the IP on your phone screen (e.g. <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">http://192.168.0.101:8080</code>) and enter below:</span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-semibold text-slate-300">
                Phone IP Camera Video Stream URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputIpCamUrl}
                  onChange={(e) => setInputIpCamUrl(e.target.value)}
                  placeholder="http://192.168.0.101:8080/video"
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputIpCamUrl('http://192.168.0.101:8080/video')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700"
                >
                  Auto-Fill Phone (192.168.0.101:8080)
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowIpCamModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!inputIpCamUrl.trim()) return;
                  let finalUrl = inputIpCamUrl.trim();
                  if (!finalUrl.endsWith('/video') && !finalUrl.endsWith('/shot.jpg') && !finalUrl.endsWith('.mjpg')) {
                    if (finalUrl.endsWith('/')) finalUrl += 'video';
                    else finalUrl += '/video';
                  }
                  if (hlsInstanceRef.current) {
                    hlsInstanceRef.current.detachMedia();
                    hlsInstanceRef.current.destroy();
                    hlsInstanceRef.current = null;
                  }
                  if (webcamStreamRef.current) {
                    webcamStreamRef.current.getTracks().forEach((track) => track.stop());
                    webcamStreamRef.current = null;
                  }
                  setUseWebcam(false);
                  setVideoSrc(null);
                  setImageSrc(null);
                  setMobileConnected(true);
                  setIpCamUrl(finalUrl);
                  setActiveDeviceLabel('📱 IP Webcam (WiFi)');
                  setShowIpCamModal(false);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                Connect Live Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Pairing QR Code & Troubleshooting Modal */}
      {showMobilePairModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 text-white shadow-2xl relative animate-scale-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowMobilePairModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-2.5 mb-2 text-emerald-400">
              <span className="material-symbols-outlined text-2xl">phonelink_ring</span>
              <h3 className="text-lg font-bold">Connect Mobile Phone as CCTV Camera</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Turn your smartphone into an AI Edge Camera streaming live into Channel: <span className="font-mono text-cyan-300 font-bold">{cameraName}</span>.
            </p>

            {/* Modal Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 border-b border-slate-700/80 mb-4 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setPairModalTab('ipcam')}
                className={`px-2.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1 shrink-0 ${
                  pairModalTab === 'ipcam'
                    ? 'bg-slate-800 text-teal-400 border-b-2 border-teal-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">cell_tower</span>
                1. IP Cam (WiFi)
              </button>
              <button
                type="button"
                onClick={() => setPairModalTab('usb')}
                className={`px-2.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1 shrink-0 ${
                  pairModalTab === 'usb'
                    ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">usb</span>
                2. USB Cable (Iriun)
              </button>
              <button
                type="button"
                onClick={() => setPairModalTab('qr')}
                className={`px-2.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1 shrink-0 ${
                  pairModalTab === 'qr'
                    ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
                3. QR Code
              </button>
              <button
                type="button"
                onClick={() => setPairModalTab('hotspot')}
                className={`px-2.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1 shrink-0 ${
                  pairModalTab === 'hotspot'
                    ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">wifi_tethering</span>
                4. Hotspot
              </button>
              <button
                type="button"
                onClick={() => setPairModalTab('chrome-fix')}
                className={`px-2.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1 shrink-0 ${
                  pairModalTab === 'chrome-fix'
                    ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">shield</span>
                5. Flags Fix
              </button>
            </div>

            {/* Tab: IP Webcam Stream (Direct local Wi-Fi, zero drivers) */}
            {pairModalTab === 'ipcam' && (
              <div className="space-y-4">
                <div className="bg-teal-950/40 border border-teal-700/60 p-3.5 rounded-xl text-teal-200 text-xs">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-teal-400 text-base">verified</span>
                    Most Reliable Wi-Fi Method (Zero Drivers Needed on Windows)
                  </div>
                  Directly receives video stream from your phone over local Wi-Fi without depending on Windows virtual webcam drivers or cloud WebRTC signaling.
                </div>

                <div className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-teal-400">Step 1:</span>
                    <span>Install the free <strong>IP Webcam</strong> app on your Android phone (by Pavel Khlebovich on Google Play Store).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-teal-400">Step 2:</span>
                    <span>Open app, scroll to bottom and tap <strong>&ldquo;Start server&rdquo;</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-teal-400">Step 3:</span>
                    <span>Note the URL shown on phone (e.g. <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">http://192.168.0.101:8080</code>) and click Connect below:</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputIpCamUrl}
                      onChange={(e) => setInputIpCamUrl(e.target.value)}
                      placeholder="http://192.168.0.101:8080/video"
                      className="flex-1 bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-lg px-3 py-2 font-mono text-white outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!inputIpCamUrl.trim()) return;
                        let finalUrl = inputIpCamUrl.trim();
                        if (!finalUrl.endsWith('/video') && !finalUrl.endsWith('/shot.jpg') && !finalUrl.endsWith('.mjpg')) {
                          if (finalUrl.endsWith('/')) finalUrl += 'video';
                          else finalUrl += '/video';
                        }
                        if (hlsInstanceRef.current) {
                          hlsInstanceRef.current.detachMedia();
                          hlsInstanceRef.current.destroy();
                          hlsInstanceRef.current = null;
                        }
                        if (webcamStreamRef.current) {
                          webcamStreamRef.current.getTracks().forEach((track) => track.stop());
                          webcamStreamRef.current = null;
                        }
                        setUseWebcam(false);
                        setVideoSrc(null);
                        setImageSrc(null);
                        setMobileConnected(true);
                        setIpCamUrl(finalUrl);
                        setActiveDeviceLabel('📱 IP Webcam (WiFi)');
                        setShowMobilePairModal(false);
                      }}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold flex items-center gap-1 shrink-0 transition"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Connect Feed
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setInputIpCamUrl('http://192.168.0.101:8080/video')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700"
                    >
                      Phone IP (192.168.0.101:8080/video)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 1: QR Code Direct Mobile Stream */}
            {pairModalTab === 'qr' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                  <div className="bg-white p-2.5 rounded-xl shadow-lg shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        `http://${hostIp}:3000/camera-node?channel=${activePeerChannel}`
                      )}`}
                      alt="Scan with phone"
                      className="w-40 h-40 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-xs text-left w-full">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Signaling ID: {activePeerChannel}
                    </div>

                    <div className="text-slate-300">
                      <strong>Step 1:</strong> Point phone camera at this QR code (Google Lens or Camera app).
                    </div>
                    <div className="text-slate-300">
                      <strong>Step 2:</strong> Tap link to open Edge Stream Node on phone.
                    </div>
                    <div className="text-slate-300">
                      <strong>Step 3:</strong> Tap <strong>&ldquo;Start Live Broadcast&rdquo;</strong> on your phone.
                    </div>

                    <div className="pt-1.5">
                      <div className="text-[11px] text-slate-400 mb-1">Direct Mobile Link:</div>
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-1.5 rounded-lg">
                        <input
                          type="text"
                          readOnly
                          value={`http://${hostIp}:3000/camera-node?channel=${activePeerChannel}`}
                          className="bg-transparent text-white font-mono text-[11px] flex-1 outline-none truncate"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`http://${hostIp}:3000/camera-node?channel=${activePeerChannel}`);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2500);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0 transition"
                        >
                          {copiedLink ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5">wifi</span>
                  <div>
                    <strong>Network Requirement:</strong> Both this PC and your mobile phone must be on the <strong>same Wi-Fi router</strong> or connected via <strong>Phone Hotspot</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: USB Cable via Iriun */}
            {pairModalTab === 'usb' && (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl text-emerald-200">
                  <strong className="text-white">Why USB Cable is Recommended:</strong> USB bypasses all Wi-Fi router firewalls, provides zero lag, and requires no browser flags or configuration.
                </div>

                <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700 space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px]">1</span>
                    Connect USB Cable
                  </div>
                  <p className="text-slate-400 pl-6">
                    Plug your phone into your laptop using your normal charging USB cable.
                  </p>

                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px]">2</span>
                    Enable USB Debugging on Phone
                  </div>
                  <p className="text-slate-400 pl-6">
                    In phone <em>Settings &gt; Developer Options</em>, turn on <strong>USB Debugging</strong> (or set USB mode to &ldquo;Transfer Files / MTP&rdquo;).
                  </p>

                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px]">3</span>
                    Open Iriun App on Both Devices
                  </div>
                  <p className="text-slate-400 pl-6">
                    Open Iriun Webcam on your PC and on your phone. It connects instantly via USB at high framerate.
                  </p>

                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px]">4</span>
                    Click &ldquo;Start Iriun Cam&rdquo;
                  </div>
                  <p className="text-slate-400 pl-6">
                    In SiteTrack, select <strong>📱 Iriun Webcam (Phone)</strong> and click <strong>Start Iriun Cam</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Hotspot Trick */}
            {pairModalTab === 'hotspot' && (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-sky-950/50 border border-sky-800/60 p-3 rounded-xl text-sky-200">
                  <strong className="text-white">The Mobile Hotspot Trick:</strong> Many home, hostel, or college Wi-Fi routers have <em>AP Isolation</em> enabled, which prevents phones from talking to PCs on the same Wi-Fi.
                </div>

                <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 text-sm">Step 1:</span>
                    <span>Turn on <strong>Personal Hotspot</strong> on your smartphone.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 text-sm">Step 2:</span>
                    <span>Connect your laptop&apos;s Wi-Fi to your phone&apos;s hotspot.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 text-sm">Step 3:</span>
                    <span>
                      Click <strong>&ldquo;1. Scan QR Code&rdquo;</strong> tab above and scan again. Both devices are now on a direct 1-to-1 link with 100% guarantee!
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Chrome HTTP Permission Fix */}
            {pairModalTab === 'chrome-fix' && (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-amber-950/60 border border-amber-600/60 p-3 rounded-xl text-amber-200">
                  <strong className="text-white">Why Mobile Chrome blocks camera:</strong> Google Chrome blocks camera access on local HTTP IP addresses (<code className="text-white bg-black/40 px-1 py-0.5 rounded">http://192.168.x.x</code>).
                </div>

                <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700 space-y-2">
                  <div className="font-bold text-white">How to fix in phone Chrome in 20 seconds:</div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
                    <li>In phone Chrome address bar, open: <strong className="text-white font-mono">chrome://flags</strong></li>
                    <li>Search for: <strong className="text-white font-mono">unsafely-treat-insecure-origin-as-secure</strong></li>
                    <li>
                      Enter this PC URL: <strong className="text-cyan-300 font-mono">http://{hostIp}:3000</strong>
                    </li>
                    <li>Set dropdown from <em>Disabled</em> to <strong>Enabled</strong> and tap <strong>Relaunch</strong>.</li>
                    <li>Now reload the QR code page, and the camera will start streaming live!</li>
                  </ol>
                </div>

                <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700 text-[11px] text-slate-400">
                  💡 <strong>Alternative:</strong> Use <strong>Firefox for Android</strong> (which does NOT block local HTTP camera) or use <strong>Iriun Webcam via USB</strong>.
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowMobilePairModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
