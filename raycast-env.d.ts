/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Space URL - Address of the SilverBullet space, including the space path */
  "spaceUrl": string,
  /** API Token - A SilverBullet API token with read access to this space */
  "token": string,
  /** Max Results - Maximum number of results to show */
  "maxResults": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-wiki` command */
  export type SearchWiki = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-wiki` command */
  export type SearchWiki = {}
}

