/**
 * Taxonomy term matching for the admin picker.
 *
 * The picker filters an editor's typed input against existing terms. A naive
 * `label.toLowerCase().includes(input.toLowerCase())` fails two common cases:
 *
 * 1. Accent mismatch — `"Mexico"` does not substring-match `"México"` because
 *    `"méxico".toLowerCase()` is still `"méxico"`. The editor then sees zero
 *    suggestions and creates a duplicate `"Mexico"` term alongside `"México"`.
 *
 * 2. Translation / abbreviation mismatch — `"USA"` does not match a term
 *    labeled `"Estados Unidos"`. Same duplicate outcome.
 *
 * This module folds diacritics via NFD decomposition and (optionally) consults
 * a per-term `aliases` list so the picker can index label + aliases without
 * ever surfacing aliases as the canonical label.
 *
 * No regexes are compiled from user input, so there is no ReDoS surface.
 */

const DIACRITIC_RANGE = /[\u0300-\u036f]/g;

/**
 * Case-fold + diacritic-fold normalization for substring matching.
 *
 * `"México"`, `"mexico"`, `"MÉXICO"` all collapse to `"mexico"`.
 *
 * Note: NFD decomposes accented characters into a base + combining-diacritic
 * sequence; the regex drops the combiners. Characters outside Latin
 * (Greek tonos, Arabic diacritics, etc.) are covered by the same block.
 */
export function foldForMatch(value: string): string {
	return value.normalize("NFD").replace(DIACRITIC_RANGE, "").toLowerCase();
}

/**
 * Minimal shape a term must have to participate in matching.
 * Kept structural so picker components and tests can use plain objects.
 */
export interface MatchableTerm {
	label: string;
	aliases?: string[] | null;
}

/**
 * True if `input` is a substring of the term's label or any of its aliases,
 * ignoring case and diacritics.
 *
 * Empty or whitespace-only input returns `false` — the caller decides
 * whether to show all terms or none in that state. The whitespace guard
 * matters: without it, a needle of `"   "` would `.includes()`-match every
 * term whose label contains a space.
 */
export function termMatches(term: MatchableTerm, input: string): boolean {
	const needle = foldForMatch(input).trim();
	if (!needle) return false;

	if (foldForMatch(term.label).includes(needle)) return true;

	if (term.aliases) {
		for (const alias of term.aliases) {
			if (typeof alias === "string" && foldForMatch(alias).includes(needle)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * True if `input` is an exact (fold-equal) match for the term's label or
 * any alias. Used to decide whether to show the "Create new term" button —
 * if an editor types `"Mexico"` and a term labeled `"México"` already
 * exists, Create must not appear or they'll produce a duplicate.
 */
export function termExactMatches(term: MatchableTerm, input: string): boolean {
	const needle = foldForMatch(input).trim();
	if (!needle) return false;

	if (foldForMatch(term.label).trim() === needle) return true;

	if (term.aliases) {
		for (const alias of term.aliases) {
			if (typeof alias === "string" && foldForMatch(alias).trim() === needle) {
				return true;
			}
		}
	}

	return false;
}
