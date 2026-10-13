import cv2
import numpy as np
import time

CLASSES = [
    'Fall-Detected', 'Gloves', 'Goggles', 'Hardhat', 'Ladder', 'Mask',
    'NO-Gloves', 'NO-Goggles', 'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest',
    'Person', 'Safety Cone', 'Safety Vest'
]

COLORS = {
    'Hardhat': (0, 220, 0),         # Bright Green
    'NO-Hardhat': (0, 0, 240),      # Bright Red
    'Safety Vest': (0, 165, 255),   # Orange
    'NO-Safety Vest': (0, 0, 200),  # Red
    'Person': (255, 180, 0),        # Cyan/Blue
    'Goggles': (255, 255, 0),
    'Mask': (200, 200, 0)
}

def run_ppe_detector(camera_index=0, conf_thresh=0.30):
    print(f"Loading YOLO PPE ONNX Neural Network...")
    net = cv2.dnn.readNetFromONNX('models/yolo_ppe.onnx')
    
    # Try enabling CUDA if available, else CPU
    try:
        net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
        net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
    except:
        net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    print(f"Connecting to Camera Index {camera_index} (Iriun / Webcam)...")
    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("Camera index 0 failed, trying index 1...")
        cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)
        
    if not cap.isOpened():
        print("Error: Could not open camera. Please make sure Iriun Webcam is connected.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("YOLO PPE Live Detector Active! Press 'q' in the window to quit.")
    prev_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        h_orig, w_orig = frame.shape[:2]

        # Preprocess input blob for YOLO 640x640
        blob = cv2.dnn.blobFromImage(frame, 1/255.0, (640, 640), swapRB=True, crop=False)
        net.setInput(blob)
        output = net.forward()[0] # Shape: (18, 8400)

        boxes = []
        confidences = []
        class_ids = []

        # Parse detections
        for i in range(output.shape[1]):
            scores = output[4:, i]
            class_id = int(np.argmax(scores))
            conf = float(scores[class_id])
            if conf >= conf_thresh:
                cx, cy, w, h = output[0:4, i]
                x1 = int((cx - w/2) * (w_orig / 640.0))
                y1 = int((cy - h/2) * (h_orig / 640.0))
                bw = int(w * (w_orig / 640.0))
                bh = int(h * (h_orig / 640.0))
                boxes.append([x1, y1, bw, bh])
                confidences.append(conf)
                class_ids.append(class_id)

        # Non-Maximum Suppression (NMS) removes duplicate overlapping boxes
        indices = cv2.dnn.NMSBoxes(boxes, confidences, conf_thresh, 0.45)

        hardhat_count = 0
        no_hardhat_count = 0

        if len(indices) > 0:
            for idx in indices:
                i = idx if isinstance(idx, int) else idx[0]
                bx, by, bw, bh = boxes[i]
                cid = class_ids[i]
                label = CLASSES[cid] if cid < len(CLASSES) else 'Object'
                conf = confidences[i]

                if label == 'Hardhat':
                    hardhat_count += 1
                elif label == 'NO-Hardhat':
                    no_hardhat_count += 1

                color = COLORS.get(label, (180, 180, 180))

                # Draw bounding box
                cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), color, 3)

                # Draw label badge
                badge_text = f"{label} {int(conf * 100)}%"
                (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                badge_y = max(by, th + 10)
                cv2.rectangle(frame, (bx, badge_y - th - 8), (bx + tw + 10, badge_y + 4), color, -1)
                cv2.putText(frame, badge_text, (bx + 5, badge_y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # FPS calculation
        curr_time = time.time()
        fps = 1.0 / max(0.001, curr_time - prev_time)
        prev_time = curr_time

        # Top HUD Banner
        hud_bg = (20, 20, 20)
        cv2.rectangle(frame, (0, 0), (w_orig, 45), hud_bg, -1)
        hud_text = f"SiteTrack AI YOLO PPE | FPS: {fps:.1f} | Hardhats: {hardhat_count} | Violations: {no_hardhat_count}"
        cv2.putText(frame, hud_text, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 200), 2)

        cv2.imshow("SiteTrack - YOLO PPE Real-Time Vision Engine", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_ppe_detector(camera_index=0)
