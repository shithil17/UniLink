---
name: UniLink
description: Quiet Utility, a calm student companion where content leads and chrome nearly disappears
colors:
  app: "#f4f6f5"
  surface: "#ffffff"
  tint: "#ebf0ee"
  chip: "#e0ebe8"
  brand-soft: "#d9eeea"
  ink: "#14201e"
  soft: "#3d514e"
  faint: "#5b6d69"
  body: "#14201e"
  deep: "#14201e"
  line: "#e0e6e4"
  edge: "#74857f"
  brand: "#0e7367"
  primary: "#0e7367"
  primary-foreground: "#ffffff"
  danger: "#b3261e"
  bar: "#f4f6f5"
typography:
  figure:
    fontFamily: "Geist Variable, Noto Sans Bengali Variable, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    fontFeature: "tnum"
  headline:
    fontFamily: "Geist Variable, Noto Sans Bengali Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
  title:
    fontFamily: "Geist Variable, Noto Sans Bengali Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "Geist Variable, Noto Sans Bengali Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Geist Variable, Noto Sans Bengali Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  control: "6px"
  panel: "10px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.tint}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.tint}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "4px 12px"
  badge:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "16px"
  row-current:
    backgroundColor: "{colors.brand-soft}"
  credit-bar:
    backgroundColor: "{colors.tint}"
    rounded: "{rounded.full}"
    height: "4px"
  nav-tab:
    textColor: "{colors.soft}"
    height: "56px"
  nav-tab-active:
    textColor: "{colors.ink}"
---

# Design System: UniLink

## Overview

**Creative North Star: "Quiet Utility"**

UniLink is a calm productivity tool in the spirit of Linear or Things. A student opens it between classes to see where they stand, see what's next and act in one tap. Content sits first, chrome nearly disappears, and the one number or action that matters is shown plainly. Hierarchy comes from weight and spacing, not from color or decoration.

Screens are lists on plain surfaces separated by hairlines, not grids of cards. Density is moderate: generous whitespace around a few clear blocks, compact rows inside them. The look rejects loud hero banners, gradient headers, icon-tile grids and stacks of shadowed cards.

The app is unofficial and must look it: no NSU colors, crest or logo-like marks. The wordmark is the word "UniLink" set in the UI font, nothing else.

**Key Characteristics:**

- Neutral ground tinted toward each palette's hue, white (or one step lighter) panels, hairline dividers.
- One accent per palette, spent on the primary action, progress and the current row.
- Geist throughout, Noto Sans Bengali for Bangla, tabular figures for every number.
- Two radii only (control 6px, panel 10px).
- Flat at rest; only floating layers cast a shadow.
- Course states are printed shapes, never color alone.

## Colors

Five hand-picked palettes fill one shared set of roles; the frontmatter lists the default, Ocean Teal. The other four (Bordeaux `red-gradient`, Cherry Blossom `cherry-blossom`, Cherry Red `cherry-red`, Night `night`) override the same variables in `src/client/index.css`, which is the normative source for their values. Palette ids never change, because saved choices depend on them. Nothing follows the OS color scheme: Night is picked by hand in Settings like any other palette.

### Primary

- **Ocean Teal** (`brand`, also `primary`): the single accent. Fills the one primary button per screen, the credit bar, done and waived state marks, links and the keyboard focus outline.
- **Teal Wash** (`brand-soft`): a light accent fill for the selected or current row. Text on it must stay at 4.5:1.

### Neutral

- **Misted Ground** (`app`): the page background, tinted toward the palette hue. `bar` repeats it for `<meta name="theme-color">`.
- **Paper** (`surface`): panels, inputs, sheets, dialogs, popovers.
- **Hover Fill** (`tint`): hover and pressed fill on outline and ghost controls, disabled inputs, the credit bar track.
- **Secondary Fill** (`chip`): secondary buttons and quiet filled labels.
- **Ink** (`ink`, `body`): headings, key figures, active nav, running text. Never pure black.
- **Soft Ink** (`soft`): supporting text, inactive nav labels, descriptions.
- **Faint Ink** (`faint`): counts, metadata, locked state marks. Still passes 4.5:1 on `app`, `surface` and `tint`.
- **Hairline** (`line`): dividers between list rows and under section headers. Decorative only, never the sole edge of a control.
- **Control Edge** (`edge`): borders of inputs, outline buttons, badges and checkboxes, at least 3:1 against `app`, `surface`, `tint` and `brand-soft`.
- **Scrim** (`deep`): the 40% overlay behind sheets and dialogs and the tint of the float shadow. Always dark, even in Night.

