import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Setup the figure for 16:9 aspect ratio, professional look
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'sans-serif']
fig, ax = plt.subplots(figsize=(16, 9), facecolor='#ffffff')

# Remove axes
ax.axis('off')

# Box properties
box_w = 2.8
box_h = 1.0
radius = 0.1

# Define styles
style_client = {'facecolor': '#e0f2fe', 'edgecolor': '#0284c7', 'linewidth': 2}   # Light Blue
style_api = {'facecolor': '#fef3c7', 'edgecolor': '#d97706', 'linewidth': 2}      # Light Yellow
style_ai = {'facecolor': '#f3e8ff', 'edgecolor': '#9333ea', 'linewidth': 2}       # Purple
style_db = {'facecolor': '#dcfce7', 'edgecolor': '#16a34a', 'linewidth': 2}       # Light Green
style_ext = {'facecolor': '#ffe4e6', 'edgecolor': '#e11d48', 'linewidth': 2}      # Light Rose
style_layer = {'facecolor': 'none', 'edgecolor': '#cbd5e1', 'linewidth': 1.5, 'linestyle': '--'}

# Background Layers (Sections)
ax.add_patch(patches.Rectangle((0.5, 0.5), 4, 8, **style_layer, zorder=1))
ax.text(2.5, 8.2, 'Client / Edge Layer', ha='center', fontsize=14, fontweight='bold', color='#64748b')

ax.add_patch(patches.Rectangle((5.5, 0.5), 4.5, 8, **style_layer, zorder=1))
ax.text(7.75, 8.2, 'Backend Application Layer', ha='center', fontsize=14, fontweight='bold', color='#64748b')

ax.add_patch(patches.Rectangle((11.0, 0.5), 4.5, 8, **style_layer, zorder=1))
ax.text(13.25, 8.2, 'Data & External Integrations', ha='center', fontsize=14, fontweight='bold', color='#64748b')

nodes = {
    # Clients
    'Kiosk': {'x': 1.1, 'y': 6.5, 'style': style_client, 'label': 'Site Virtual Kiosk\n(React / Face Auth)'},
    'CCTV': {'x': 1.1, 'y': 4.5, 'style': style_client, 'label': 'CCTV Camera Network\n(RTSP Video Feed)'},
    'Admin': {'x': 1.1, 'y': 2.5, 'style': style_client, 'label': 'Admin Dashboard\n(Next.js UI)'},

    # Backend APIs
    'AuthAPI': {'x': 6.3, 'y': 6.5, 'style': style_api, 'label': 'Attendance API\n(Worker Check-In)'},
    'VisionAPI': {'x': 6.3, 'y': 4.5, 'style': style_ai, 'label': 'YOLOv8 AI Engine\n(TensorFlow PPE Detect)'},
    'PayrollAPI': {'x': 6.3, 'y': 2.5, 'style': style_api, 'label': 'Payroll & Core API\n(Wages & Reports)'},
    
    # DB and External
    'DB': {'x': 11.8, 'y': 5.5, 'style': style_db, 'label': 'PostgreSQL Database\n(Prisma ORM)'},
    'Razorpay': {'x': 11.8, 'y': 2.5, 'style': style_ext, 'label': 'Razorpay API\n(Automated Payouts)'},
    'Cloud': {'x': 11.8, 'y': 1.0, 'style': style_ext, 'label': 'Cloud Storage\n(Incident Snapshots)'}
}

# Draw Nodes
for key, node in nodes.items():
    rect = patches.FancyBboxPatch(
        (node['x'], node['y']), box_w, box_h,
        boxstyle=f"round,pad=0.1,rounding_size={radius}",
        **node['style'], zorder=3
    )
    ax.add_patch(rect)
    ax.text(node['x'] + box_w/2, node['y'] + box_h/2, node['label'],
            ha='center', va='center', fontsize=11, fontweight='bold', color='#1e293b', zorder=4)

# Function to draw precise arrows
def draw_arrow(x1, y1, x2, y2, label='', cstyle="arc3,rad=0"):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color="#94a3b8", lw=2, shrinkA=8, shrinkB=8, connectionstyle=cstyle),
                zorder=2)
    if label:
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2
        ax.text(mid_x, mid_y, label, ha='center', va='center', fontsize=9, 
                color='#475569', backgroundcolor='#ffffff', zorder=5, fontweight='semibold')

# Kiosk to Auth
draw_arrow(nodes['Kiosk']['x']+box_w, nodes['Kiosk']['y']+box_h/2, nodes['AuthAPI']['x'], nodes['AuthAPI']['y']+box_h/2, 'JWT / Identity')
# CCTV to Vision
draw_arrow(nodes['CCTV']['x']+box_w, nodes['CCTV']['y']+box_h/2, nodes['VisionAPI']['x'], nodes['VisionAPI']['y']+box_h/2, 'Video Stream')
# Admin to Payroll
draw_arrow(nodes['Admin']['x']+box_w, nodes['Admin']['y']+box_h/2, nodes['PayrollAPI']['x'], nodes['PayrollAPI']['y']+box_h/2, 'Manage / Approve')

# Backend Internal Connections
draw_arrow(nodes['VisionAPI']['x']+box_w/2, nodes['VisionAPI']['y']+box_h, nodes['AuthAPI']['x']+box_w/2, nodes['AuthAPI']['y'], 'Report Violations')
draw_arrow(nodes['AuthAPI']['x']+box_w/2, nodes['AuthAPI']['y'], nodes['PayrollAPI']['x']+box_w/2, nodes['PayrollAPI']['y']+box_h, 'Sync Timesheets', "arc3,rad=-0.5")

# Backend to DB
draw_arrow(nodes['AuthAPI']['x']+box_w, nodes['AuthAPI']['y']+box_h/2, nodes['DB']['x'], nodes['DB']['y']+box_h, 'Log Entries')
draw_arrow(nodes['PayrollAPI']['x']+box_w, nodes['PayrollAPI']['y']+box_h/2, nodes['DB']['x'], nodes['DB']['y'], 'Fetch/Update Wages')
draw_arrow(nodes['VisionAPI']['x']+box_w, nodes['VisionAPI']['y']+box_h/2, nodes['DB']['x'], nodes['DB']['y']+box_h/2, 'Save Detections')

# Backend to External
draw_arrow(nodes['PayrollAPI']['x']+box_w, nodes['PayrollAPI']['y']+box_h*0.2, nodes['Razorpay']['x'], nodes['Razorpay']['y']+box_h/2, 'Process Transfers')
draw_arrow(nodes['VisionAPI']['x']+box_w, nodes['VisionAPI']['y']+box_h*0.2, nodes['Cloud']['x'], nodes['Cloud']['y']+box_h/2, 'Save Evidence')

# Title
plt.suptitle('Detailed System & Design Architecture', fontsize=26, fontweight='bold', color='#0f172a', y=0.97)
plt.title('Comprehensive structural overview of Client, Backend, AI Engine, and Data Layers', fontsize=14, color='#64748b', pad=15)

plt.tight_layout(rect=[0, 0, 1, 0.9])
plt.savefig('detailed_architecture_ppt.png', dpi=300, bbox_inches='tight')
print("Detailed architecture saved")
