---
name: UniLink
description: Pocket Planner, a friendly student planner with calm surfaces, course data color and quick motion
colors:
  app: "#f3f4f8"
  surface: "#ffffff"
  tint: "#f3f4f8"
  ink: "#1c1e2b"
  soft: "#4a4e63"
  faint: "#5f6479"
  line: "#e4e6ee"
  track: "#e4e6ee"
  edge: "#7b8097"
  brand: "#c4401a"
  brand-soft: "#ffe9df"
  brand-ink: "#a23412"
  primary-foreground: "#ffffff"
  danger: "#b3261e"
  on-danger: "#ffffff"
  danger-soft: "#fce4e1"
typography:
  big-figure: 40px
  title: 28px
  desktop-title: 32px
  sheet-title: 22px
  section: 18px
  body: 15px
  button: 15px
  label: 13px
  small: 12px
rounded:
  control: 12px
  row: 16px
  panel: 20px
  panel-desktop: 24px
  sheet: 28px
  full: 999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  12: 48px
elevation:
  float: "0 10px 30px -10px var(--float-color)"
  float-up: "0 -10px 30px -10px var(--float-color)"
---

# Design system: UniLink

## Overview

Pocket Planner is a friendly, tactile student planner. Neutral grounds and flat surfaces keep course information easy to scan. Each palette has one accent for actions and navigation; six softer hues identify course data. The wordmark is “UniLink” in text, without a logo mark or NSU branding.

## Colors

The default Coral palette is `ocean`; palette IDs are stable because saved choices use them. The four day palettes share neutral roles. Night is selected manually and does not follow the operating system.

| Palette        | ID               | Ground    | Accent    | Accent soft | Accent ink |
| -------------- | ---------------- | --------- | --------- | ----------- | ---------- |
| Coral          | `ocean`          | `#F3F4F8` | `#C4401A` | `#FFE9DF`   | `#A23412`  |
| Bordeaux       | `red-gradient`   | `#F5F2F4` | `#8C1F3D` | `#F6E1E7`   | `#7A1A35`  |
| Cherry Blossom | `cherry-blossom` | `#FAF3F6` | `#B53568` | `#FCE4EE`   | `#9A2A57`  |
| Cherry Red     | `cherry-red`     | `#F6F3F4` | `#C21F2F` | `#FDE3E5`   | `#A5192A`  |
| Night          | `night`          | `#14151C` | `#FF8A5C` | `#3E2118`   | `#FFB596`  |

`src/client/index.css` and `src/shared/themes.ts` define all palette roles. Day palettes share surface `#FFFFFF`, ink `#1C1E2B`, soft `#4A4E63`, faint `#5F6479`, line/track `#E4E6EE`, edge `#7B8097`; Night uses surface `#1D1F28`, ink `#ECEDF3`, soft `#B4B8CB`, faint `#9296AB`, line/track `#2D3040`, edge `#7C8196`. Danger, scrim, shadow tint and course hues are also palette tokens. Body text meets 4.5:1 contrast; large text and control edges meet 3:1.

Six course hues are data-only: mint, sky, lilac, butter, peach and rose. Their soft backgrounds and darker inks are defined in `index.css`, with Night-specific pairs. `courseHue(code)` deterministically assigns a hue; components set `data-hue` and use `bg-hue text-hue-ink`. Hues may mark course code chips, routine blocks and month dots, Home timeline blocks, course state marks in course context, and notification-kind icons. They never decorate app chrome or carry a state by themselves.

## Typography

Figtree variable (400–700) is the Latin face; Noto Sans Bengali Variable handles Bengali, followed by system sans. Body text is 15px/1.5 at weight 400, with tabular numerals. Bengali text uses Noto first. Inputs use 16px.

The fixed type scale is 12px small (1.2/600), 13px label (1.3/500), 15px body and button (body 1.5/400; button 1/600), 18px section (1.3/600), 22px sheet title (1.2/700), 28px title (1.15/700), 32px desktop title, and 40px figure (1/700, tracking -0.02em). Titles use -0.01em tracking. Keep sentence case and tabular figures.

## Elevation

Surfaces are flat. Only floating layers cast shadows: toast and floating tab bar use `0 10px 30px -10px var(--float-color)`; sheets use `0 -10px 30px -10px var(--float-color)`. Tiles, rows and course blocks have no shadow. An element does not combine a border and shadow.

