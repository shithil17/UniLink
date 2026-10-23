# Contrast check

> **(2026-10-23)** These results are for the Quiet Utility roles. They are recomputed for the Pocket Planner roles and values (`build_plan_pocket_planner.md`) in PP10.

Covers the Phase 1 and Phase 4b checks. Computed from the hex values in `src/client/index.css` with the WCAG 2.x relative-luminance formula on 2026-10-20. Targets: body and small text 4.5:1, large text and control borders 3:1.

**Result: every pair on all five palettes passes. No change to `index.css` was needed.**

To re-run after changing a palette, recompute these pairs for the tokens named in the table (`ink`, `soft`, `faint`, `brand`, `danger`, `primary-foreground` on `app`, `surface`, `brand-soft` or `primary`; `edge` on `app` and `surface`).

Each cell is `ratio`. Needed: 4.5 except the Control border rows (3).

| Pair                                    | Coral | Bordeaux | Cherry Blossom | Cherry Red | Night |
| --------------------------------------- | ----- | -------- | -------------- | ---------- | ----- |
| `ink` on `app` (body)                   | 15.42 | 15.89    | 15.30          | 15.79      | 15.24 |
| `ink` on `surface` (body)               | 16.73 | 17.49    | 16.60          | 17.40      | 13.92 |
| `soft` on `app`                         | 7.78  | 9.02     | 8.88           | 7.50       | 9.75  |
| `faint` on `app`                        | 5.04  | 5.51     | 5.56           | 5.17       | 6.36  |
| `faint` on `surface`                    | 5.47  | 6.07     | 6.03           | 5.70       | 5.81  |
| `primary-foreground` on `primary`       | 5.73  | 8.10     | 6.99           | 5.41       | 8.97  |
| `ink` on `brand-soft`                   | 13.84 | 13.89    | 13.61          | 14.65      | 10.17 |
| `brand` on `brand-soft`                 | 4.74  | 6.43     | 5.73           | 4.56       | 5.76  |
| `brand` on `app` (accent text)          | 5.28  | 7.35     | 6.44           | 4.91       | 8.63  |
| `danger` on `app`                       | 6.02  | 5.97     | 6.06           | 5.97       | 7.93  |
| `edge` on `app` (control border, 3)     | 3.58  | 3.63     | 3.74           | 3.34       | 5.21  |
| `edge` on `surface` (control border, 3) | 3.89  | 4.00     | 4.06           | 3.68       | 4.76  |

Palette ids: `ocean`, `red-gradient` (shown as Bordeaux), `cherry-blossom`, `cherry-red`, `night`.

Tightest margins, worth watching if a color is nudged: Cherry Red `brand` on `brand-soft` (4.56 against 4.5), Coral `brand` on `brand-soft` (4.74), Cherry Red `edge` on `app` (3.34 against 3).

## Not covered here

The "text on the hero gradient" rows from the original Phase 1 item no longer apply: Phase 4b removed the hero gradient. A manual look at each palette on a real phone (sunlight, low brightness) is still D's to do.
