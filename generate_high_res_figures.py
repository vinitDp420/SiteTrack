import matplotlib.pyplot as plt
import matplotlib.patches as patches

def generate_figure_1():
    """Generates a high-resolution, perfectly proportioned Taxonomy Tree Diagram for Fig 1.1"""
    plt.rcParams['font.sans-serif'] = ['Segoe UI', 'DejaVu Sans', 'Arial', 'sans-serif']
    fig, ax = plt.subplots(figsize=(15, 10.5), facecolor='#ffffff')
    ax.axis('off')
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 10.5)

    # Styles
    box_style_root = {'boxstyle': 'round,pad=0.6,rounding_size=0.2', 'facecolor': '#1e3a8a', 'edgecolor': '#172554', 'linewidth': 2.5}
    box_style_cat = {'boxstyle': 'round,pad=0.5,rounding_size=0.15', 'facecolor': '#0284c7', 'edgecolor': '#0369a1', 'linewidth': 2}
    box_style_leaf = {'boxstyle': 'round,pad=0.4,rounding_size=0.12', 'facecolor': '#f8fafc', 'edgecolor': '#cbd5e1', 'linewidth': 1.5}
    box_style_leaf_warn = {'boxstyle': 'round,pad=0.4,rounding_size=0.12', 'facecolor': '#fff1f2', 'edgecolor': '#f43f5e', 'linewidth': 1.5}
    box_style_leaf_succ = {'boxstyle': 'round,pad=0.4,rounding_size=0.12', 'facecolor': '#f0fdf4', 'edgecolor': '#22c55e', 'linewidth': 1.5}

    # Root Node
    ax.text(7.5, 9.6, 'AI-Based Construction Workforce Management',
            ha='center', va='center', fontsize=18, fontweight='bold', color='#ffffff',
            bbox=box_style_root, zorder=5)

    # Categories (X-centers)
    cats = [
        {
            'x': 1.875, 'title': 'Deep Learning for\nPPE Detection',
            'leaves': [
                ('Single-Stage Detectors\n(YOLOv5 / YOLOv8)', box_style_leaf),
                ('Spatial Attention Modules\n(MHSA / SE-Net)', box_style_leaf),
                ('Lightweight Backbones\n(GhostNet / MobileNet)', box_style_leaf)
            ]
        },
        {
            'x': 5.625, 'title': 'Digital Identity\nParadigms',
            'leaves': [
                ('Facial Biometric Verification\n(Severe Occlusion by PPE)', box_style_leaf_warn),
                ('Deterministic Virtual Kiosks\n(Phone + PIN Authentication)', box_style_leaf_succ),
                ('Physical & Token Badges\n(UHF RFID & Dynamic QR)', box_style_leaf)
            ]
        },
        {
            'x': 9.375, 'title': 'Decoupled System\nArchitecture',
            'leaves': [
                ('Ingress Identity Gate\n(Synchronous, < 1.2s)', box_style_leaf_succ),
                ('Active Zone Safety Auditing\n(Asynchronous Edge Vision)', box_style_leaf),
                ('Cloud Event Broker\n(Kafka / Timeseries Sync)', box_style_leaf)
            ]
        },
        {
            'x': 13.125, 'title': 'Enterprise Cloud\n& Payroll',
            'leaves': [
                ('Automated Payout APIs\n(Instant UPI / RazorpayX)', box_style_leaf_succ),
                ('Timesheet Reconciliation\n(Lag cut from 14d to <60s)', box_style_leaf),
                ('Smart Contracts & Escrow\n(Automated Ledger Release)', box_style_leaf)
            ]
        }
    ]

    # Draw horizontal distribution bar from Root
    ax.plot([1.875, 13.125], [8.5, 8.5], color='#64748b', lw=2.5, zorder=2)
    ax.plot([7.5, 7.5], [9.1, 8.5], color='#64748b', lw=2.5, zorder=2)

    for cat in cats:
        cx = cat['x']
        # Vertical drop to category
        ax.plot([cx, cx], [8.5, 7.7], color='#64748b', lw=2.5, zorder=2)
        
        # Category node
        ax.text(cx, 7.3, cat['title'],
                ha='center', va='center', fontsize=12.5, fontweight='bold', color='#ffffff',
                bbox=box_style_cat, zorder=5)
        
        # Drop to leaves
        ax.plot([cx, cx], [6.6, 5.8], color='#94a3b8', lw=2, zorder=2)
        
        leaf_y_coords = [5.3, 3.6, 1.9]
        for idx, (l_text, l_style) in enumerate(cat['leaves']):
            ly = leaf_y_coords[idx]
            if idx > 0:
                ax.plot([cx, cx], [leaf_y_coords[idx-1] - 0.7, ly + 0.6], color='#94a3b8', lw=1.8, zorder=2)
            
            # Leaf box
            ax.text(cx, ly, l_text,
                    ha='center', va='center', fontsize=10.5, fontweight='semibold', color='#1e293b',
                    bbox=l_style, zorder=5)

    # Main Title
    plt.suptitle('Taxonomy of AI-Based Construction Workforce Management', fontsize=21, fontweight='bold', color='#0f172a', y=0.99)
    plt.subplots_adjust(left=0.03, right=0.97, top=0.93, bottom=0.03)
    
    out_path = 'Figure_1_Taxonomy.png'
    plt.savefig(out_path, dpi=250, facecolor='#ffffff')
    plt.close()
    print(f"Generated {out_path} successfully.")