## Components

- **Buttons:** 48px minimum height (44px small), 12px radius and 20px horizontal padding. Primary uses brand; secondary uses brand-soft/brand-ink; outline, ghost, destructive and link use their semantic tokens.
- **Fields:** 48px minimum height, 16px text, 14px horizontal padding, 12px radius and 1.5px edge. Focus uses a 3px brand outline; errors use danger and inline help.
- **Chips and badges:** pill shapes. Chips have a 40px minimum height and selected chips use brand-soft/brand-ink. Badges are at least 22px high with 12px text.
- **Panels and rows:** surface panels have 20px radius (24px on desktop). Rows have a 60px minimum height and 1px line separators; hover and pressed surfaces use tint.
- **Course states:** filled, hollow, struck and half-filled marks communicate done, available, locked and waived. Shape and accessible text carry meaning; color is supplementary.
- **Credit bar:** 14px rounded track with brand fill revealed by `clip-path`.
- **Navigation:** phones use a floating 68px pill tab bar with a moving brand-soft active pill. From `md`, navigation becomes a 240px left rail. Home expands to three columns from `xl`.
- **Routine:** day and Home blocks use 16px radius and course hues; week blocks use 10px radius. Month dates use 48px cells and small course dots.

## Motion

Curves are `--ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-ui-in-out: cubic-bezier(0.77, 0, 0.175, 1)` and `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. Built motion, checked in `src/client`:

| Motion                                           | Built behavior                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press (buttons, chips, rows, tabs, icon buttons) | `scale(.97)` (`.94` for icon buttons), 140ms ease-ui-out, active only.                                                                                                                                                                                                  |
| Segment thumb                                    | `translateX`, 220ms ease-ui-out.                                                                                                                                                                                                                                        |
| State mark fill                                  | scale `.9` to `1` plus opacity, 220ms ease-ui-out.                                                                                                                                                                                                                      |
| Tab pill                                         | `translateX`, 280ms ease-drawer.                                                                                                                                                                                                                                        |
| Switch thumb                                     | `translateX`, 180ms ease-ui-out.                                                                                                                                                                                                                                        |
| Sheet in/out and scrim                           | Sheet `translateY` plus opacity, 320ms ease-drawer; scrim opacity, 320ms ease-drawer.                                                                                                                                                                                   |
| Toast                                            | 300ms transform (ease-drawer) plus 200ms opacity (ease-ui-out).                                                                                                                                                                                                         |
| Top-level screen swap                            | Opacity only, 120ms ease-ui-out.                                                                                                                                                                                                                                        |
| List entrance                                    | `translateY(8px)` plus opacity, 320ms ease-ui-out; 50ms per row, capped at row 9, first visit only.                                                                                                                                                                     |
| Credit bar                                       | `clip-path`, 700ms ease-ui-out.                                                                                                                                                                                                                                         |
| Now marker                                       | `transform`, 900ms linear.                                                                                                                                                                                                                                              |
| Drag-to-dismiss                                  | Tracks the finger without transition; dismisses beyond 34% of sheet height or above 0.55px/ms. Otherwise settles with a damped spring (stiffness 420, damping ratio 0.65, about 0.07 bounce); upward drag uses `pow(d, .72)` capped at 28px; scrim fades with distance. |
| Hover                                            | Tailwind hover variants are gated to hover-capable pointers (`@media (hover: hover) and (pointer: fine)`).                                                                                                                                                              |

Reduced-motion variants checked in code:

- Sheets fade with opacity over 200ms instead of sliding; the scrim also uses a 200ms opacity fade.
- Toasts drop the translate.
- Tab pill and segment thumb jump to their destination.
- Press scale is off.
- State mark fill scale is off.
- List stagger keeps opacity only.
- Now marker, skeleton pulse, spinner and credit bar do not animate.
- Drag dismisses without following the transform.

## Do and Don't

**Do** use semantic theme tokens, keep one accent for actions, use hues only with course or notification data, preserve shape-coded course states, keep touch targets at least 44px, and check layouts on phone and desktop.

**Don't** use raw colors or Tailwind palette colors in components, gradients, glass, glows, backdrop blur, resting card shadows, `dark:` variants, color-only states, or shadows on elements with borders. Do not use color hues for app chrome.
