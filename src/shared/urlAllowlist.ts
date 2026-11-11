/**
 * Hosts a shared resource link may point at: file-sharing services students already use for course
 * material. A host matches itself and any subdomain of it, so `www.dropbox.com` passes and
 * `drive.google.com.evil.io` does not (the match is on the whole host, never a substring).
 *
 * ceiling: links only, no file hosting. Revisit if students keep sharing from a service that is not
 * listed here; adding a host is one line.
 */
export const RESOURCE_URL_HOSTS: readonly string[] = [
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
  "onedrive.live.com",
  "1drv.ms",
  "mega.nz",
  "github.com",
];

/** Longest link accepted. A share link is a host and an id; anything longer is not one. */
export const RESOURCE_URL_MAX_LENGTH = 500;

/**
 * The parsed link when it is an `https` URL on the allowlist, or null. Refuses `http`, a username or
 * password in the URL, a custom port and a host that only contains an allowed name.
 */
export function parseResourceUrl(raw: string): URL | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > RESOURCE_URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "" || url.port !== "") return null;
  const host = url.hostname.toLowerCase();
  const allowed = RESOURCE_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return allowed ? url : null;
}

export const isAllowedResourceUrl = (raw: string): boolean => parseResourceUrl(raw) !== null;
