import assert from "node:assert/strict";
import test from "node:test";
import { asArray, cloneData, getProperty, hasProperty, localize, makeError } from "../src/utils.js";

test("cloneData covers undefined, foundry, structuredClone, and JSON fallback", () => {
  assert.equal(cloneData(undefined), undefined);
  assert.deepEqual(cloneData({ a: 1 }, { foundry: { utils: { deepClone: (value) => ({ ...value, copied: true }) } } }), { a: 1, copied: true });
  assert.deepEqual(cloneData({ a: { b: 2 } }, { structuredClone }), { a: { b: 2 } });
  assert.deepEqual(cloneData({ a: 1 }, {}), { a: 1 });
});

test("asArray normalizes empty, single, and array values", () => {
  assert.deepEqual(asArray(undefined), []);
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray(["a"]), ["a"]);
  assert.deepEqual(asArray("a"), ["a"]);
});

test("property helpers read nested paths safely", () => {
  const source = { system: { hp: { value: 4 } }, empty: null };
  assert.equal(getProperty(source, ""), source);
  assert.equal(getProperty(source, "system.hp.value"), 4);
  assert.equal(getProperty({ "system.hp.value": 7 }, "system.hp.value"), 7);
  assert.equal(getProperty(null, "system.hp.value"), undefined);
  assert.equal(getProperty(source, "empty.value"), undefined);
  assert.equal(hasProperty(source, "system.hp.value"), true);
  assert.equal(hasProperty({ "system.hp.value": 7 }, "system.hp.value"), true);
  assert.equal(hasProperty(source, "system.hp.missing"), false);
});

test("localize uses Foundry i18n when present and fallback otherwise", () => {
  const env = { game: { i18n: { has: (key) => key === "known.key", localize: (key) => `loc:${key}` } } };
  assert.equal(localize("known.key", "Fallback", env), "loc:known.key");
  assert.equal(localize("missing.key", "Fallback", env), "Fallback");
});

test("makeError attaches details", () => {
  const error = makeError("Nope", { id: "x" });
  assert.equal(error.message, "Nope");
  assert.deepEqual(error.details, { id: "x" });
});
