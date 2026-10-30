const ROADMAP_TIP_KEY = "unilink-roadmap-tip";

export function readRoadmapTipDone() {
  try {
    return localStorage.getItem(ROADMAP_TIP_KEY) === "done";
  } catch {
    return false;
  }
}

export function markRoadmapTipDone() {
  try {
    localStorage.setItem(ROADMAP_TIP_KEY, "done");
  } catch {
    // Private mode: the tip just shows again next visit.
  }
}
