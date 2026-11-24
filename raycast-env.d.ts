/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Space URL - Address of the SilverBullet space, including the space path */
  "spaceUrl": string,
  /** API Token - A SilverBullet API token for this space. Searching only needs read access; Send to Duet needs write access */
  "token": string,
  /** Max Results - Maximum number of results to show */
  "maxResults": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-wiki` command */
  export type SearchWiki = ExtensionPreferences & {}
  /** Preferences accessible in the `send-to-duet` command */
  export type SendToDuet = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-wiki` command */
  export type SearchWiki = {}
  /** Arguments passed to the `send-to-duet` command */
  export type SendToDuet = {}
}

