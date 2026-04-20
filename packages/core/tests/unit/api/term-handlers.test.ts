import type { Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
	handleTermCreate,
	handleTermList,
	handleTermUpdate,
} from "../../../src/api/handlers/taxonomies.js";
import type { Database } from "../../../src/database/types.js";
import { setupTestDatabase, teardownTestDatabase } from "../../utils/test-db.js";

/**
 * Exercises the taxonomy term handlers end-to-end against a real SQLite DB.
 *
 * Focus: the `aliases` round-trip. Aliases live inside the term's `data`
 * JSON column, so there's real surface area to regress — this suite covers
 * insert, read-back, partial update (must preserve description), and explicit
 * clearing. The matching logic itself is exercised in the admin package.
 */

async function seedTaxonomyDef(db: Kysely<Database>, name: string): Promise<void> {
	await db
		.insertInto("_emdash_taxonomy_defs")
		.values({
			id: `def-${name}`,
			name,
			label: name,
			label_singular: null,
			hierarchical: 0,
			collections: JSON.stringify(["posts"]),
		})
		.execute();
}

describe("term handlers: aliases", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		db = await setupTestDatabase();
		await seedTaxonomyDef(db, "country");
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("persists aliases on create and returns them in list", async () => {
		const created = await handleTermCreate(db, "country", {
			slug: "estados-unidos",
			label: "Estados Unidos",
			aliases: ["USA", "United States", "EUA"],
		});
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(created.data.term.aliases).toEqual(["USA", "United States", "EUA"]);

		const listed = await handleTermList(db, "country");
		expect(listed.success).toBe(true);
		if (!listed.success) return;
		const term = listed.data.terms.find((t) => t.slug === "estados-unidos");
		expect(term?.aliases).toEqual(["USA", "United States", "EUA"]);
	});

	it("omits aliases from the response when none are declared", async () => {
		await handleTermCreate(db, "country", { slug: "mx", label: "México" });

		const listed = await handleTermList(db, "country");
		expect(listed.success).toBe(true);
		if (!listed.success) return;
		const term = listed.data.terms.find((t) => t.slug === "mx");
		expect(term).toBeDefined();
		expect(term?.aliases).toBeUndefined();
	});

	it("preserves aliases when update only changes label", async () => {
		// Label-only update takes the early-exit merge branch — `data` is not
		// touched at all, so the prior `{description, aliases}` blob survives.
		await handleTermCreate(db, "country", {
			slug: "eu",
			label: "Estados Unidos",
			aliases: ["USA", "EUA"],
			description: "Also: United States",
		});

		const updated = await handleTermUpdate(db, "country", "eu", {
			label: "Estados Unidos de América",
		});
		expect(updated.success).toBe(true);
		if (!updated.success) return;
		expect(updated.data.term.aliases).toEqual(["USA", "EUA"]);
		expect(updated.data.term.description).toBe("Also: United States");
	});

	it("preserves aliases when update only changes description (merge branch)", async () => {
		// Description-only update takes the merge branch: mergedData must
		// carry forward the existing `aliases` key instead of clobbering
		// `data` with `{description}` only. This is the regression guard
		// for handleTermUpdate's merge logic — if that merge is deleted,
		// this assertion fails.
		await handleTermCreate(db, "country", {
			slug: "eu",
			label: "Estados Unidos",
			aliases: ["USA", "EUA"],
		});

		const updated = await handleTermUpdate(db, "country", "eu", {
			description: "Added later",
		});
		expect(updated.success).toBe(true);
		if (!updated.success) return;
		expect(updated.data.term.aliases).toEqual(["USA", "EUA"]);
		expect(updated.data.term.description).toBe("Added later");
	});

	it("updates aliases without clobbering description", async () => {
		await handleTermCreate(db, "country", {
			slug: "eu",
			label: "Estados Unidos",
			aliases: ["USA"],
			description: "Country code US",
		});

		const updated = await handleTermUpdate(db, "country", "eu", {
			aliases: ["USA", "United States", "EUA"],
		});
		expect(updated.success).toBe(true);
		if (!updated.success) return;
		expect(updated.data.term.aliases).toEqual(["USA", "United States", "EUA"]);
		expect(updated.data.term.description).toBe("Country code US");
	});

	it("clears aliases when passed an empty array", async () => {
		await handleTermCreate(db, "country", {
			slug: "eu",
			label: "Estados Unidos",
			aliases: ["USA"],
		});

		const updated = await handleTermUpdate(db, "country", "eu", { aliases: [] });
		expect(updated.success).toBe(true);
		if (!updated.success) return;
		// readAliases returns undefined for an empty list so the field is
		// elided from responses — matches "no aliases declared".
		expect(updated.data.term.aliases).toBeUndefined();
	});
});
