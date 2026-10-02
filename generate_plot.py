import matplotlib.pyplot as plt
import numpy as np

# Set font to Times New Roman
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman']
plt.rcParams['font.size'] = 14
plt.rcParams['axes.linewidth'] = 1.5

# Data based on the paper's findings
occlusion_levels = np.array([0, 25, 50, 70, 85]) # Percentage of face occluded
fnmr_biometric = np.array([1.5, 8.4, 22.1, 38.7, 56.3]) # FNMR for facial recognition
fnmr_decoupled = np.array([0.0, 0.0, 0.0, 0.0, 0.0]) # FNMR for decoupled (PIN/RFID)

# Create plot
fig, ax = plt.subplots(figsize=(8, 6))

# Plot lines with OriginPro-like styling
ax.plot(occlusion_levels, fnmr_biometric, marker='s', markersize=9, linewidth=2.5, color='#d73027', label='Monolithic Facial Biometrics')
ax.plot(occlusion_levels, fnmr_decoupled, marker='o', markersize=9, linewidth=2.5, color='#4575b4', label='Decoupled Tokens (PIN/RFID)')

# Format axes
ax.set_xlabel('Progressive PPE Occlusion Area (%)', fontweight='bold')
ax.set_ylabel('False Non-Match Rate (FNMR) %', fontweight='bold')
ax.set_title('Biometric Failure Under PPE Occlusion (Fig. 2)', fontweight='bold', pad=15)

# 4-axis bound (box) - True by default in matplotlib, just ensuring linewidth
for spine in ax.spines.values():
    spine.set_visible(True)
    spine.set_linewidth(1.5)

# Ticks pointing inwards, on all 4 sides (OriginPro style)
ax.tick_params(direction='in', length=8, width=1.5, colors='black', 
               top=True, right=True)

# Grid
ax.grid(False) # Origin typically starts without grid, or very faint

# Legend
ax.legend(loc='upper left', frameon=True, edgecolor='black', fancybox=False, framealpha=1.0)

# Limits
ax.set_xlim(-5, 90)
ax.set_ylim(-2, 65)

# Save
plt.tight_layout()
plt.savefig('Figure_2_Performance_Degradation.png', dpi=300, bbox_inches='tight')
print("Plot successfully generated as Figure_2_Performance_Degradation.png")
