import { describe, it, expect } from "vitest";

import {
	foldForMatch,
	termExactMatches,
	termMatches,
	type MatchableTerm,
} from "../../src/lib/taxonomy-match.js";

/**
 * Tests for the admin picker matcher. The matcher is the sole gate between an
 * editor's typed input and the "Create new term" escape hatch, so every
 * branch has real user impact:
 *
 *   - accent-fold branch: `"Mexico"` must find `"México"` or editors create
 *     a duplicate term and fragment the taxonomy.
 *   - alias branch: `"USA"` must find `"Estados Unidos"` when that term
 *     declares the alias.
 *   - no-match branch: genuinely new terms must still offer Create.
 *   - exact-match branch: governs whether Create is suppressed, so an
 *     accent-insensitive exact match must count.
 */

const mexico: MatchableTerm = { label: "México" };
const estadosUnidos: MatchableTerm = {
	label: "Estados Unidos",
	aliases: ["USA", "United States", "EUA", "US"],
};

describe("foldForMatch", () => {
	it("folds diacritics and case to the same key", () => {
		expect(foldForMatch("México")).toBe("mexico");
		expect(foldForMatch("MEXICO")).toBe("mexico");
		expect(foldForMatch("méxico")).toBe("mexico");
	});

	it("handles empty input", () => {
		expect(foldForMatch("")).toBe("");
	});

	it("leaves non-accented characters unchanged", () => {
		expect(foldForMatch("USA")).toBe("usa");
		expect(foldForMatch("Hong Kong")).toBe("hong kong");
	});
});

describe("termMatches", () => {
	it("matches across the diacritic boundary (regression: Mexico/México)", () => {
		expect(termMatches(mexico, "Mexico")).toBe(true);
		expect(termMatches(mexico, "mexico")).toBe(true);
		expect(termMatches(mexico, "MEX")).toBe(true);
	});

	it("matches an accented term against an accented query too", () => {
		expect(termMatches(mexico, "México")).toBe(true);
		expect(termMatches(mexico, "méx")).toBe(true);
	});

	it("matches via aliases when the label does not", () => {
		expect(termMatches(estadosUnidos, "USA")).toBe(true);
		expect(termMatches(estadosUnidos, "united states")).toBe(true);
		expect(termMatches(estadosUnidos, "EUA")).toBe(true);
	});

	it("still matches the label when aliases are present", () => {
		expect(termMatches(estadosUnidos, "Estados")).toBe(true);
		expect(termMatches(estadosUnidos, "unidos")).toBe(true);
	});

	it("does not match genuinely unrelated input (Create button must still appear)", () => {
		expect(termMatches(mexico, "Japan")).toBe(false);
		expect(termMatches(estadosUnidos, "Canada")).toBe(false);
	});

	it("returns false for empty input so the dropdown stays closed", () => {
		expect(termMatches(mexico, "")).toBe(false);
	});

	it("rejects whitespace-only input even when term labels contain spaces", () => {
		// Regression guard: the label `"Estados Unidos"` contains a space,
		// so a naive `includes(needle)` without a whitespace guard would
		// match a needle of `"   "` and surface every multi-word term.
		expect(termMatches(estadosUnidos, "   ")).toBe(false);
		expect(termMatches({ label: "Hong Kong" }, " ")).toBe(false);
	});

	it("tolerates terms without an aliases field", () => {
		const term: MatchableTerm = { label: "Canadá" };
		expect(termMatches(term, "Canada")).toBe(true);
		expect(termMatches(term, "canada")).toBe(true);
	});

	it("tolerates a null aliases value without crashing", () => {
		const term: MatchableTerm = { label: "Brasil", aliases: null };
		expect(termMatches(term, "Brazil")).toBe(false);
		expect(termMatches(term, "brasil")).toBe(true);
	});

	it("ignores non-string entries inside the aliases array", () => {
		const term = { label: "Japón", aliases: ["Japan", 42, null] } as unknown as MatchableTerm;
		expect(termMatches(term, "Japan")).toBe(true);
		expect(termMatches(term, "japon")).toBe(true);
	});
});

describe("termExactMatches", () => {
	it("treats diacritic-only differences as equal (so Create stays hidden)", () => {
		expect(termExactMatches(mexico, "Mexico")).toBe(true);
		expect(termExactMatches(mexico, "México")).toBe(true);
	});

	it("treats an alias hit as equal (so Create stays hidden for USA -> Estados Unidos)", () => {
		expect(termExactMatches(estadosUnidos, "USA")).toBe(true);
		expect(termExactMatches(estadosUnidos, "United States")).toBe(true);
	});

	it("is stricter than termMatches — substrings do not count as exact", () => {
		expect(termExactMatches(estadosUnidos, "Estados")).toBe(false);
		expect(termExactMatches(mexico, "Mex")).toBe(false);
	});

	it("returns false for empty input", () => {
		expect(termExactMatches(mexico, "")).toBe(false);
	});
});