### Status

- **Danger** (`danger`): field errors, invalid borders and destructive buttons. Nothing else.

### Named Rules

**The One Accent Rule.** Each screen spends `brand` on three things at most: the primary action, the progress bar and the current row. The eye lands on the only thing in color.

**The Color on Data Rule.** Color goes on data, state and the one primary action, never on chrome. Headers, nav and panels stay neutral.

**The Contrast Floor Rule.** Body text at least 4.5:1, large text and control edges at least 3:1, on every palette, including text on `primary` and on `brand-soft`. A palette that fails is fixed before it ships.

## Typography

**Body Font:** Geist Variable (with Noto Sans Bengali Variable, then sans-serif)

**Character:** One neutral, precise grotesque for everything. Noto Sans Bengali sits right after it in the stack and takes over for Bangla through `unicode-range`, so mixed-language posts read in a matched weight.

### Hierarchy

- **Figure** (600, 36px, tabular): the one large number on a summary panel, such as credits done.
- **Headline** (600, 20px): the page title, one per screen.
- **Title** (600, 16px): section headers and the wordmark.
- **Body** (400, 14px; inputs 16px on phones to stop iOS zoom): rows, descriptions, form text.
- **Label** (500, 12px): badges, bottom-tab labels, small metadata.

### Named Rules

**The Four Sizes Rule.** No screen uses more than four type sizes. Rank comes from weight (400, 500, 600) and spacing, not from another size.

**The Sentence Case Rule.** Headings and buttons are sentence case. Never all caps, never tracked-out labels.

**The Tabular Figures Rule.** Every number (credits, counts, grades, CGPA) uses `tabular-nums` and is right-aligned in rows. A real zero prints as `0`; a missing value prints as a faint dash.

## Layout

Mobile-first. One centered column capped at `max-w-6xl`, with 16px side padding on phones, 24px from `md` and 32px from `lg`. Forms and auth screens narrow to `max-w-sm`.

The shell is a slim 48px wordmark bar on phones (56px from `md`) on the `app` ground, with a hairline beneath. On phones the destinations sit in a fixed bottom tab bar (56px tall, safe-area padded) with an icon over a short label. From `md` up the same destinations move into the top bar as a plain row. Where a screen has a course-map sidebar, it sits beside the main column on desktop.

Spacing follows the 4px Tailwind scale. Rows use 8 to 12px gaps, blocks use 16 to 24px, and page sections 24 to 32px. Lists are one panel with `divide-y` hairlines, not separate cards.

Loading shows the final layout with flat placeholder bars. An error appears inside the block that failed, with a Retry, not as a page takeover.

## Elevation & Depth

Flat by default. Depth comes from the ground/surface step and hairlines, not from shadows. Panels never cast one.

### Shadow Vocabulary

- **Float** (`box-shadow: 0 8px 24px -6px color-mix(in oklab, var(--color-deep) 22%, transparent)`): sheets, dialogs, select popups and toasts only.

### Named Rules

**The Only Floaters Cast Shadows Rule.** A shadow means "this is above the page". Anything resting on the page is flat.

**The No Glass Rule.** No gradients, glass, glows or backdrop blur anywhere. Overlays use the `deep` scrim at 40%.

## Shapes

Two radii, decided once. Controls (buttons, inputs, selects, badges, checkboxes, menu items, focusable links) use a gentle 6px corner (`rounded-control`). Panels (cards, list panels, sheets, dialogs, select popups, toasts) use 10px (`rounded-panel`). The only exception is the 4px credit bar, which is fully rounded. Nothing sits in between.

Borders are 1px: `line` for dividers and panel outlines, `edge` for controls.

## Components

### Buttons

Restrained and solid, with one filled button per screen.

