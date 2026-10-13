'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export default function LiveCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const requestRef = useRef<number | null>(null);
  
  // Initialize TensorFlow and Model
  useEffect(() => {
    const initModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setLoading(false);
      } catch (error) {
        console.error("Error loading model:", error);
      }
    };
    initModel();
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
  }, []);

  // Start Camera
  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prefer back camera
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera access denied or not available. Make sure you have granted permissions.");
      }
    } else {
      alert("getUserMedia API is not supported in this browser.");
    }
  };
  
  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      
      // Clear canvas
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Run Detection Loop
  const detectFrame = async () => {
    if (videoRef.current && canvasRef.current && model && isStreaming) {
      // Check if video is ready
      if (videoRef.current.readyState === 4) {
        // Match canvas dimensions to video
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        // Detect objects
        const predictions = await model.detect(videoRef.current);
        
        // Draw predictions
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          predictions.forEach(prediction => {
            // Box coordinates
            const [x, y, width, height] = prediction.bbox;
            
            // Draw box
            ctx.strokeStyle = '#06b6d4'; // cyan-500
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label background
            ctx.fillStyle = '#06b6d4';
            const text = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y, textWidth + 10, 25);
            
            // Draw label text
            ctx.fillStyle = '#000000';
            ctx.font = '16px sans-serif';
            ctx.fillText(text, x + 5, y + 18);
          });
        }
      }
      requestRef.current = requestAnimationFrame(detectFrame);
    }
  };
  
  // Start detection loop when streaming and model are ready
  useEffect(() => {
    if (isStreaming && model) {
      detectFrame();
    }
  }, [isStreaming, model]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 lg:p-8">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl border border-[#334155]">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-[#334155] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#1e293b]">
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-cyan-400 text-3xl">linked_camera</span>
            Mobile Live Detection
          </h1>
          <div className="flex gap-3 w-full sm:w-auto">
            {!isStreaming ? (
              <button 
                onClick={startCamera}
                disabled={loading}
                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/50"
              >
                <span className="material-symbols-outlined">play_circle</span>
                {loading ? 'Loading AI...' : 'Start Camera'}
              </button>
            ) : (
              <button 
                onClick={stopCamera}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/50"
              >
                <span className="material-symbols-outlined">stop_circle</span>
                Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Video Area */}
        <div className="relative bg-black aspect-[4/3] md:aspect-video flex items-center justify-center w-full">
          {loading && !isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-400 z-10 bg-black/80">
              <span className="material-symbols-outlined animate-spin text-5xl mb-4">progress_activity</span>
              <p className="text-lg font-medium animate-pulse">Initializing TensorFlow Model...</p>
            </div>
          )}
          
          {!isStreaming && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#64748b] z-10">
              <span className="material-symbols-outlined text-7xl mb-4 opacity-50">videocam_off</span>
              <p className="text-lg">Camera is currently offline</p>
              <p className="text-sm mt-2">Click "Start Camera" to begin detection</p>
            </div>
          )}

          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          {/* Canvas for drawing bounding boxes */}
          <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
          />
        </div>
        
        {/* Footer info */}
        <div className="p-4 md:p-5 bg-[#0f172a] text-[#94a3b8] flex flex-col sm:flex-row justify-between items-center text-sm gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">memory</span>
            <p>Powered by TensorFlow.js (COCO-SSD)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">smartphone</span>
            <p>Optimized for Mobile Browsers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
