import { Cache } from "@raycast/api";

export interface WikiPage {
  /** File name in the space, e.g. "Courses/Anthro 101.md". */
  name: string;
  lastModified: number;
  content: string;
}

interface SBFile {
  name: string;
  lastModified: number;
}

export class WikiError extends Error {}

const CONCURRENCY = 6;
// Save partial downloads this often, so quitting halfway keeps what arrived.
const SAVE_EVERY = 25;

const cache = new Cache({ capacity: 100 * 1024 * 1024, namespace: "pages" });

export function normaliseBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function loadSavedPages(base: string): WikiPage[] {
  const raw = cache.get(base);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WikiPage[];
  } catch {
    return [];
  }
}

function savePages(base: string, pages: Map<string, WikiPage>) {
  cache.set(base, JSON.stringify([...pages.values()]));
}

function isPage(name: string): boolean {
  // Library/ holds SilverBullet's own system pages, not the user's notes.
  return name.endsWith(".md") && !name.startsWith("Library/");
}

async function request(
  url: string,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "X-Sync-Mode": "true" },
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new WikiError(`Couldn't reach ${new URL(url).host}.`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new WikiError(
      "The wiki turned down the API token. Check it in the extension preferences.",
    );
  }
  if (!response.ok) {
    throw new WikiError(
      `The wiki answered ${response.status} ${response.statusText}.`,
    );
  }
  return response;
}

/**
 * Brings the saved copy up to date: downloads new and changed pages, drops
 * deleted ones. `onUpdate` gets the current page list each time it changes.
 */
export async function syncPages(
  base: string,
  token: string,
  saved: WikiPage[],
  onUpdate: (pages: WikiPage[], remaining: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const listing = (await (
    await request(`${base}/.fs`, token, signal)
  ).json()) as SBFile[];
  const files = listing.filter((f) => isPage(f.name));
  const present = new Set(files.map((f) => f.name));

  const pages = new Map<string, WikiPage>();
  for (const page of saved) {
    if (present.has(page.name)) pages.set(page.name, page);
  }
  const stale = files.filter(
    (f) => pages.get(f.name)?.lastModified !== f.lastModified,
  );

  let remaining = stale.length;
  let sinceSave = 0;
  onUpdate([...pages.values()], remaining);

  let next = 0;
  async function worker() {
    while (next < stale.length) {
      const file = stale[next++];
      const content = await (
        await request(
          `${base}/.fs/${encodeURIComponent(file.name)}`,
          token,
          signal,
        )
      ).text();
      pages.set(file.name, {
        name: file.name,
        lastModified: file.lastModified,
        content,
      });
      remaining--;
      onUpdate([...pages.values()], remaining);
      if (++sinceSave >= SAVE_EVERY) {
        sinceSave = 0;
        savePages(base, pages);
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    // Keep whatever arrived, even if the download stopped part way.
    savePages(base, pages);
  }
}

export function pageTitle(name: string): string {
  return name.replace(/\.md$/, "");
}

export function pageUrl(base: string, name: string): string {
  return `${base}/${pageTitle(name).split("/").map(encodeURIComponent).join("/")}`;
}
