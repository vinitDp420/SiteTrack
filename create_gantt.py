import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Setup basic configuration for 16:9 PPT size
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'sans-serif']
fig, ax = plt.subplots(figsize=(16, 9), facecolor='white')

# Define statuses and their colors
statuses = {
    'Completed': {'color': '#10b981'},     # Green
    'In Progress': {'color': '#f59e0b'},   # Yellow/Orange
    'Remaining': {'color': '#6b7280'}      # Gray
}

# Define tasks with their start month (1=Jan, 10=Oct) and duration
# We assume the project runs from Jan (1) to Oct (10)
tasks = [
    {'name': 'Literature Review & Requirements', 'status': 'Completed', 'start': 1, 'duration': 1.5},
    {'name': 'System Architecture Design', 'status': 'Completed', 'start': 2.5, 'duration': 1.5},
    {'name': 'Next.js Frontend & Kiosk UI', 'status': 'Completed', 'start': 4, 'duration': 2},
    {'name': 'YOLOv8 PPE Model Training', 'status': 'Completed', 'start': 5, 'duration': 2},
    {'name': 'Database Schema & Prisma Setup', 'status': 'Completed', 'start': 6, 'duration': 1.5},
    
    {'name': 'Payroll API & Backend Integration', 'status': 'In Progress', 'start': 7.5, 'duration': 2},
    {'name': 'Admin Dashboard Implementation', 'status': 'In Progress', 'start': 8, 'duration': 1.5},
    
    {'name': 'End-to-End Field Testing', 'status': 'Remaining', 'start': 9, 'duration': 1.5},
    {'name': 'Final Adjustments & Deployment', 'status': 'Remaining', 'start': 9.5, 'duration': 1.5},
]

# Plotting settings
y_ticks = []
y_labels = []
current_y = len(tasks) * 1.5

# Draw horizontal grid lines
for i in range(2, 11):
    ax.axvline(x=i, color='#e5e7eb', linestyle='--', zorder=0, linewidth=1)

# Plot tasks from top to bottom
for task in tasks:
    color = statuses[task['status']]['color']
    ax.barh(current_y, task['duration'], left=task['start'], color=color, height=0.8, 
            edgecolor='white', linewidth=1.5, zorder=3, alpha=0.9, capstyle='round')
    
    # Add text on the bar
    ax.text(task['start'] + 0.1, current_y, task['name'], va='center', ha='left', 
            color='white', fontsize=15, fontweight='bold', zorder=4)
            
    y_ticks.append(current_y)
    y_labels.append('')
    current_y -= 1.5

# formatting axes
ax.set_yticks(y_ticks)
ax.set_yticklabels(y_labels)
ax.set_ylim(0, len(tasks) * 1.5 + 1)

# Set x-axis for months (Jan to Oct)
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
ax.set_xlim(1, 11.5)
ax.set_xticks(range(1, 11))
ax.set_xticklabels(months, fontsize=16, fontweight='bold', color='#4b5563')

ax.xaxis.tick_top()
ax.tick_params(axis='x', length=0, pad=15)
ax.tick_params(axis='y', length=0)

# Remove spines
for spine in ax.spines.values():
    spine.set_visible(False)

# Add Legend
legend_patches = [mpatches.Patch(color=info['color'], label=status) for status, info in statuses.items()]
ax.legend(handles=legend_patches, loc='upper center', bbox_to_anchor=(0.5, -0.02), 
          ncol=3, frameon=False, fontsize=18)

# Add Title
plt.suptitle('Project Gantt Chart: Task Status Tracking', 
             fontsize=32, fontweight='bold', color='#1f2937', y=0.98)

# Add a vertical line for "Current Date" (Assuming September)
ax.axvline(x=9, color='#ef4444', linestyle='-', zorder=5, linewidth=2)
ax.text(9.1, (len(tasks) * 1.5) + 0.5, 'Current (September)', color='#ef4444', fontsize=14, fontweight='bold', zorder=5)

# Save high-res image for PPT
plt.tight_layout(rect=[0, 0.05, 1, 0.9])
plt.savefig('gantt_chart_ppt_updated.png', dpi=300, bbox_inches='tight')
print("Updated Gantt chart saved as gantt_chart_ppt_updated.png")
