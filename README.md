# SilverBullet Search

Search a [SilverBullet](https://silverbullet.md) wiki space from your launcher, and read the pages right there.

This is a Raycast-format extension. It runs in any launcher that can run Raycast extensions, such as [Tinycast](https://github.com/abue-ammar/tinycast), [Raycast](https://www.raycast.com/) or [SuperCmd](https://github.com/SuperCmdLabs/SuperCmd).

## What it does

- **Searches titles and text.** Pages whose title matches come first. Pages that only mention your words come next, with the matching line shown under the title. Every word you type must appear somewhere in the page.
- **Shows recent pages.** Before you type, it lists the most recently changed pages.
- **Shows the page in the launcher.** Press Enter to read the whole page. Links to other wiki pages open in your browser. Text in paragraphs and list items can be selected and copied.
- **Opens in the browser when you want.** Press ⌘O on a result, or choose Open in Browser from the actions (⌘K) on a page.
- **Answers instantly.** The first time you open it, it downloads the space's pages and keeps a copy on your Mac. Results appear as pages arrive, so you can type straight away. After that it opens from the saved copy and only downloads pages that changed. ⌘R checks for changes again.
- **Works offline.** If the wiki can't be reached, you search the saved copy and a message says it couldn't update.

SilverBullet's own `Library/` pages are left out.

### Send to Duet

A second command, **Send to Duet**, saves a quick note to your space. Type the note and press ⌘Enter. It becomes a new page named like SilverBullet's own Quick Note (Ctrl-q Ctrl-q), for example `Inbox/2026-11-24/14-05-09`, so both kinds of notes land in the same inbox. It only ever creates new pages and never overwrites or changes an existing one. If sending fails, your note stays in the form so you can try again.

## What you need

- A SilverBullet server reachable from your Mac.
- An API token for a user who can read the space you want to search. If you only search, a user with read-only access to that space is enough; to use Send to Duet, the user must be able to write to it. Don't use an admin token.

## Install

### Tinycast

1. In Tinycast, choose **Install from GitHub**.
2. Enter `kerim/raycast-silverbullet-search`.

Tinycast downloads and builds it for you. To update later, install from GitHub again.

### Raycast

```bash
git clone https://github.com/kerim/raycast-silverbullet-search.git
cd raycast-silverbullet-search
npm install
npm run dev
```

### Other launchers

If your launcher can install from GitHub, give it `kerim/raycast-silverbullet-search`. Otherwise build it as for Raycast and use your launcher's option for adding a local Raycast extension.

## Setup

The first time you run **Search Wiki**, it asks for:

- **Space URL** — the address of the space, including the space's path, for example `https://wiki.example.com/notes`. For a server with a single space, it's just the server's address.
- **API Token** — the token described above. It is kept in the macOS keychain.
- **Max Results** (optional) — how many results to show; 30 by default.

**Send to Duet** uses the same Space URL and API Token. For it to work, the token must belong to a user who can *write* to the space; with a read-only token, searching works but sending a note is turned down.

If the extension says the wiki turned down the token, check that you pasted SilverBullet's API token and not some other key. You can test a token in Terminal; `200` means it works:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer YOUR_TOKEN" https://wiki.example.com/notes/.fs
```

## Trying a local change in Tinycast

Tinycast has no "reload extension" command. To test changes you haven't pushed to GitHub, build into a folder, copy it into Tinycast's extensions folder, then quit and reopen Tinycast:

```bash
npx ray build -e dist -o build
mkdir -p ~/Library/Application\ Support/com.abueammar.tinycast/extensions/silverbullet-search
cp -R build/assets build/package.json build/search-wiki.js ~/Library/Application\ Support/com.abueammar.tinycast/extensions/silverbullet-search/
```

## Notes

- SilverBullet 2 has no search on the server, so the extension downloads the pages and searches them itself. That suits a personal wiki; a very large space makes the first download slow.
- The page view is read-only. Edit in SilverBullet.
- Tinycast doesn't let you select text in headings, or drag a selection across several list items.

## License

MIT
