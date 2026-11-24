import {
  ActionPanel,
  Detail,
  Action,
  List,
  Icon,
  Keyboard,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { ReactElement, useEffect, useMemo, useState } from "react";
import {
  WikiError,
  WikiPage,
  loadSavedPages,
  normaliseBase,
  pageTitle,
  pageUrl,
  syncPages,
} from "./wiki";

interface Preferences {
  spaceUrl: string;
  token: string;
  maxResults?: string;
}

interface IndexedPage {
  page: WikiPage;
  title: string;
  lowerTitle: string;
  lowerContent: string;
}

interface Result {
  indexed: IndexedPage;
  rank: number;
  snippet?: string;
}

const DEFAULT_MAX_RESULTS = 30;

// The first line of the page that contains one of the words, trimmed to
// about 100 characters around the match.
function snippetFor(content: string, words: string[]): string | undefined {
  for (const line of content.split("\n")) {
    const lower = line.toLowerCase();
    const hit = words.map((w) => lower.indexOf(w)).find((i) => i >= 0);
    if (hit === undefined) continue;
    const clean = line.replace(/^\s*(?:[-*+]|\d+\.)?\s*(?:\[[ xX]\]\s*)?/, "");
    const offset = line.length - clean.length;
    const start = Math.max(0, hit - offset - 40);
    const piece = clean.slice(start, start + 100).trim();
    return (
      (start > 0 ? "…" : "") + piece + (start + 100 < clean.length ? "…" : "")
    );
  }
  return undefined;
}

// Every word must appear in the title or the text. Order: exact title, title
// starting with the text, all words in the title, then text-only matches.
function search(index: IndexedPage[], raw: string, max: number): Result[] {
  const text = raw.trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const results: Result[] = [];
  for (const indexed of index) {
    const { lowerTitle, lowerContent } = indexed;
    const lastSegment = lowerTitle.slice(lowerTitle.lastIndexOf("/") + 1);
    if (words.every((w) => lowerTitle.includes(w))) {
      const rank =
        lastSegment === text || lowerTitle === text
          ? 0
          : lastSegment.startsWith(text)
            ? 1
            : 2;
      results.push({ indexed, rank });
    } else if (
      words.every((w) => lowerTitle.includes(w) || lowerContent.includes(w))
    ) {
      const inText = words.filter((w) => !lowerTitle.includes(w));
      results.push({
        indexed,
        rank: 3,
        snippet: snippetFor(indexed.page.content, inText),
      });
    }
  }
  results.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.rank < 3
        ? a.indexed.title.length - b.indexed.title.length
        : b.indexed.page.lastModified - a.indexed.page.lastModified) ||
      a.indexed.title.localeCompare(b.indexed.title),
  );
  return results.slice(0, max);
}

// SilverBullet writes links as [[Page]] or [[Page|label]], which plain
// markdown doesn't understand; turn them into links to the page on the web.
// Frontmatter at the top is shown as a code block rather than as loose text.
function toDisplayMarkdown(base: string, content: string): string {
  const withLinks = content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, label?: string) => {
      const [pageName, anchor] = target.trim().split("#");
      const href =
        pageUrl(base, `${pageName}.md`) +
        (anchor ? `#${encodeURIComponent(anchor)}` : "");
      return `[${(label ?? target).trim()}](${href})`;
    },
  );
  const withFrontmatter = withLinks.replace(
    /^---\n([\s\S]*?)\n---\n/,
    (_, yaml: string) => "```yaml\n" + yaml + "\n```\n",
  );
  return selectableLists(withFrontmatter);
}

// Tinycast lets you select text in plain paragraphs but not in list items,
// and most wiki pages are outlines. So each list line becomes its own
// paragraph that still looks like a list: a drawn marker instead of "-",
// and blank-looking (non-space) characters for the nesting, which Tinycast
// would otherwise drop.
const INDENT = "⠀"; // braille blank: shows as space, isn't trimmed
const ZERO_WIDTH = "​"; // keeps "1." from being read as a list again

function selectableLists(markdown: string): string {
  let inFence = false;
  const out: string[] = [];
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    const item = inFence
      ? null
      : line.match(/^([ \t]*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/);
    if (!item) {
      out.push(line);
      continue;
    }
    const [, lead, marker, task, text] = item;
    const width = lead.replace(/\t/g, "    ").length;
    const indent = INDENT.repeat(Math.round(width / 2));
    const drawn = /\d/.test(marker) ? ZERO_WIDTH + marker : "•";
    const box = task === undefined ? "" : task === " " ? "☐ " : "☑ ";
    // Blank lines around it so Tinycast doesn't join it to its neighbours.
    out.push("", `${indent}${drawn} ${box}${text}`, "");
  }
  return out.join("\n");
}

