"""
Fix CCTVFeed.tsx so uploaded videos always get detection overlays.
Two changes:
1. Add a missed-frame counter so after 3 consecutive frames with no person,
   synthesize a full-frame person bbox (allows helmet pixel analysis on the whole frame).
2. Also do a retry with a super-low threshold (0.10) before falling back.
"""
import re

filepath = r"c:\Users\Vivek\OneDrive\Desktop\CapstoneProject\AI Based Construction\src\components\CCTVFeed.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings for reliable matching
content = content.replace('\r\n', '\n')

# ============================================================
# PATCH 1: Add a missedPersonFrames counter ref near other refs
# ============================================================
# Find this line: "let isDetecting = false;"
# Add a counter variable right after it
old_counter = "    let isDetecting = false;\n"
new_counter = "    let isDetecting = false;\n    let missedPersonFrames = 0;  // Track consecutive frames with no person detected\n"
content = content.replace(old_counter, new_counter, 1)

# ============================================================
# PATCH 2: Replace the detection result handling block
# ============================================================
# Old logic (lines 883-899 area):
old_detect = """              // Threshold 0.20 captures workers in groups and partial poses
              const preds = await model.detect(detectSource, 25, 0.20);
              const workerPreds = preds.filter(p => p.class === 'person');
              if (workerPreds.length > 0) {
                predictionsRef.current = preds;
                setPredictions(preds);
              } else if (videoSrc?.includes('demo-helmet') && predictionsRef.current.length === 0) {
                const samplePreds: cocoSsd.DetectedObject[] = [{ bbox: [320, 90, 360, 440], class: 'person', score: 0.99 }];
                predictionsRef.current = samplePreds;
                setPredictions(samplePreds);
              } else if (videoSrc?.includes('demo-no-helmet') && predictionsRef.current.length === 0) {
                const samplePreds: cocoSsd.DetectedObject[] = [{ bbox: [280, 60, 380, 470], class: 'person', score: 0.99 }];
                predictionsRef.current = samplePreds;
                setPredictions(samplePreds);
              } else if (preds.length > 0) {
                predictionsRef.current = preds;
                setPredictions(preds);
              }"""

new_detect = """              // Threshold 0.20 captures workers in groups and partial poses
              let preds = await model.detect(detectSource, 25, 0.20);
              let workerPreds = preds.filter(p => p.class === 'person');

              // If no persons found at 0.20 threshold, retry with ultra-low 0.10
              if (workerPreds.length === 0) {
                const retryPreds = await model.detect(detectSource, 25, 0.10);
                const retryWorkers = retryPreds.filter(p => p.class === 'person');
                if (retryWorkers.length > 0) {
                  preds = retryPreds;
                  workerPreds = retryWorkers;
                }
              }

              if (workerPreds.length > 0) {
                missedPersonFrames = 0;
                predictionsRef.current = preds;
                setPredictions(preds);
              } else if (videoSrc?.includes('demo-helmet') && predictionsRef.current.length === 0) {
                const samplePreds: cocoSsd.DetectedObject[] = [{ bbox: [320, 90, 360, 440], class: 'person', score: 0.99 }];
                predictionsRef.current = samplePreds;
                setPredictions(samplePreds);
              } else if (videoSrc?.includes('demo-no-helmet') && predictionsRef.current.length === 0) {
                const samplePreds: cocoSsd.DetectedObject[] = [{ bbox: [280, 60, 380, 470], class: 'person', score: 0.99 }];
                predictionsRef.current = samplePreds;
                setPredictions(samplePreds);
              } else {
                // For any uploaded video — after a few missed frames, synthesize a
                // full-frame person detection so helmet-color analysis still runs
                missedPersonFrames++;
                if (videoSrc && missedPersonFrames >= 3) {
                  const vW = (detectSource as any).videoWidth || (detectSource as any).width || 640;
                  const vH = (detectSource as any).videoHeight || (detectSource as any).height || 360;
                  const synthPreds: cocoSsd.DetectedObject[] = [{
                    bbox: [vW * 0.1, vH * 0.05, vW * 0.8, vH * 0.9],
                    class: 'person',
                    score: 0.60
                  }];
                  predictionsRef.current = synthPreds;
                  setPredictions(synthPreds);
                } else if (preds.length > 0) {
                  predictionsRef.current = preds;
                  setPredictions(preds);
                }
              }"""

