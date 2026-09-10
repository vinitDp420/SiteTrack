---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c5c6cd'
  surface-tint: '#515f78'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0d1c32'
  on-primary-container: '#76849f'
  inverse-primary: '#b9c7e4'
  secondary: '#545f72'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f7'
  on-secondary-container: '#586377'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a1700'
  on-tertiary-container: '#b87500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#d8e3fa'
  secondary-fixed-dim: '#bcc7dd'
  on-secondary-fixed: '#111c2c'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-xl:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  touch-target: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

This design system is built for the high-stakes environment of construction management. The brand personality is authoritative, reliable, and hyper-functional. It leverages a **Minimalist Industrial** aesthetic that prioritizes utility over decoration, ensuring that data is legible under harsh outdoor lighting conditions on ruggedized hardware.

The emotional response should be one of "Mission Control" confidence—users should feel that the system is as robust as the machinery they operate. The UI utilizes high-contrast interfaces, structured information density, and a utilitarian layout to minimize cognitive load during busy shifts.

## Colors

The palette is engineered for high-visibility and environmental contrast:

- **Primary (Deep Navy):** Used for structural elements, headers, and primary navigation to provide a grounded, professional foundation.
- **Secondary (Steel Gray):** Used for supporting text, borders, and secondary iconography to maintain an industrial feel.
- **Accent (Amber):** Reserved strictly for alerts, active status indicators, and critical "punch-in" actions. It mimics safety equipment coloring for immediate recognition.
- **Surface & Backgrounds:** A clean white and off-white (`#F8FAFC`) background provides maximum contrast for the deep navy text, ensuring readability in direct sunlight.

## Typography

This design system employs **Inter** for its exceptional legibility and systematic feel. 

- **Scale:** Larger-than-standard base sizes (18px for primary body) ensure that field workers can read the screen while the device is mounted or held at a distance.
- **Weight:** Headlines use Bold (700) and Semi-bold (600) to create a clear visual hierarchy.
- **Labels:** Use uppercase for category labels and metadata to differentiate from actionable content and body text.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile devices. 

- **Tap Targets:** A strict minimum of 48px is enforced for all interactive elements to accommodate gloved hands or movement.
- **Rhythm:** An 8px linear scale governs all padding and margins. 
- **Margins:** Generous external margins (48px on desktop) focus the eye on the central data cards, while condensed gutters (24px) keep related information modules grouped tightly.

## Elevation & Depth

To maintain a "Professional & Minimal" aesthetic, this design system avoids heavy shadows in favor of **Tonal Layers and Subtle Definition**:

- **Low-Contrast Outlines:** Surfaces are primarily defined by 1px borders in Steel Gray (`#E2E8F0`) rather than shadows.
- **Focused Elevation:** Only two levels of shadows are permitted:
  - **Level 1 (Default Cards):** A very soft, wide-spread shadow (Y: 2px, Blur: 8px, 5% Opacity Navy) to separate content from the page background.
  - **Level 2 (Active/Modals):** A more defined shadow (Y: 8px, Blur: 24px, 12% Opacity Navy) to signify direct interaction or temporary overlays.
- **Flat Backgrounds:** Different functional areas (like sidebars vs. main content) are distinguished by slight shifts in background hex codes rather than depth.

## Shapes

The shape language is strictly geometric and structured. 

- **Radius:** A consistent 8px (`rounded-md`) is used for all containers, input fields, and buttons. This provides a modern feel while retaining the structural rigidity associated with the construction industry.
- **Iconography:** Icons should be stroke-based (2px weight) with squared-off ends to match the "Industrial-Tech" theme.

## Components

### Buttons
- **Primary:** Deep Navy background with White text. Minimum height 48px. 8px corner radius.
- **Accent (Critical):** Amber background with Navy text for high-priority actions like "Clock In."
- **Secondary:** Transparent background with 2px Steel Gray border.

### Input Fields
- Heavy 2px borders when focused. Labels must be positioned above the field, never as placeholder text, to ensure context is never lost during data entry.

### Cards
- White background, 1px Steel Gray border, and Level 1 elevation. Cards should have a vertical stack on mobile and a horizontal/grid layout on desktop.

### Status Chips
- Solid color blocks with high-contrast text. Use Amber for "Pending" or "Late," and Navy for "On-Site."

### Attendance List
- High-density rows with large avatars and clear "In/Out" time stamps. Every row must have a minimum height of 64px to ensure tap accuracy.

### Workforce Map
- Integrated map component with custom markers using the Primary Navy and Accent Amber to show worker density at specific job sites.