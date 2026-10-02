import base64
import urllib.request
import json

def generate_mermaid_image(mermaid_code, filename):
    state = {
        "code": mermaid_code,
        "mermaid": {"theme": "default"}
    }
    json_str = json.dumps(state)
    # Using base64 encoding supported by mermaid.ink
    b64_str = base64.urlsafe_b64encode(json_str.encode('utf-8')).decode('utf-8')
    url = f"https://mermaid.ink/img/{b64_str}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        with open(filename, 'wb') as f:
            f.write(response.read())

fig1_code = """graph TD
    A["AI-Based Construction Workforce Management"] 

    A --> B["Deep Learning for PPE Detection"]
    A --> C["Digital Identification Models"]
    A --> D["Decoupled System Architecture"]
    A --> E["Enterprise Cloud Integration"]

    B --> B1["Single-Stage Detectors (YOLOv8)"]
    B --> B2["Spatial Attention Modules"]
    B --> B3["Lightweight Backbones (GhostNet)"]

    C --> C1["Facial Biometric Recognition (Prone to Occlusion)"]
    C --> C2["Deterministic Virtual Kiosks (PIN/RFID/QR)"]
    
    D --> D1["Ingress Verification (Synchronous)"]
    D --> D2["Safety Audits (Asynchronous)"]

    E --> E1["Automated API Payroll"]
    E --> E2["Smart Contracts & Escrow"]
    
    style A fill:#4575b4,stroke:#313695,stroke-width:2px,color:#fff
    style B fill:#e0f3f8,stroke:#74add1,stroke-width:2px
    style C fill:#e0f3f8,stroke:#74add1,stroke-width:2px
    style D fill:#fee090,stroke:#fdae61,stroke-width:2px
    style E fill:#fee090,stroke:#fdae61,stroke-width:2px
"""

fig3_code = """flowchart LR
    subgraph SubsystemA ["Subsystem A: Deterministic Ingress Kiosk"]
        direction TB
        K["Virtual Kiosk<br>(PIN / RFID / QR)"] -->|Synchronous Log| A_Log["Attendance Timestamp"]
    end

    subgraph SubsystemB ["Subsystem B: Edge CV Safety Engine"]
        direction TB
        C["Work-Zone CCTV"] --> E["Edge AI Node<br>(YOLOv8 + GhostNet)"]
        E -->|Asynchronous| V_Log["PPE Violation Event"]
    end
    
    subgraph SubsystemC ["Subsystem C: Cloud Event Bus & Payroll"]
        direction TB
        A_Log --> EB["Event Broker (Kafka)"]
        V_Log --> EB
        EB --> DB[("Relational DB / ERP")]
        DB --> P["API Payroll Gateway<br>(Razorpay/Stripe)"]
        P --> W["Instant Worker Payout"]
    end
    
    style SubsystemA fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,stroke-dasharray: 5 5
    style SubsystemB fill:#fff3e0,stroke:#f57c00,stroke-width:2px,stroke-dasharray: 5 5
    style SubsystemC fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,stroke-dasharray: 5 5
    
    style K fill:#b3e5fc,stroke:#0288d1
    style E fill:#ffe0b2,stroke:#f57c00
    style P fill:#c8e6c9,stroke:#388e3c
"""

try:
    generate_mermaid_image(fig1_code, 'Figure_1_Taxonomy.png')
    generate_mermaid_image(fig3_code, 'Figure_3_Decoupled_Architecture.png')
    print("Images generated successfully!")
except Exception as e:
    print(f"Error: {e}")