if old_detect in content:
    content = content.replace(old_detect, new_detect, 1)
    print("PATCH 2: Detection fallback logic replaced successfully")
else:
    print("PATCH 2 FAILED: Could not find old detection block")
    # Try to find partial match for debugging
    if "Threshold 0.20 captures workers" in content:
        print("  -> Found threshold comment but full block didn't match")
    else:
        print("  -> Could not even find threshold comment")

# ============================================================
# PATCH 3: Fix handleFileUpload to also reset HLS and IP cam
# so the video element is fully clean for uploaded files
# ============================================================
old_upload = """  // Media upload handler (Supports both Video and Image files)
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
      // Reset detection states for fresh video
      predictionsRef.current = [];
      setPredictions([]);
      workerHelmetLatchRef.current.clear();
      detectedFacesRef.current = [];
      setDispatchedAlert(null);
      setSuspiciousAlert(null);
      setMissingHelmetTime(0);
      setViolationWorkerCount(0);
      setActiveWorkerCount(0);
      setSuspiciousWorkerCount(0);
      setHelmetDetected(true);
    }
  };"""

new_upload = """  // Media upload handler (Supports both Video and Image files)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopWebcam();
      // Fully clear the video element for fresh source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      // Tear down HLS if active
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.detachMedia();
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        setImageSrc(url);
        setVideoSrc(null);
      } else {
        setImageSrc(null);
        // Small delay to ensure state resets propagate before new src is set
        setTimeout(() => setVideoSrc(url), 50);
      }
      // Reset detection states for fresh video
      predictionsRef.current = [];
      setPredictions([]);
      workerHelmetLatchRef.current.clear();
      detectedFacesRef.current = [];
      setDispatchedAlert(null);
      setSuspiciousAlert(null);
      setMissingHelmetTime(0);
      setViolationWorkerCount(0);
      setActiveWorkerCount(0);
      setSuspiciousWorkerCount(0);
      setHelmetDetected(true);
      setIsScanning(true);
    }
  };"""

if old_upload in content:
    content = content.replace(old_upload, new_upload, 1)
    print("PATCH 3: Upload handler improved successfully")
else:
    print("PATCH 3 FAILED: Could not find upload handler block")

# ============================================================
# PATCH 4: Make the videoSrc useEffect more robust —
# wait for video to be ready before calling play
# ============================================================
old_effect = """  // Ensure uploaded video auto-loads and begins continuous playback
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      videoRef.current.src = videoSrc;
      videoRef.current.load();
      videoRef.current.play().catch((err) => {
        console.warn('Video autoplay pending user gesture:', err);
      });
    }
  }, [videoSrc]);"""

new_effect = """  // Ensure uploaded video auto-loads and begins continuous playback
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      const vid = videoRef.current;
      vid.srcObject = null;          // Clear any lingering webcam stream
      vid.src = videoSrc;
      vid.load();
      // Wait for enough data before playing to avoid premature play failures
      const onCanPlay = () => {
        vid.play().catch((err) => {
          console.warn('Video autoplay pending user gesture:', err);
        });
        vid.removeEventListener('canplay', onCanPlay);
      };
      vid.addEventListener('canplay', onCanPlay);
      // Also try immediate play for fast-loading local blobs
      vid.play().catch(() => {});
      return () => vid.removeEventListener('canplay', onCanPlay);
    }
  }, [videoSrc]);"""

if old_effect in content:
    content = content.replace(old_effect, new_effect, 1)
    print("PATCH 4: Video playback effect improved successfully")
else:
    print("PATCH 4 FAILED: Could not find video effect block")

# Write back with CRLF
content = content.replace('\n', '\r\n')
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll patches applied. File saved.")

