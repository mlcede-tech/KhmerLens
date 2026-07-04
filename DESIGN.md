# Design

Visual system for KhmerLens. The lookup popup (`extension/content/popup.css`)
is the source of truth; every other surface stays consistent with it.

## Color

Strategy: **Restrained** — tinted neutrals + one committed accent (amber).
The accent is the brand; it carries the letter mark, focus rings, selected
states, and links. Nothing decorative is colored.

OKLCH values (with the existing hex the popup already ships, kept for
identity):

### Light
- `--bg`      oklch(0.99 0.004 85)   near-white, faint warm tint
- `--surface` oklch(1 0 0) / #ffffff  raised cards, controls
- `--ink`     oklch(0.24 0.012 260) ≈ #1a1d21  body text
- `--muted`   oklch(0.52 0.01 260) ≈ #6b7280  secondary text (AA on bg)
- `--accent`  oklch(0.55 0.13 55) ≈ #b45309  amber, primary
- `--accent-soft` oklch(0.94 0.05 80) ≈ #fef3c7  accent tint (chips)
- `--border`  oklch(0.24 0.012 260 / 0.1)

### Dark
- `--bg`      oklch(0.21 0.01 260) ≈ #1a1d22
- `--surface` oklch(0.25 0.01 260) ≈ #1f2329
- `--ink`     oklch(0.93 0.005 260) ≈ #e8eaed
- `--muted`   oklch(0.70 0.01 260) ≈ #9aa0a6
- `--accent`  oklch(0.83 0.12 80) ≈ #fbbf24  amber, brightened for dark
- `--accent-soft` oklch(0.32 0.04 80) ≈ #3d3524
- `--border`  oklch(0.93 0.005 260 / 0.12)

Contrast: muted-on-bg clears 4.5:1 in both themes; accent is used for
large/bold or non-text signal, not small body copy on tinted grounds.

## Typography

- **UI**: system sans stack (`-apple-system, "Segoe UI", Roboto, …`).
  One family, weights 400/500/600. Fixed rem scale (product register),
  ratio ~1.2. No display face in labels or controls.
- **Khmer**: `"Khmer OS", "Noto Sans Khmer", "Khmer Sangam MN", "Khmer UI",
  "Leelawadee UI", sans-serif` — the popup's word stack, reused wherever
  Khmer script appears so the sample renders exactly as the real popup.
- **Mono**: `ui-monospace, monospace` for `<kbd>` shortcut keys only.

## Motion

150–200 ms, ease-out. Toggle knob slide, segmented-control thumb slide,
preview crossfade on theme change. State feedback only; no page-load
choreography. Full `prefers-reduced-motion: reduce` fallback (instant).

## Components

- **Toggle switch**: 40×22 track, accent when on, knob slides. `role`
  provided by native `<input type=checkbox>` (a11y for free).
- **Segmented control**: radio group styled as a pill with a sliding
  thumb; used for 3-option choices (theme, font size).
- **Setting row**: label + optional helper text on the left, control on
  the right; consistent height and vertical rhythm.
- **Live preview card**: a faithful mini-render of the lookup popup that
  reflects the current settings.
- **Shortcut key**: `<kbd>` chip, mono, subtle border.

## Layout

Single centered column, max ~600px. Controls grouped in one panel above
the fold; the live preview sits alongside/above them; reference material
(how-to, shortcuts, attribution) below. No sidebar — the surface is small.
