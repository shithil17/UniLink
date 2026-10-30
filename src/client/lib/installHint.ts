/** Pure decision logic for the one-time iOS "Add to Home Screen" hint. */

export const INSTALL_HINT_STORAGE_KEY = "unilink-ios-install-hint-dismissed";

// iOS browsers other than Safari that can add to the Home Screen from their Share menu (iOS 16.4+).
const OTHER_INSTALLERS = /CriOS|FxiOS|EdgiOS/;

// In-app web views and browsers on iOS that carry "Safari" in the UA but cannot add to Home Screen.
const CANNOT_INSTALL = /OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Snapchat/i;

export type InstallHintEnv = {
  userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS 13+ reports a Mac user agent, so touch tells it apart. */
  maxTouchPoints?: number;
  /** `navigator.standalone` or the `display-mode: standalone` media query. */
  standalone: boolean;
  dismissed: boolean;
};

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** iOS version from an iPhone or iPad user agent ("OS 17_5"), or null for the iPadOS Mac UA. */
function iosVersion(userAgent: string): [number, number] | null {
  const match = / OS (\d+)_(\d+)/.exec(userAgent);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function canAddToHomeScreen(userAgent: string, maxTouchPoints = 0): boolean {
  if (!isIos(userAgent, maxTouchPoints) || !/Safari\//.test(userAgent)) return false;
  if (CANNOT_INSTALL.test(userAgent)) return false;
  if (!OTHER_INSTALLERS.test(userAgent)) return true;
  // Chrome, Firefox and Edge got Add to Home Screen in iOS 16.4.
  const version = iosVersion(userAgent);
  return version !== null && (version[0] > 16 || (version[0] === 16 && version[1] >= 4));
}

export function shouldShowInstallHint(env: InstallHintEnv): boolean {
  return !env.standalone && !env.dismissed && canAddToHomeScreen(env.userAgent, env.maxTouchPoints);
}

/** Storage can throw (private mode, blocked site data): treat that as "not dismissed". */
export function readDismissed(getStorage: () => Pick<Storage, "getItem"> = () => localStorage) {
  try {
    return getStorage().getItem(INSTALL_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveDismissed(getStorage: () => Pick<Storage, "setItem"> = () => localStorage) {
  try {
    getStorage().setItem(INSTALL_HINT_STORAGE_KEY, "1");
  } catch {
    // Nothing to do: the hint just shows again next launch.
  }
}

export function readInstallHintEnv(): InstallHintEnv {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
    dismissed: readDismissed(),
  };
}