- **Shape:** gentle control corner (6px), 40px tall (`sm` 32px, `lg` 44px), 16px side padding, 14px medium label.
- **Primary:** `primary` fill with `primary-foreground` text. Hover mixes the fill 16% toward `ink`. It never fades through opacity, so the label keeps its contrast.
- **Outline:** `surface` fill, `edge` border, `ink` text, `tint` on hover.
- **Secondary:** `chip` fill, hover mixes 8% toward `ink`.
- **Ghost:** no fill, `tint` on hover.
- **Destructive:** `danger` fill, same hover mix as primary.
- **Link:** `brand` text, underline on hover.
- **Disabled:** 50% opacity, no pointer events.

### Focus

One keyboard-focus style for every interactive element: a solid 2px `brand` outline, offset 2px (`focusRing`). Inputs and selects, whose border already marks the edge, use the same outline with no offset and a `brand` border (`focusRingInset`). No soft glow rings.

### Inputs / Fields

- **Style:** `surface` fill, 1px `edge` border, 6px corner, 40px tall, 12px side padding.
- **Focus:** border and outline turn `brand`.
- **Error:** border and outline turn `danger`, with an inline message under the field.
- **Disabled:** `tint` fill at 60% opacity.

### Badges

Plain outline labels for states that are not course states (for example "Excluded"): 20px tall, 6px corner, `edge` border, 12px medium `ink` text.

### Panels and lists

- **Corner Style:** 10px.
- **Background:** `surface` on the `app` ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px `line`.
- **Internal Padding:** 16px (12px for the small size). Lists inside a panel separate rows with `line` hairlines; the current or selected row takes `brand-soft`.

### Section header

A sentence-case title (16px, 600, `ink`) with an optional count in 14px `faint` tabular figures and an optional action on the right, sitting over a `line` hairline.

### Navigation

Bottom tabs on phones, a plain top-bar row from `md`. Inactive tabs are `soft`; the active tab turns `ink` and semibold, never a colored pill or fill. A hidden bold copy of each label reserves its width so the row doesn't shift. Tabs inside screens use an underline rule in `ink` for the active one.

### State marks

The signature component. One printed vocabulary for course state, used everywhere a course appears, with an accessible label on every mark:

- **Filled circle** (`brand`): done.
- **Hollow ring** (`ink`): available.
- **Struck ring** (`faint`): locked.
- **Half-filled ring** (`brand`): waived.

Shape carries the state; color only reinforces it.

### Credit bar

A 4px fully rounded track in `tint` with a `brand` fill, exposed as a `progressbar`. It sits under the large credit figure on Home and once per category in the Courses header.

### Floating layers

Sheets, dialogs, select popups and toasts are `surface` panels with the 10px corner, a `line` border and the one float shadow, over a 40% `deep` scrim where they are modal. Toasts are for same-screen results only. Moderation states use a persistent `StatusNote`.

## Do's and Don'ts

### Do:

- **Do** use only theme token classes (`bg-app`, `bg-surface`, `text-ink`, `text-soft`, `text-faint`, `border-line`, `border-edge`, `bg-brand-soft`, `text-brand`, `text-danger`). Hex values live only in `src/client/index.css`.
- **Do** keep one filled primary button per screen.
- **Do** build lists as one hairline-divided panel.
- **Do** print course state with `StateMark`, with a label.
- **Do** right-align numbers in tabular figures; print `0` for zero and a faint dash for missing.
- **Do** give a new palette every role and pass the contrast floor before it ships.
- **Do** check new screens at 390px and 1440px on all five palettes.

### Don't:

- **Don't** use gradients, glass, glows, backdrop blur or resting shadows.
- **Don't** add a third radius.
- **Don't** mark the active tab or row with a colored pill; use weight and ink, or `brand-soft` for the current row.
- **Don't** carry a state by color alone.
- **Don't** use more than four type sizes per screen, all caps or tracked-out labels.
- **Don't** use `bg-white`, `text-white`, `bg-black`, Tailwind palette colors or `dark:` variants in components.
- **Don't** hover filled buttons with opacity.
- **Don't** use NSU colors, a crest or any logo-like mark.