function PageView(props: { base: string; page: WikiPage; url: string }) {
  const { base, page, url } = props;
  const title = pageTitle(page.name);
  return (
    <Detail
      navigationTitle={title}
      markdown={`# ${title}\n\n${toDisplayMarkdown(base, page.content)}`}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={url} />
          <Action.CopyToClipboard
            title="Copy Page Link"
            content={url}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action.CopyToClipboard
            title="Copy Page Text"
            content={page.content}
            shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function SearchWiki() {
  const preferences = getPreferenceValues<Preferences>();
  const base = normaliseBase(preferences.spaceUrl);
  // A pasted key often carries a stray space or line break.
  const token = preferences.token.trim();
  const parsedMax = parseInt(preferences.maxResults || "", 10);
  const maxResults = parsedMax > 0 ? parsedMax : DEFAULT_MAX_RESULTS;

  const [pages, setPages] = useState<WikiPage[]>(() => loadSavedPages(base));
  const [searchText, setSearchText] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Bring the saved copy up to date in the background. Searching works on
  // whatever is already here, so typing never waits for the wiki.
  useEffect(() => {
    const controller = new AbortController();
    const hadPages = pages.length > 0;
    setIsSyncing(true);
    setError(null);
    syncPages(
      base,
      token,
      pages,
      (updated, left) => {
        if (controller.signal.aborted) return;
        setPages(updated);
        setRemaining(left);
      },
      controller.signal,
    )
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof WikiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setError(message);
        if (hadPages) {
          showToast({
            style: Toast.Style.Failure,
            title: "Couldn't update from the wiki",
            message: `${message} Showing your saved copy.`,
          });
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsSyncing(false);
        setRemaining(null);
      });
    return () => controller.abort();
    // `pages` is read once per sync on purpose: it is the starting copy.
  }, [base, token, refreshCount]);

  const index = useMemo<IndexedPage[]>(
    () =>
      pages.map((page) => {
        const title = pageTitle(page.name);
        return {
          page,
          title,
          lowerTitle: title.toLowerCase(),
          lowerContent: page.content.toLowerCase(),
        };
      }),
    [pages],
  );

  const results = useMemo<Result[]>(() => {
    if (searchText.trim()) return search(index, searchText, maxResults);
    // No text yet: the most recently changed pages.
    return [...index]
      .sort((a, b) => b.page.lastModified - a.page.lastModified)
      .slice(0, maxResults)
      .map((indexed) => ({ indexed, rank: 0 }));
  }, [index, searchText, maxResults]);

  const preferencesAction = (
    <Action
      title="Open Extension Preferences"
      onAction={openExtensionPreferences}
      icon={Icon.Gear}
    />
  );
  const refreshAction = (
    <Action
      title="Update from Wiki"
      icon={Icon.ArrowClockwise}
      shortcut={Keyboard.Shortcut.Common.Refresh}
      onAction={() => setRefreshCount((n) => n + 1)}
    />
  );

  let emptyView: ReactElement | null = null;
  if (results.length === 0) {
    if (error && pages.length === 0) {
      emptyView = (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Couldn't load the wiki"
          description={error}
          actions={
            <ActionPanel>
              {refreshAction}
              {preferencesAction}
            </ActionPanel>
          }
        />
      );
    } else if (pages.length === 0) {
      emptyView = (
        <List.EmptyView
          icon={Icon.Download}
          title="Downloading your wiki…"
          description="Results will appear as pages arrive."
        />
      );
    } else {
      emptyView = (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No pages found"
          description={
            remaining
              ? `Nothing yet for "${searchText.trim()}". ${remaining} pages still downloading.`
              : `No pages matching "${searchText.trim()}"`
          }
          actions={<ActionPanel>{refreshAction}</ActionPanel>}
        />
      );
    }
  }

  const status =
    remaining && remaining > 0 ? `Downloading ${remaining} pages…` : undefined;

  return (
    <List
      isLoading={isSyncing}
      filtering={false}
      onSearchTextChange={setSearchText}
      navigationTitle={status ?? "Search Wiki"}
      searchBarPlaceholder={`Search ${base.replace(/^https?:\/\//, "")}…`}
    >
      {emptyView ?? (
        <List.Section
          title={searchText.trim() ? "Results" : "Recently changed"}
          subtitle={status}
        >
          {results.map(({ indexed, snippet }) => {
            const slash = indexed.title.lastIndexOf("/");
            const name = indexed.title.slice(slash + 1);
            const folder = slash >= 0 ? indexed.title.slice(0, slash) : "";
            const url = pageUrl(base, indexed.page.name);
            return (
              <List.Item
                key={indexed.page.name}
                title={name}
                subtitle={snippet}
                icon={Icon.Document}
                accessories={folder ? [{ text: folder }] : []}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Show Page"
                      icon={Icon.Eye}
                      target={
                        <PageView base={base} page={indexed.page} url={url} />
                      }
                    />
                    <Action.OpenInBrowser
                      title="Open in Browser"
                      url={url}
                      shortcut={Keyboard.Shortcut.Common.Open}
                    />
                    <Action.CopyToClipboard
                      title="Copy Page Link"
                      content={url}
                      shortcut={Keyboard.Shortcut.Common.Copy}
                    />
                    <Action.CopyToClipboard
                      title="Copy Page Name"
                      content={indexed.title}
                      shortcut={Keyboard.Shortcut.Common.CopyName}
                    />
                    {refreshAction}
                    {preferencesAction}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}
    </List>
  );
}
