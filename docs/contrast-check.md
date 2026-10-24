# Contrast check

Computed on 2026-10-24 from the hex values in `src/client/index.css` with the WCAG 2.x relative-luminance formula. The pairs and floors match `src/shared/contrast.test.ts`. Targets: body text 4.5:1; large text and control edges 3:1. Text on primary buttons, `brand-soft`, danger roles and every course hue uses the 4.5:1 floor.

**Result: all 23 checked pairs pass on all five palettes. No color changes were needed.**

To re-run after changing a palette, run `vp test contrast` and recompute the listed pairs from the palette hex values in `src/client/index.css`. Each cell is a contrast ratio; the final column gives the required minimum.

| Pair                            | Coral | Bordeaux | Cherry Blossom | Cherry Red | Night | Required |
| ------------------------------- | ----- | -------- | -------------- | ---------- | ----- | -------- |
| `ink` on `app`                  | 15.05 | 14.87    | 15.13          | 15.00      | 15.58 | 4.5:1    |
| `ink` on `surface`              | 16.54 | 16.54    | 16.54          | 16.54      | 14.05 | 4.5:1    |
| `soft` on `app`                 | 7.46  | 7.38     | 7.50           | 7.44       | 9.24  | 4.5:1    |
| `soft` on `surface`             | 8.20  | 8.20     | 8.20           | 8.20       | 8.33  | 4.5:1    |
| `soft` on `track`               | 6.58  | 6.58     | 6.58           | 6.58       | 6.63  | 4.5:1    |
| `faint` on `app`                | 5.33  | 5.27     | 5.36           | 5.31       | 6.22  | 4.5:1    |
| `faint` on `surface`            | 5.86  | 5.86     | 5.86           | 5.86       | 5.61  | 4.5:1    |
| `primary-foreground` on `brand` | 5.13  | 8.83     | 5.72           | 5.95       | 7.73  | 4.5:1    |
| `brand-ink` on `brand-soft`     | 5.92  | 8.31     | 6.15           | 6.24       | 8.57  | 4.5:1    |
| `brand-ink` on `surface`        | 6.92  | 10.36    | 7.39           | 7.57       | 9.62  | 4.5:1    |
| `brand` on `app`                | 4.67  | 7.94     | 5.23           | 5.39       | 7.84  | 3:1      |
| `edge` on `app`                 | 3.55  | 3.51     | 3.57           | 3.54       | 4.71  | 3:1      |
| `edge` on `surface`             | 3.91  | 3.91     | 3.91           | 3.91       | 4.25  | 3:1      |
| `danger` on `surface`           | 6.54  | 6.54     | 6.54           | 6.54       | 7.19  | 4.5:1    |
| `danger` on `danger-soft`       | 5.39  | 5.39     | 5.39           | 5.39       | 5.97  | 4.5:1    |
| `on-danger` on `danger`         | 6.54  | 6.54     | 6.54           | 6.54       | 8.00  | 4.5:1    |
| `app` on `ink` (toast)          | 15.05 | 14.87    | 15.13          | 15.00      | 15.58 | 4.5:1    |
| `mint-ink` on `mint`            | 5.56  | 5.56     | 5.56           | 5.56       | 7.80  | 4.5:1    |
| `sky-ink` on `sky`              | 6.88  | 6.88     | 6.88           | 6.88       | 7.32  | 4.5:1    |
| `lilac-ink` on `lilac`          | 6.80  | 6.80     | 6.80           | 6.80       | 7.24  | 4.5:1    |
| `butter-ink` on `butter`        | 5.64  | 5.64     | 5.64           | 5.64       | 8.26  | 4.5:1    |
| `peach-ink` on `peach`          | 5.73  | 5.73     | 5.73           | 5.73       | 7.84  | 4.5:1    |
| `rose-ink` on `rose`            | 6.53  | 6.53     | 6.53           | 6.53       | 7.32  | 4.5:1    |

Palette ids: `ocean` (Coral), `red-gradient` (Bordeaux), `cherry-blossom`, `cherry-red`, `night`.

Tightest passing margins: Bordeaux `edge` on `app` (3.51:1, 0.51 above 3:1); Cherry Red `edge` on `app` (3.54:1, 0.54 above 3:1); Coral `edge` on `app` (3.55:1, 0.55 above 3:1); Cherry Blossom `edge` on `app` (3.57:1, 0.57 above 3:1). Closest text pair is the course `mint-ink` on `mint` (5.56:1, 1.06 above 4.5:1) on all four day palettes.

Exception: Night `faint` on `track` is 4.46:1, below 4.5:1. It is only used in disabled controls, which are exempt; it is never used as ordinary text on `track`/`line`.

## Not covered here

A real-phone look in sunlight and at low brightness is still manual.
