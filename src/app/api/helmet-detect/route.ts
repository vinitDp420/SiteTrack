import { NextResponse } from 'next/server';

const HF_MODEL = 'keremberke/yolov8m-hard-hat-detection';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    const token = process.env.HF_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'HF_API_TOKEN not configured. Set it in .env to enable real helmet detection.' },
        { status: 503 }
      );
    }

    // Convert base64 to binary
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const res = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Hugging Face API error: ${res.status} ${errText}` },
        { status: res.status }
      );
    }

    const detections = await res.json();

    // Parse YOLOv8 hard-hat-detection output
    // Labels: "Helmet" (with helmet) and "NO-Hardhat" (without helmet) or similar
    let hasHelmet = false;
    let hasPerson = false;
    let confidence = 0;
    const boxes: { label: string; score: number; box: number[] }[] = [];

    if (Array.isArray(detections)) {
      for (const det of detections) {
        const label = (det.label || '').toLowerCase();
        const score = det.score || 0;
        boxes.push({ label: det.label, score, box: det.box || [] });

        if (label.includes('helmet') || label.includes('hardhat') || label.includes('hard-hat')) {
          if (!label.includes('no-') && !label.includes('without')) {
            hasHelmet = true;
            confidence = Math.max(confidence, score);
          }
        }
        if (label.includes('person') || label.includes('head')) {
          hasPerson = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      hasHelmet,
      hasPerson,
      confidence: Math.round(confidence * 100),
      detections: boxes,
      model: HF_MODEL,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
