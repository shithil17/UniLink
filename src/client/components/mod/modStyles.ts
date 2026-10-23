/** Shared look for the mod screens, so every list reads the same. */

/** A flat panel: `surface`, radius 20 (24 from `md`), no border; rows carry their own hairlines. */
export const modPanel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

/** The page title, same size as every other screen. */
export const modTitle =
  "text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]";

/**
 * Row height: 60 on phones, 48 from `md`.
 * ceiling: this is the only place rows go below 60. Mod work is desktop-heavy and queues are long,
 * so denser rows pay off with a mouse. Revisit if mods report mis-taps on touch laptops or tablets.
 */
export const modRowMin = "min-h-[60px] md:min-h-12";

/** A hairline above every row but the first, on the `li` that wraps it. */
export const modRowLine = "border-t border-line first:border-t-0";
