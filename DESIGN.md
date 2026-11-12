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

Pocket Planner is a friendly, tactile student planner. Neutral grounds and flat surfaces keep course information easy to scan. Each palette has one accent for actions and navigation; six softer hues identify course data. The wordmark is the UniLink mark (a U with a dot: the stem in ink, the dot in the palette accent, so it follows the theme) beside “UniLink” in text, with no NSU branding.

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

Dates are always day, month, year, the Bangladesh standard: "21 Oct", "Wed, 21 Oct", "19 - 25 Oct", "Wednesday, 21 October 2026", dd/mm/yyyy. Never month first, and never format dates with the `en-US` locale.

## Elevation

Surfaces are flat. Only floating layers cast shadows: toast and floating tab bar use `0 10px 30px -10px var(--float-color)`; sheets use `0 -10px 30px -10px var(--float-color)`. Tiles, rows and course blocks have no shadow. The phone tab bar slides away on scroll down and back on scroll up. An element does not combine a border and shadow.

## Components

- **Buttons:** 48px minimum height (44px small), 12px radius and 20px horizontal padding. Primary uses brand; secondary uses brand-soft/brand-ink; outline, ghost, destructive and link use their semantic tokens.
- **Fields:** 48px minimum height, 16px text, 14px horizontal padding, 12px radius and 1.5px edge. Focus uses a 3px brand outline; errors use danger and inline help.
- **Chips and badges:** pill shapes. Chips have a 40px minimum height and selected chips use brand-soft/brand-ink. Badges are at least 22px high with 12px text.
- **Panels and rows:** surface panels have 20px radius (24px on desktop). Rows have a 60px minimum height and 1px line separators; hover and pressed surfaces use tint.
- **Course states:** filled, hollow, struck and half-filled marks communicate done, available, locked and waived. Shape and accessible text carry meaning; color is supplementary.
- **Credit bar:** 14px rounded track with brand fill revealed by `clip-path`.
- **Navigation:** phones use a floating 68px pill tab bar with a moving brand-soft active pill. From `md`, navigation becomes a 240px left rail. Home expands to three columns from `xl`.
- **Maps:** the map is MapLibre, loaded on first use into its own chunk, drawn by our own style from the palette (`--app`, `--surface`, `--line`, `--edge`, `--ink`, `--soft`, `--faint`, `--brand`, plus the map-only `--map-water` and `--map-park`), so it follows every palette and Night. The look changes with zoom. **City zoom (up to about 12.5, where previews and the Map view sit) is a tonal poster** in the spirit of a printed map theme: one ground in the palette's own hue (`app` tinted a little towards `brand`; Night tints it towards the blue water tint, like a midnight-blue chart), water as the dominant shape in a deeper tone of that hue, parks a quiet tint, no buildings and no casings. Roads are tones of the same hue with a strong weight hierarchy: motorway, trunk and primary bold and the most accent-tinted, secondary and tertiary clearly thinner and quieter, minor streets very fine low-contrast hairlines. Light palettes take roads deeper towards the accent, Night paler towards `ink`. The tints are kept small so the accent pins, the dashed line and the count pills stay at 3:1 or better against the ground in every palette (a test checks it). **Street zoom (from about 15.5, where pins are placed and read) is a calmer, readable street map**: the water settles to the soft `--map-water` blue, roads become `surface` with a trace of the accent on the big ones, casings return, buildings and a few landmark labels appear. Everything between is interpolated by zoom, never switched. Place names (city, town, suburb, neighbourhood) and road names (motorway to minor, minor from zoom 15) stay on at every zoom up to 18, in Noto Sans (`name:en`, then `name:latin`, then `name`), with halos in the ground color and larger places placed first. Maps are held to the greater-Dhaka box, open on NSU at city zoom, and never rotate or tilt. The attribution ("© OpenStreetMap contributors", "OpenMapTiles") is always open on `surface` in `soft` text. A **preview** is a fixed-height panel (180px by default, panel radius) with a same-size skeleton, the map fading in by opacity only, no pan or zoom, one button over all of it and a 36px expand icon on `surface` top right. A **full-screen map** (`MapOverlay`) covers the phone viewport (tab bar included, safe areas respected) and is a centered dialog from `md`, 32px in from the edges with the 24px radius over a scrim; its controls are 44px round floating layers on `surface` with the floating shadow (close top left, zoom bottom right and hidden on touch, an actions slot above the zoom, attribution bottom left). It opens through a `map` search param, so Back, Escape, the scrim and the close button leave the same way. When the map cannot load, the panel says so in place. A full-screen map also takes a `footer` card along the bottom (floating, panel radius, the floating shadow); the attribution and the buttons ride on top of it, so nothing overlaps. **Ride markers** (`drawTrip`, redrawn after every palette restyle): the pickup is a filled accent pin with a light dot, the destination an outlined pin with a flag, both 36x44 with the tip on the point and a soft drop shadow; an end with no exact pin stands at its area's point as a 44px `brand-soft` circle (a dot for the pickup, a flag for the destination) with an "Around <Area>" pill under it, so an approximate place is never read as an exact one. The line between them is a 3px dashed accent curve (`arcLine`), never the road route. **Ride detail:** the map preview is the first panel under the title, above the facts, 180px in the phone sheet and 240px in the side panel, held as a same-size skeleton while the area list loads and absent when neither end has a point; it opens the ride map with both ends, the line, a card with the pickup and destination (area and landmark) and an "Open in Maps" outline button (Google Maps directions, new tab), plus a "Fit the ride" pill above the zoom. **Pin picker** (`PinPicker`): the pin is fixed at the centre (it lifts 6px while the map moves) and the student moves the map under it; it opens on the saved pin, else the area's point (street zoom), else NSU. A search slot floats beside the close button (the title shows until a search takes its place): `PlaceSearch`, a 44px `surface` pill with the floating shadow (16px text, a clear button once there is text) and a combobox list that opens over the map as a floating `surface` card, never pushing it. Our own area matches show first under an "Areas" label, then geocoder places under "Places", rows 48px with a 15px name and a 13px `soft` detail line, hairline-separated, the arrow-key row on `brand-soft`; a status row holds "Searching places" or "No places found". When place search fails, the areas show alone and one toast says so. The bottom bar holds the meeting-spot hint, an always-rendered status line ("Move the map to place the pin", "Pin placed. Tap Use this spot to keep it.", "Pinned. Move the map to change it."), a primary "Use this spot" and, when a pin exists, "Remove pin". A spot that was never moved off the opening centre is not a pin: "Use this spot" stays off (Enter toasts why) until the map has moved; a saved pin can always be confirmed again. Arrow keys move the map and Enter confirms. **Ride form:** under each landmark field a 60px `tint` row, "Pin the exact spot (optional)" with a chevron, or "Pinned" with Change and Remove ghost buttons (same height both ways). One trip preview is always rendered: 160px under the Destination group on phones (city view before any area), and from `lg` a sticky right column that fills the viewport height beside the fields; tapping it opens the full-screen trip map (the ride map's card without "Open in Maps"). A confirmed pin fills the nearest area into an empty area field and never replaces a picked one. **Map view** (`/rides?view=map`, Find a ride tab): a List / Map segmented control (two equal halves, full width on phones and 224px from `sm`, so switching never resizes it) sits in the filter bar under the search row; the filters apply to both views and the counts follow the vehicle, date and weekday filters. The map shows areas, never single rides: an accent **count pill** (`brand` with `primary-foreground` text, 32px high, number only, tabular figures, a 44px touch area, the floating shadow) stands at each area's point (`areaPointOf`) and is a real button labelled "Jatrabari, 6 rides" ("1 ride" for one). A selected pill flips to `ink` on `app` text, grows a little and carries a 2px `surface` outline, with `aria-pressed`, so the state is never color alone; pills are updated in place (a focused pill keeps focus) and redrawn after a palette restyle. A **Leaving from / Going to** switch floats top centre (a `surface` pill with the floating shadow, two equal halves, the chosen one on `brand-soft` and `brand-ink`). A line floating at the bottom is always rendered so nothing around it moves: "Loading counts", "No rides match", or the **"Not on the map: N rides"** chip (a 44px `surface` pill) for rides in areas with no point such as Outside Dhaka, which opens the list. **Below `lg`** Map opens a full-screen map (a pushed `view=map` history entry, so Back returns to the list): the close button top left, an icon-only 44px Filters button top right that opens the existing filter sheet raised above the map (z-70, over the map's z-60; sheets and pickers opened from it inherit that), and a tapped pill opens a `surface` card along the bottom ("Jatrabari: 6 rides leaving" or "arriving", a "Show these rides" button) whose button closes the map and shows the list with `from` (or `to`) set to that area. **From `lg`** the map takes the sticky right column in place of "Pick a ride to see the details", as tall as the column (`100dvh` less 4.5rem), interactive, with the switch top centre, a 44px expand button top right (the same map full screen through `?map=areas`, the column holding a skeleton meanwhile so only one map is live), the chip above the attribution and zoom: tapping a pill sets `from` (or `to`) and marks it selected, tapping it again clears the filter, opening a ride shows its detail in the column (the map is dropped meanwhile) and closing it brings the map back. The counts are fetched only while the map is shown (`keepPreviousData`, an error toasts).
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

