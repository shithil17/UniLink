/** Longest link accepted. Room for a playlist or a query-string share URL, not for a pasted essay. */
export const RESOURCE_URL_MAX_LENGTH = 500;

/**
 * Hosts that only redirect somewhere else. A short link hides where it goes, so a requester could be
 * sent to a page they did not expect. A host matches itself and any subdomain of it, so `www.bit.ly`
 * is blocked and `notbit.ly` is not (the match is on whole labels, never a substring).
 *
 * ceiling: a short, hand-kept list of the common shorteners. Revisit if students report a legitimate
 * host blocked, or if a shortener that is not listed shows up in reports; adding a host is one line.
 */
export const URL_SHORTENER_HOSTS: readonly string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "ow.ly",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "tiny.cc",
  "s.id",
];

/** Names that never point at a public site: loopback, home and office networks, reserved test names. */
const NON_PUBLIC_SUFFIXES: readonly string[] = [
  "localhost",
  "local",
  "internal",
  "lan",
  "home.arpa",
  "test",
  "example",
  "invalid",
];

const onHost = (host: string, names: readonly string[]) =>
  names.some((n) => host === n || host.endsWith(`.${n}`));

/** Whether a (lowercased, punycode) hostname is a link shortener, itself or a subdomain of one. */
export const isUrlShortenerHost = (host: string): boolean => onHost(host, URL_SHORTENER_HOSTS);

/**
 * A public-looking DNS name: at least two labels, no trailing dot, not an IP literal (`URL` turns
 * `2130706433` and `0x7f.1` into dotted IPv4, so a numeric last label catches those too) and not a
 * reserved or private name.
 */
function isPublicHost(host: string): boolean {
  if (host.startsWith("[")) return false;
  const labels = host.split(".");
  if (labels.length < 2 || labels.some((l) => l === "")) return false;
  if (/^[0-9]+$/.test(labels[labels.length - 1])) return false;
  return !onHost(host, NON_PUBLIC_SUFFIXES);
}

export type ResourceUrlProblem = "invalid" | "shortener";

type Checked = { url: URL; problem: null } | { url: null; problem: ResourceUrlProblem };

const bad = (problem: ResourceUrlProblem): Checked => ({ url: null, problem });

function check(raw: string): Checked {
  const text = raw.trim();
  if (text.length === 0 || text.length > RESOURCE_URL_MAX_LENGTH) return bad("invalid");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return bad("invalid");
  }
  if (url.protocol !== "https:") return bad("invalid");
  if (url.username !== "" || url.password !== "" || url.port !== "") return bad("invalid");
  // `hostname` is already punycode for an international name, so a look-alike Unicode host shows as xn--.
  const host = url.hostname.toLowerCase();
  if (!isPublicHost(host)) return bad("invalid");
  if (isUrlShortenerHost(host)) return bad("shortener");
  return { url, problem: null };
}

/**
 * The parsed link when it is a safe https link, or null. Refuses `http` and every other scheme, a
 * username or password, a custom port, a host that is not a public DNS name and a link shortener.
 */
export const parseResourceUrl = (raw: string): URL | null => check(raw).url;

/** Why a link is refused, or null when it is fine. Lets a form tell a shortener from a bad link. */
export const resourceUrlProblem = (raw: string): ResourceUrlProblem | null => check(raw).problem;

export const isShareableResourceUrl = (raw: string): boolean => check(raw).url !== null;
