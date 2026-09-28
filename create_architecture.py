import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Setup the figure for 16:9 aspect ratio
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'sans-serif']
fig, ax = plt.subplots(figsize=(16, 9), facecolor='#f8fafc')

# Remove axes
ax.axis('off')

# Box properties
box_width = 3.2
box_height = 1.2
radius = 0.15

# Define node styles
style_edge = {'facecolor': '#eff6ff', 'edgecolor': '#3b82f6', 'linewidth': 2}
style_core = {'facecolor': '#fefce8', 'edgecolor': '#eab308', 'linewidth': 2}
style_db = {'facecolor': '#f0fdf4', 'edgecolor': '#22c55e', 'linewidth': 2}
style_ext = {'facecolor': '#fdf2f8', 'edgecolor': '#ec4899', 'linewidth': 2}

nodes = {
    'Worker App': {'x': 1, 'y': 6, 'style': style_edge, 'label': 'Virtual Kiosk App\n(Digital Identity)'},
    'CCTV': {'x': 1, 'y': 2, 'style': style_edge, 'label': 'CCTV Camera\n(RTSP Feed)'},
    
    'Attendance': {'x': 6.5, 'y': 7, 'style': style_core, 'label': 'Attendance API\n(Next.js / Node.js)'},
    'Vision': {'x': 6.5, 'y': 4.5, 'style': style_core, 'label': 'Vision Analytics\n(YOLOv8 PPE Model)'},
    'Payroll': {'x': 6.5, 'y': 2, 'style': style_core, 'label': 'Payroll Service\n(Automated Payments)'},
    
    'DB': {'x': 12, 'y': 5.5, 'style': style_db, 'label': 'PostgreSQL Database\n(Prisma ORM)'},
    'Razorpay': {'x': 12, 'y': 2, 'style': style_ext, 'label': 'Razorpay Gateway\n(Payment API)'}
}

# Draw Nodes
for key, node in nodes.items():
    rect = patches.FancyBboxPatch(
        (node['x'], node['y']), box_width, box_height,
        boxstyle=f"round,pad=0.1,rounding_size={radius}",
        **node['style'], zorder=3
    )
    ax.add_patch(rect)
    ax.text(node['x'] + box_width/2, node['y'] + box_height/2, node['label'],
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1e293b', zorder=4)

# Draw Column Titles
ax.text(1 + box_width/2, 8.5, 'Edge / Site Level', ha='center', fontsize=18, fontweight='bold', color='#3b82f6')
ax.text(6.5 + box_width/2, 8.5, 'Core Backend Services', ha='center', fontsize=18, fontweight='bold', color='#eab308')
ax.text(12 + box_width/2, 8.5, 'Data & External', ha='center', fontsize=18, fontweight='bold', color='#22c55e')

# Function to draw arrows
def draw_arrow(start_node, end_node, label='', connection_style="arc3,rad=0", shrink=10):
    start = nodes[start_node]
    end = nodes[end_node]
    
    # Calculate approximate centers
    start_x = start['x'] + box_width / 2
    start_y = start['y'] + box_height / 2
    end_x = end['x'] + box_width / 2
    end_y = end['y'] + box_height / 2
    
    # Determine attachment points based on relative positions
    if end_x > start_x + box_width:  # Left to Right
        x1, y1 = start['x'] + box_width, start_y
        x2, y2 = end['x'], end_y
    elif start_x > end_x + box_width: # Right to Left
        x1, y1 = start['x'], start_y
        x2, y2 = end['x'] + box_width, end_y
    elif end_y > start_y + box_height: # Bottom to Top
        x1, y1 = start_x, start['y'] + box_height
        x2, y2 = end_x, end['y']
    else: # Top to Bottom
        x1, y1 = start_x, start['y']
        x2, y2 = end_x, end['y'] + box_height

    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color="#64748b", lw=2, shrinkA=5, shrinkB=5, connectionstyle=connection_style),
                zorder=2)
    
    if label:
        # Calculate label position
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2
        ax.text(mid_x, mid_y + 0.2, label, ha='center', va='center', fontsize=10, 
                color='#475569', backgroundcolor='#f8fafc', zorder=5, fontweight='semibold')

# Draw connections
draw_arrow('Worker App', 'Attendance', 'Auth & Clock-in', connection_style="arc3,rad=0.1")
draw_arrow('CCTV', 'Vision', 'Video Stream', connection_style="arc3,rad=-0.1")
draw_arrow('Vision', 'Attendance', 'PPE Compliance Data', connection_style="arc3,rad=-0.2")
draw_arrow('Attendance', 'DB', 'Log Records', connection_style="arc3,rad=0.1")
draw_arrow('Attendance', 'Payroll', 'Trigger Payout')
draw_arrow('Payroll', 'DB', 'Fetch/Update Wages', connection_style="arc3,rad=-0.1")
draw_arrow('Payroll', 'Razorpay', 'Process Transfer', connection_style="arc3,rad=0")

# Set Plot limits
ax.set_xlim(0, 16)
ax.set_ylim(0, 9.5)

# Add main title
plt.suptitle('System Architecture: AI-Driven Construction Site Management', 
             fontsize=28, fontweight='bold', color='#0f172a', y=0.96)

# Add Legend manually
legend_elements = [
    patches.Patch(facecolor='#eff6ff', edgecolor='#3b82f6', label='Edge Devices'),
    patches.Patch(facecolor='#fefce8', edgecolor='#eab308', label='Microservices'),
    patches.Patch(facecolor='#f0fdf4', edgecolor='#22c55e', label='Databases'),
    patches.Patch(facecolor='#fdf2f8', edgecolor='#ec4899', label='Third-Party APIs')
]
ax.legend(handles=legend_elements, loc='lower center', bbox_to_anchor=(0.5, -0.05), ncol=4, frameon=False, fontsize=14)

plt.tight_layout(rect=[0, 0.05, 1, 0.9])
plt.savefig('system_architecture_ppt.png', dpi=300, bbox_inches='tight')
print("Architecture Diagram saved to system_architecture_ppt.png")
