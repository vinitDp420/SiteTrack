from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

prs = Presentation('C:/Users/Vivek/Downloads/Sample PPT for External Project Presentation.pptx')

# Clear existing slides
while len(prs.slides) > 0:
    rId = prs.slides._sldIdLst[0].rId
    prs.part.drop_rel(rId)
    del prs.slides._sldIdLst[0]

# Helper function to add title slide
def add_title_slide(title, subtitle, details):
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    for shape in slide.shapes:
        if shape.has_text_frame:
            tf = shape.text_frame
            if 'Title' in shape.name or shape.placeholder_format.idx == 0:
                p = tf.paragraphs[0]
                p.text = title
                for run in p.runs:
                    run.font.size = Pt(32)
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(0x0D, 0x1C, 0x32)
            elif shape.placeholder_format.idx == 1:
                p = tf.paragraphs[0]
                p.text = subtitle
                for run in p.runs:
                    run.font.size = Pt(18)
                    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    # Add details text box
    txBox = slide.shapes.add_textbox(Inches(1), Inches(4), Inches(8), Inches(2))
    tf = txBox.text_frame
    for line in details:
        p = tf.add_paragraph()
        p.text = line
        p.font.size = Pt(14)
        p.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

# Slide 1: Title
add_title_slide(
    "SiteTrack — AI-Powered Construction Workforce & Site Management Platform",
    "A Presentation on Capstone Project",
    [
        "By: Vivek",
        "Under the Guidance of: [Guide Name]",
        "Department of Computer Science",
        "SVKM's, NMIMS, MPSTME, Shirpur Campus",
        "2026-27",
    ]
)

# Helper function to add content slide
def add_content_slide(title, content_items, bullet=True):
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    for shape in slide.shapes:
        if shape.has_text_frame and shape.placeholder_format.idx == 0:
            p = shape.text_frame.paragraphs[0]
            p.text = title
            for run in p.runs:
                run.font.size = Pt(24)
                run.font.bold = True
                run.font.color.rgb = RGBColor(0x0D, 0x1C, 0x32)
        elif shape.has_text_frame and shape.placeholder_format.idx == 1:
            tf = shape.text_frame
            tf.clear()
            for i, item in enumerate(content_items):
                if i == 0:
                    p = tf.paragraphs[0]
                else:
                    p = tf.add_paragraph()
                if isinstance(item, tuple):
                    p.text = item[0]
                    p.level = 1
                else:
                    p.text = item
                    p.level = 0
                p.font.size = Pt(16)
                for run in p.runs:
                    run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    return slide

# Slide 2: Outline
add_content_slide("Outline", [
    "Objective of Project",
    "Literature Survey",
    "Problem Statement",
    "Proposed Solution",
    "System Architecture",
    "Result Analysis / Implementation",
    "Conclusions",
    "References",
])

# Slide 3: Objective
add_content_slide("Objective of Project", [
    "Primary Objective",
    ("To develop SiteTrack — an AI-powered construction workforce management platform that replaces manual site operations with biometric attendance, real-time PPE safety monitoring, and automated wage payouts.",),
    "Key Objectives",
    ("Hands-Free Worker Attendance — Face-scan kiosk, 3-sec deliberate hold, offline queue",),
    ("Real-Time PPE Safety Monitoring — YOLOv8 CCTV analysis, instant violation alerts via SSE",),
    ("Automated Daily Wage Payouts — Razorpay API, 10% Phi_compliance penalty per PPE violation",),
    ("Construction Project Management — Role-based portals, BOQ, procurement, inventory, task tracking",),
    ("Environmental Robustness (Gap 2) — 5-sec multi-frame temporal filtering + preprocessing",),
    ("Zero-Overhead Edge Deployment (Gap 3) — Browser WebGPU/WASM, only 0.25 KB telemetry",),
])

# Slide 4: Literature Survey
add_content_slide("Literature Survey", [
    "Existing Systems Reviewed",
    ("Face-API.js — browser-based face recognition for biometric attendance",),
    ("YOLOv8 / COCO-SSD — real-time object detection for PPE compliance",),
    ("TensorFlow.js — client-side ML inference without GPU servers",),
    ("Razorpay API — automated instant wage disbursement to worker bank accounts",),
    ("Next.js + Prisma + PostgreSQL — modern full-stack with type safety",),
    "Key Gap Identified",
    ("No existing system combines biometric attendance + PPE monitoring + automated payroll in one platform for construction sites",),
])

