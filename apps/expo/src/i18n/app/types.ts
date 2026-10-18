/**
 * Shape of the app interface catalogs.
 *
 * Every entry carries English, Spanish, and Simplified Chinese side by side,
 * so a key cannot ship without all three. A plural entry gives a `one` and an
 * `other` form; `translateApp` picks one from the `count` variable.
 */
import type { AppLanguage } from "../language";

export interface PluralPhrase {
  one: string;
  other: string;
}

export type Phrase = string | PluralPhrase;

export type CatalogEntry = Record<AppLanguage, Phrase>;

export type Catalog = Record<string, CatalogEntry>;
