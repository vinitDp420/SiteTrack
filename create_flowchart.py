import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Setup figure for 16:9 aspect ratio, Dark Mode Theme
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'sans-serif']
fig, ax = plt.subplots(figsize=(16, 9), facecolor='#0f172a') # Dark slate background

ax.axis('off')

# Box properties
box_w = 3.5
box_h = 1.2
radius = 0.2

# Dark mode styles
style_start = {'facecolor': '#3b82f6', 'edgecolor': '#60a5fa', 'linewidth': 2}   # Blue
style_process = {'facecolor': '#1e293b', 'edgecolor': '#94a3b8', 'linewidth': 2} # Dark Gray
style_decision = {'facecolor': '#f59e0b', 'edgecolor': '#fbbf24', 'linewidth': 2} # Orange
style_end = {'facecolor': '#10b981', 'edgecolor': '#34d399', 'linewidth': 2}     # Green
style_alert = {'facecolor': '#ef4444', 'edgecolor': '#f87171', 'linewidth': 2}   # Red

# Define Nodes
nodes = {
    'Start':      {'x': 1, 'y': 7.5, 'style': style_start, 'label': 'Worker Arrives at Site'},
    'Auth':       {'x': 1, 'y': 5.5, 'style': style_process, 'label': 'Virtual Kiosk Auth\n(QR / Face ID)'},
    'Entry':      {'x': 1, 'y': 3.5, 'style': style_process, 'label': 'Granted Access\nAttendance Logged'},
    
    'CCTV':       {'x': 6, 'y': 6.5, 'style': style_process, 'label': 'Continuous Monitoring\n(CCTV + YOLOv8)'},
    'CheckPPE':   {'x': 6, 'y': 4.5, 'style': style_decision, 'label': 'PPE Violation\nDetected?'},
    'Alert':      {'x': 11, 'y': 4.5, 'style': style_alert, 'label': 'Flag Violation &\nAlert Admin'},
    
    'Checkout':   {'x': 6, 'y': 2.5, 'style': style_process, 'label': 'End of Shift\n(Kiosk Checkout)'},
    
    'Payroll':    {'x': 11, 'y': 2.5, 'style': style_process, 'label': 'Calculate Daily Wages\n(Deduct for Violations)'},
    'Payment':    {'x': 11, 'y': 0.5, 'style': style_end, 'label': 'Trigger Razorpay\nAutomated Payout'}
}

# Draw Nodes
for key, node in nodes.items():
    rect = patches.FancyBboxPatch(
        (node['x'], node['y']), box_w, box_h,
        boxstyle=f"round,pad=0.1,rounding_size={radius}",
        **node['style'], zorder=3
    )
    ax.add_patch(rect)
    
    # White text for dark mode
    text_color = '#ffffff' if key in ['Start', 'CheckPPE', 'Alert', 'Payment'] else '#f8fafc'
    ax.text(node['x'] + box_w/2, node['y'] + box_h/2, node['label'],
            ha='center', va='center', fontsize=14, fontweight='bold', color=text_color, zorder=4)

# Function to draw arrows
def draw_arrow(start_node, end_node, label='', connection_style="arc3,rad=0", shrink=10):
    start = nodes[start_node]
    end = nodes[end_node]
    
    start_x = start['x'] + box_w / 2
    start_y = start['y'] + box_h / 2
    end_x = end['x'] + box_w / 2
    end_y = end['y'] + box_h / 2
    
    if end_x > start_x + box_w:  # Left to Right
        x1, y1 = start['x'] + box_w, start_y
        x2, y2 = end['x'], end_y
    elif start_x > end_x + box_w: # Right to Left
        x1, y1 = start['x'], start_y
        x2, y2 = end['x'] + box_w, end_y
    elif end_y > start_y + box_h: # Bottom to Top
        x1, y1 = start_x, start['y'] + box_h
        x2, y2 = end_x, end['y']
    else: # Top to Bottom
        x1, y1 = start_x, start['y']
        x2, y2 = end_x, end['y'] + box_h

    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color="#94a3b8", lw=2, shrinkA=5, shrinkB=5, connectionstyle=connection_style),
                zorder=2)
    
    if label:
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2
        ax.text(mid_x, mid_y + 0.2, label, ha='center', va='center', fontsize=12, 
                color='#cbd5e1', backgroundcolor='#0f172a', zorder=5, fontweight='bold')

# Draw connections
draw_arrow('Start', 'Auth')
draw_arrow('Auth', 'Entry', 'Success')
draw_arrow('Entry', 'CCTV', 'Worker on Site', connection_style="arc3,rad=0.1")
draw_arrow('CCTV', 'CheckPPE')

draw_arrow('CheckPPE', 'Alert', 'Yes (No Helmet/Vest)')
draw_arrow('CheckPPE', 'Checkout', 'No (Compliant)')
draw_arrow('Alert', 'Checkout', 'Log Incident', connection_style="arc3,rad=-0.1")

draw_arrow('Checkout', 'Payroll', 'Sync Logs')
draw_arrow('Payroll', 'Payment', 'End of Day')

# Set Plot limits
ax.set_xlim(0, 16)
ax.set_ylim(-0.5, 9)

# Add main title
plt.suptitle('Operational Process Flow: Automated Site Management', 
             fontsize=28, fontweight='bold', color='#f8fafc', y=0.96)
plt.title('End-to-End User Journey from Site Entry to Automated Payroll', fontsize=16, color='#94a3b8', pad=20)

plt.tight_layout(rect=[0, 0, 1, 0.9])
plt.savefig('process_flow_ppt.png', dpi=300, bbox_inches='tight', facecolor='#0f172a')
print("Process Flow Diagram saved to process_flow_ppt.png")
