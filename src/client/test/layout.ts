import { page } from "vite-plus/test/browser/context";

/**
 * Chrome DevTools' portrait phone presets, narrowest first, plus 320 for the smallest Android phones.
 * Presets that share a width (the 412px Pixel 7, Galaxy S20 Ultra and A51) are listed once.
 */
export const PHONES = [
  { name: "small Android", width: 320, height: 640 },
  { name: "Galaxy Z Fold 5", width: 344, height: 882 },
  { name: "Galaxy S8+ and S23", width: 360, height: 780 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 12 Pro", width: 390, height: 844 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "iPhone XR", width: 414, height: 896 },
  { name: "iPhone 14 Pro Max", width: 430, height: 932 },
  { name: "Surface Duo", width: 540, height: 720 },
] as const;

export type Phone = (typeof PHONES)[number];

/** Sizes the test frame like the phone and waits for the web fonts, so text measures as it ships. */
export async function onPhone(phone: Phone) {
  await page.viewport(phone.width, phone.height);
  await document.fonts.ready;
}

function describe(el: Element) {
  const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
  const text = el.textContent?.trim().slice(0, 30) ?? "";
  return `<${el.tagName.toLowerCase()} class="${cls}"> "${text}"`;
}

/** True when an ancestor that is itself on screen clips the element, so the overflow never shows. */
function clipped(el: Element, width: number) {
  for (let up = el.parentElement; up; up = up.parentElement) {
    if (getComputedStyle(up).overflowX === "visible") continue;
    const box = up.getBoundingClientRect();
    if (box.left >= -0.5 && box.right <= width + 0.5) return true;
  }
  return false;
}

/**
 * What sticks out sideways: the page's scroll width when it is wider than the screen, then every
 * element whose box crosses the left or right edge without a clipping ancestor. Empty means the
 * screen neither scrolls sideways nor cuts anything off.
 */
export function sidewaysOverflow(root: Element = document.body): string[] {
  const width = document.documentElement.clientWidth;
  const problems: string[] = [];
  const scroll = document.documentElement.scrollWidth;
  if (scroll > width) problems.push(`page is ${scroll}px wide on a ${width}px screen`);
  for (const el of root.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    if (box.right <= width + 0.5 && box.left >= -0.5) continue;
    if (clipped(el, width)) continue;
    problems.push(`${describe(el)} spans ${Math.round(box.left)}..${Math.round(box.right)}px`);
  }
  return problems;
}
