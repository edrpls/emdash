---
"emdash": minor
"@emdash-cms/admin": minor
---

Fixes the taxonomy term picker to match across diacritic boundaries and adds opt-in `aliases` on terms.

Typing `Mexico` in the admin picker now surfaces a term labeled `México` instead of prompting a duplicate create. Input and term labels are folded via NFD decomposition + lowercase before substring-matching, so editors who type without diacritics — or with locale keyboards that produce precomposed vs. combining forms — still see the canonical term.

Taxonomy terms may also declare `aliases: string[]` — search-only synonyms indexed alongside the canonical label. Typing `USA` surfaces a term labeled `Estados Unidos` when that term declares the alias. Aliases never render as the canonical label; they only expand the picker's match surface.

Example seed snippet:

```json
{
  "name": "country",
  "terms": [
    {
      "slug": "estados-unidos",
      "label": "Estados Unidos",
      "aliases": ["USA", "United States", "EUA"]
    }
  ]
}
```

Aliases round-trip through the seed engine, the REST API (`POST/PUT /_emdash/api/taxonomies/:name/terms`), and term list/get responses. Terms without aliases behave exactly as before.
