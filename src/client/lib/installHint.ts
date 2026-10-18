/** Pure decision logic for the one-time iOS "Add to Home Screen" hint. */

export const INSTALL_HINT_STORAGE_KEY = "unilink-ios-install-hint-dismissed";

// Browsers and in-app web views on iOS that carry "Safari" in the UA but cannot add to Home Screen the Safari way.
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Snapchat/i;

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

export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  return (
    isIos(userAgent, maxTouchPoints) && /Safari\//.test(userAgent) && !NOT_SAFARI.test(userAgent)
  );
}

export function shouldShowInstallHint(env: InstallHintEnv): boolean {
  return !env.standalone && !env.dismissed && isIosSafari(env.userAgent, env.maxTouchPoints);
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