def generate_figure_3():
    """Generates a high-resolution, perfectly readable Multi-Tier System Architecture for Fig 3.1"""
    plt.rcParams['font.sans-serif'] = ['Segoe UI', 'DejaVu Sans', 'Arial', 'sans-serif']
    fig, ax = plt.subplots(figsize=(16, 10), facecolor='#ffffff')
    ax.axis('off')
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 10)

    # Box dimensions
    box_w = 3.2
    box_h = 1.15
    radius = 0.12

    # Section background panels
    panel_y = 0.6
    panel_h = 8.4
    style_panel = {'edgecolor': '#94a3b8', 'linewidth': 1.8, 'linestyle': '--', 'zorder': 1}

    # 1. Edge Layer Panel
    ax.add_patch(patches.FancyBboxPatch((0.5, panel_y), 4.3, panel_h, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#f0f9ff', **style_panel))
    ax.text(2.65, 8.6, '1. Client / Edge Layer', ha='center', va='center', fontsize=15, fontweight='bold', color='#0369a1')

    # 2. Backend Application Layer Panel
    ax.add_patch(patches.FancyBboxPatch((5.85, panel_y), 4.3, panel_h, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#fefce8', **style_panel))
    ax.text(8.0, 8.6, '2. Backend Application Layer', ha='center', va='center', fontsize=15, fontweight='bold', color='#b45309')

    # 3. Data & External Integrations Panel
    ax.add_patch(patches.FancyBboxPatch((11.2, panel_y), 4.3, panel_h, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#f0fdf4', **style_panel))
    ax.text(13.35, 8.6, '3. Data & External Integrations', ha='center', va='center', fontsize=15, fontweight='bold', color='#15803d')

    # Node styling
    style_edge = {'facecolor': '#bae6fd', 'edgecolor': '#0284c7', 'linewidth': 2}
    style_backend = {'facecolor': '#fde68a', 'edgecolor': '#d97706', 'linewidth': 2}
    style_ai = {'facecolor': '#e9d5ff', 'edgecolor': '#9333ea', 'linewidth': 2}
    style_data = {'facecolor': '#bbf7d0', 'edgecolor': '#16a34a', 'linewidth': 2}
    style_ext = {'facecolor': '#fecdd3', 'edgecolor': '#e11d48', 'linewidth': 2}

    nodes = {
        # Client Nodes
        'Kiosk': {'x': 1.05, 'y': 6.8, 'style': style_edge, 'label': 'Site Virtual Kiosk\n(Tablet / Phone+PIN / Face)'},
        'CCTV': {'x': 1.05, 'y': 4.9, 'style': style_edge, 'label': 'Fixed IP CCTV Network\n(ONVIF / RTSP 1080p Stream)'},
        'MobileCam': {'x': 1.05, 'y': 3.0, 'style': style_edge, 'label': 'Mobile Camera Node\n(Field Smartphone / WebRTC)'},
        'AdminUI': {'x': 1.05, 'y': 1.1, 'style': style_edge, 'label': 'Admin Web Dashboard\n(Next.js 16 UI / Monitoring)'},

        # Backend Nodes
        'AuthAPI': {'x': 6.4, 'y': 6.8, 'style': style_backend, 'label': 'Attendance Ingress API\n(Worker Authentication)'},
        'VisionEngine': {'x': 6.4, 'y': 4.4, 'style': style_ai, 'label': 'YOLOv8 Edge AI Engine\n(MHSA PPE Detection / WebGPU)'},
        'PayrollAPI': {'x': 6.4, 'y': 1.8, 'style': style_backend, 'label': 'Payroll & Core Service\n(Wages, Shifts & Analytics)'},

        # Data & External Nodes
        'DB': {'x': 11.75, 'y': 6.2, 'style': style_data, 'label': 'PostgreSQL Database\n(Prisma ORM / Timesheets)'},
        'Razorpay': {'x': 11.75, 'y': 3.5, 'style': style_ext, 'label': 'RazorpayX / UPI Gateway\n(Instant Payout Webhooks)'},
        'CloudStorage': {'x': 11.75, 'y': 1.4, 'style': style_ext, 'label': 'Cloud Incident Storage\n(Violation Snapshots & Proof)'}
    }

    # Render Node Boxes
    for k, n in nodes.items():
        patch = patches.FancyBboxPatch((n['x'], n['y']), box_w, box_h,
                                      boxstyle=f"round,pad=0.1,rounding_size={radius}",
                                      **n['style'], zorder=4)
        ax.add_patch(patch)
        ax.text(n['x'] + box_w/2, n['y'] + box_h/2, n['label'],
                ha='center', va='center', fontsize=10.5, fontweight='bold', color='#0f172a', zorder=5)

    # Function to draw arrows with badge labels
    def draw_edge(n1, n2, label='', offset_y1=0.5, offset_y2=0.5, rad=0, label_pos=0.5):
        s = nodes[n1]
        e = nodes[n2]
        x1 = s['x'] + box_w
        y1 = s['y'] + box_h * offset_y1
        x2 = e['x']
        y2 = e['y'] + box_h * offset_y2
        
        arrowprops = dict(arrowstyle="-|>", color="#475569", lw=2, shrinkA=4, shrinkB=4,
                          connectionstyle=f"arc3,rad={rad}", mutation_scale=15)
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1), arrowprops=arrowprops, zorder=3)
        
        if label:
            mx = x1 + (x2 - x1) * label_pos
            my = y1 + (y2 - y1) * label_pos
            ax.text(mx, my + 0.12, label, ha='center', va='center', fontsize=8.5,
                    fontweight='bold', color='#1e293b',
                    bbox=dict(boxstyle="round,pad=0.2", facecolor='#ffffff', edgecolor='#cbd5e1', lw=1),
                    zorder=6)

    # Connecting Arrows
    draw_edge('Kiosk', 'AuthAPI', 'JWT / Auth Payload', 0.5, 0.5)
    draw_edge('CCTV', 'VisionEngine', 'RTSP Stream', 0.5, 0.65)
    draw_edge('MobileCam', 'VisionEngine', 'WebRTC Feed', 0.5, 0.35)
    draw_edge('AdminUI', 'PayrollAPI', 'Audit / Approve', 0.5, 0.5)

    # Backend Inter-service arrows
    ax.annotate('', xy=(nodes['AuthAPI']['x'] + box_w*0.5, nodes['AuthAPI']['y']),
                xytext=(nodes['VisionEngine']['x'] + box_w*0.5, nodes['VisionEngine']['y'] + box_h),
                arrowprops=dict(arrowstyle="-|>", color="#9333ea", lw=2, shrinkA=4, shrinkB=4, mutation_scale=15),
                zorder=3)
    ax.text(nodes['VisionEngine']['x'] + box_w*0.5 + 0.7, (nodes['AuthAPI']['y'] + nodes['VisionEngine']['y'] + box_h)/2,
            'PPE Violations', ha='center', va='center', fontsize=8, fontweight='bold', color='#7e22ce',
            bbox=dict(boxstyle="round,pad=0.2", facecolor='#f5f3ff', edgecolor='#d8b4fe', lw=1), zorder=6)

    ax.annotate('', xy=(nodes['PayrollAPI']['x'] + box_w*0.5, nodes['PayrollAPI']['y'] + box_h),
                xytext=(nodes['AuthAPI']['x'] + box_w*0.5, nodes['AuthAPI']['y']),
                arrowprops=dict(arrowstyle="-|>", color="#d97706", lw=2, shrinkA=4, shrinkB=4,
                                connectionstyle="arc3,rad=-0.4", mutation_scale=15),
                zorder=3)
    ax.text(nodes['PayrollAPI']['x'] - 0.2, (nodes['AuthAPI']['y'] + nodes['PayrollAPI']['y'] + box_h)/2 + 0.2,
            'Verified Timesheets', ha='center', va='center', fontsize=8, fontweight='bold', color='#b45309',
            bbox=dict(boxstyle="round,pad=0.2", facecolor='#fffbeb', edgecolor='#fde68a', lw=1), zorder=6)

    # Backend to Database & External
    draw_edge('AuthAPI', 'DB', 'Log Ingress Stamps', 0.5, 0.7)
    draw_edge('VisionEngine', 'DB', 'Safety Telemetry', 0.5, 0.3)
    draw_edge('PayrollAPI', 'DB', 'Timesheet Queries', 0.5, 0.1)
    draw_edge('PayrollAPI', 'Razorpay', 'Instant UPI Payouts', 0.6, 0.5)
    draw_edge('VisionEngine', 'CloudStorage', 'Archive Snapshots', 0.2, 0.5, rad=-0.15, label_pos=0.6)

    # Main Header
    plt.suptitle('SiteTrack: Comprehensive Multi-Tier System Architecture', fontsize=21, fontweight='bold', color='#0f172a', y=0.985)
    plt.title('Detailed functional interactions across Edge Ingress, Real-Time Vision Analytics, and Automated Financial Settlement',
              fontsize=12, color='#475569', pad=12)
    plt.subplots_adjust(left=0.02, right=0.98, top=0.92, bottom=0.03)

    out_path = 'detailed_architecture_ppt.png'
    plt.savefig(out_path, dpi=250, facecolor='#ffffff')
    plt.close()
    print(f"Generated {out_path} successfully.")

def generate_figure_2_decoupled():
    """Generates a high-resolution, vector-quality Decoupled Architecture diagram for Fig 2.2"""
    plt.rcParams['font.sans-serif'] = ['Segoe UI', 'DejaVu Sans', 'Arial', 'sans-serif']
    fig, ax = plt.subplots(figsize=(15, 8.5), facecolor='#ffffff')
    ax.axis('off')
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 8.5)

    # Subsystems
    # Subsystem A: Deterministic Ingress Kiosk
    ax.add_patch(patches.FancyBboxPatch((0.5, 4.4), 4.2, 3.4, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#e0f2fe', edgecolor='#0284c7', linewidth=2, linestyle='--'))
    ax.text(2.6, 7.5, 'Subsystem A: Ingress Kiosk\n(Deterministic Identity)', ha='center', va='center',
            fontsize=12.5, fontweight='bold', color='#0369a1')
    
    # Subsystem B: Edge CV Safety Engine
    ax.add_patch(patches.FancyBboxPatch((0.5, 0.6), 4.2, 3.4, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#ffedd5', edgecolor='#f97316', linewidth=2, linestyle='--'))
    ax.text(2.6, 3.7, 'Subsystem B: Edge Safety Vision\n(Asynchronous PPE Auditing)', ha='center', va='center',
            fontsize=12.5, fontweight='bold', color='#c2410c')

    # Subsystem C: Cloud Event Bus & Payroll
    ax.add_patch(patches.FancyBboxPatch((5.8, 0.6), 8.7, 7.2, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor='#f0fdf4', edgecolor='#16a34a', linewidth=2, linestyle='--'))
    ax.text(10.15, 7.4, 'Subsystem C: Cloud Event Bus, Storage & Automated Payroll Gateway', ha='center', va='center',
            fontsize=13, fontweight='bold', color='#15803d')

    # Node Cards inside Subsystem A
    box_card = {'boxstyle': 'round,pad=0.35,rounding_size=0.1', 'linewidth': 1.5}
    ax.text(2.6, 6.2, 'Virtual Kiosk Interface\n(Phone + PIN / 128-d Face)', ha='center', va='center', fontsize=10,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#ffffff', edgecolor='#38bdf8', **box_card))
    ax.text(2.6, 4.9, 'Deterministic Ingress Log\n(Sub-Second Entry Stamp)', ha='center', va='center', fontsize=9.5,
            fontweight='semibold', color='#0f172a', bbox=dict(facecolor='#bae6fd', edgecolor='#0284c7', **box_card))

    # Node Cards inside Subsystem B
    ax.text(2.6, 2.4, 'Active Zone IP Cameras\n(RTSP Video Surveillance)', ha='center', va='center', fontsize=10,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#ffffff', edgecolor='#fb923c', **box_card))
    ax.text(2.6, 1.1, 'Edge YOLOv8 Engine\n(MHSA Hard Hat / Vest Detect)', ha='center', va='center', fontsize=9.5,
            fontweight='semibold', color='#0f172a', bbox=dict(facecolor='#fed7aa', edgecolor='#f97316', **box_card))

    # Node Cards inside Subsystem C
    ax.text(7.6, 4.3, 'Cloud Message Broker\n(Apache Kafka / EventBus)', ha='center', va='center', fontsize=10.5,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#ffffff', edgecolor='#4ade80', **box_card))
    
    ax.text(10.2, 4.3, 'Relational Database\n(Prisma ORM / Timesheets)', ha='center', va='center', fontsize=10.5,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#dcfce7', edgecolor='#22c55e', **box_card))
    
    ax.text(13.0, 5.5, 'Automated Payroll Engine\n(Net Wage & Deduction Logic)', ha='center', va='center', fontsize=10,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#ffffff', edgecolor='#86efac', **box_card))
    
    ax.text(13.0, 3.0, 'Instant Payout Gateway\n(RazorpayX / UPI Transfer)', ha='center', va='center', fontsize=10,
            fontweight='bold', color='#0f172a', bbox=dict(facecolor='#bbf7d0', edgecolor='#16a34a', **box_card))
    
    ax.text(13.0, 1.3, 'Verified Worker Payout\n(Completed in < 60s)', ha='center', va='center', fontsize=9.5,
            fontweight='bold', color='#14532d', bbox=dict(facecolor='#86efac', edgecolor='#15803d', **box_card))

    # Arrows
    def arrow(x1, y1, x2, y2, lbl=''):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color="#334155", lw=2, shrinkA=3, shrinkB=3, mutation_scale=14),
                    zorder=4)
        if lbl:
            ax.text((x1+x2)/2, (y1+y2)/2 + 0.12, lbl, ha='center', va='center', fontsize=8, fontweight='bold',
                    color='#334155', bbox=dict(boxstyle="round,pad=0.15", facecolor='#ffffff', edgecolor='#cbd5e1', lw=0.8), zorder=6)

    arrow(2.6, 5.75, 2.6, 5.3)
    arrow(2.6, 1.95, 2.6, 1.5)
    arrow(4.2, 4.9, 6.3, 4.6, 'Verified Attendance Event')
    arrow(4.2, 1.1, 6.3, 4.0, 'Safety Violation Telemetry')
    arrow(8.9, 4.3, 9.0, 4.3)
    arrow(11.4, 4.6, 11.8, 5.3, 'Sync Hours')
    arrow(13.0, 4.95, 13.0, 3.6, 'Trigger Payout')
    arrow(13.0, 2.5, 13.0, 1.7, 'Instant Settlement')

    plt.suptitle('Decoupled System Architecture for Construction Workforce Management', fontsize=18, fontweight='bold', color='#0f172a', y=0.98)
    plt.subplots_adjust(left=0.02, right=0.98, top=0.92, bottom=0.03)

    out_path = 'Figure_3_Decoupled_Architecture.png'
    plt.savefig(out_path, dpi=250, facecolor='#ffffff')
    plt.close()
    print(f"Generated {out_path} successfully.")

if __name__ == '__main__':
    generate_figure_1()
    generate_figure_3()
    generate_figure_2_decoupled()