# Slide 5: Problem Statement
add_content_slide("Problem Statement", [
    "Construction sites face critical operational challenges:",
    ("Manual paper registers for attendance — error-prone, time-consuming, easily manipulated",),
    ("Password-based logins impractical for on-site workers (low literacy, no smartphones)",),
    ("PPE safety violations (no helmet/vest) go unnoticed until accidents occur",),
    ("Daily wage calculation is manual, delayed, and disputes are common",),
    ("No real-time visibility for supervisors on worker presence or site safety",),
    ("High cost of GPU-based AI surveillance systems",),
])

# Slide 6: Proposed Solution
add_content_slide("Proposed Solution — SiteTrack", [
    "An all-in-one AI platform for construction sites:",
    ("Hands-Free Face Scan Attendance — workers clock in/out by standing before kiosk camera",),
    ("CCTV AI Safety Monitoring — live video analyzed for PPE compliance (helmet, vest)",),
    ("Automated Daily Wage Payouts — shift hours auto-calculated, wages sent via Razorpay",),
    ("Project Management Dashboard — BOQ, procurement, inventory, tasks, daily reports",),
    ("Role-Based Access — Admin, Supervisor, Worker portals with tailored features",),
    ("Offline Support — IndexedDB queue stores attendance when internet is down",),
])

# Slide 7: System Architecture (with diagram)
add_content_slide("System Architecture", [
    "Three-Layer Architecture:",
    ("Client / Edge Layer — Site Virtual Kiosk (Face Auth), CCTV Camera Network, Admin Dashboard",),
    ("Backend Application Layer — Attendance API, YOLOv8 AI Engine (PPE Detection), Payroll API",),
    ("Data & External — PostgreSQL (Prisma ORM), Razorpay API (Payouts), Cloud Storage",),
    "Real-Time: Server-Sent Events (SSE) for live alert streaming",
    "Tech Stack: Next.js 16, React 19, TypeScript, Tailwind, TensorFlow.js, Face-API.js",
])

# Slide 8: Result Analysis / Implementation
add_content_slide("Result Analysis / Implementation", [
    "Features Implemented & Tested:",
    ("Biometric Face Attendance — 51 workers enrolled, 369 attendance records",),
    ("PPE Detection — 7 PPE violations logged with 10% wage penalty",),
    ("Automated Payouts — 25+ payments processed via Razorpay simulation",),
    ("Fraud Detection — ghost worker, buddy punching, geo-fence anomaly detection",),
    ("Project Management — 7 projects, 25 BOQ items, 16 material requests, 21 stock items",),
    "Test Results: 8/8 Jest tests pass, 39/39 capacity tests pass, 20/20 concurrent API calls",
    "API Documentation: Swagger UI at /api/docs",
])

# Slide 9: Conclusions
add_content_slide("Conclusions", [
    "SiteTrack successfully replaces manual construction site management with:",
    ("Contactless biometric attendance — no passwords, no paper registers",),
    ("Real-time AI safety monitoring — PPE violations caught instantly via CCTV",),
    ("Automated, on-time wage payouts — zero manual calculation errors",),
    ("Transparent project tracking — BOQ, procurement, inventory for all roles",),
    "Deployable without costly GPU infrastructure (browser-based edge AI)",
    "Future Scope: Mobile app, RFID hybrid, project delay prediction, government portal integration",
])

# Slide 10: References
add_content_slide("References", [
    ("Face-API.js — Browser-based face recognition library",),
    ("YOLOv8 — Ultralytics real-time object detection",),
    ("TensorFlow.js — Client-side machine learning framework",),
    ("Next.js 16 — React framework for full-stack applications",),
    ("Prisma — Type-safe database ORM for PostgreSQL",),
    ("Razorpay API — Automated payment disbursement platform",),
    ("NextAuth.js — Authentication and role-based access control",),
])

# Add architecture diagram image to System Architecture slide
from pptx.util import Inches
img_path = "C:/Users/Vivek/OneDrive/Desktop/CapstoneProject/AI Based Construction/detailed_architecture_ppt.png"
import os
if os.path.exists(img_path):
    slide = prs.slides[6]  # System Architecture slide (0-indexed)
    slide.shapes.add_picture(img_path, Inches(0.5), Inches(4.5), width=Inches(9), height=Inches(2.5))

prs.save('C:/Users/Vivek/Downloads/SiteTrack_Capstone_Presentation.pptx')
print("PPT created successfully!")
print(f"Total slides: {len(prs.slides)}")