## Layout stability and messages

Nothing on screen jumps because of a tap, a load or a refetch.

- **Messages are toasts.** Action results, errors and form validation go to a toast. Never insert a message, error line or status box into the page; it shifts the layout and is easy to miss off screen. An invalid submit toasts the first error (`toastFirstFieldError`) and focuses its field; `FieldError` is screen-reader only. Exceptions: a block that failed to load shows `ErrorBlock` in its own place, and moderation states use `StatusNote`.
- **Taps never move what's above or beside the control.** Filters, menus and extra detail open as a sheet or popover, or below the control.
- **Controls keep their width.** Button `loading` overlays the spinner on a hidden label; don't swap labels ("Saving..."). Chips are the same width pressed and unpressed. Counters use tabular figures.
- **Reserve status lines.** A line that appears with data or state (a count, a hint, "Found: ...") is always rendered, holding a placeholder or skeleton bar of the same height.
- **Refetches keep data.** Queries with changing keys (search, filters, a picked item) use `placeholderData: keepPreviousData` and mark the list `aria-busy`; they never empty to a skeleton.
- **Skeletons match the loaded layout**, including side columns at `xl` and row heights.
- **Fixed-size grids.** The month grid always has six weeks; one-line headings `truncate` instead of wrapping.
- `html` has `scrollbar-gutter: stable`, so a scrollbar appearing never shifts the page.

## Do and Don't

**Do** use semantic theme tokens, keep one accent for actions, use hues only with course or notification data, preserve shape-coded course states, keep touch targets at least 44px, and check layouts on phone and desktop.

**Don't** use raw colors or Tailwind palette colors in components, gradients, glass, glows, backdrop blur, resting card shadows, `dark:` variants, color-only states, or shadows on elements with borders. Do not use color hues for app chrome.
