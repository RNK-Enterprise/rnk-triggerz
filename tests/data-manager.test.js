import assert from "node:assert/strict";
import test from "node:test";
import { SETTING_KEYS } from "../src/constants.js";
import { DataManager, SETTING_DEFINITIONS } from "../src/DataManager.js";
import { createGame } from "./helpers.mjs";

test("DataManager requires Foundry settings", () => {
  assert.throws(() => new DataManager({ game: {} }).requireSettings(), /game.settings/);
});

test("DataManager can use global game defaults and settings without registry map", () => {
  const previous = globalThis.game;
  const registered = [];
  globalThis.game = {
    settings: {
      register(moduleId, key, definition) {
        registered.push({ moduleId, key, definition });
      },
      get() {
        return undefined;
      },
      async set(_moduleId, _key, value) {
        return value;
      }
    }
  };
  try {
    const store = new DataManager();
    assert.equal(store.registerSettings(), SETTING_DEFINITIONS.length);
    assert.equal(registered.length, SETTING_DEFINITIONS.length);
    assert.deepEqual(store.getTriggers(), []);
    assert.deepEqual(store.getConditions(), []);
  } finally {
    globalThis.game = previous;
  }
});

test("DataManager registers settings once and reads cloned defaults", () => {
  const game = createGame();
  const store = new DataManager({ game });
  assert.equal(store.registerSettings(), SETTING_DEFINITIONS.length);
  assert.equal(game.settings.calls.length, SETTING_DEFINITIONS.length);
  assert.equal(store.registerSettings(), SETTING_DEFINITIONS.length);
  assert.equal(game.settings.calls.length, SETTING_DEFINITIONS.length);
  const triggers = store.getTriggers();
  triggers.push({ id: "mutated" });
  assert.deepEqual(store.getTriggers(), []);
});

test("DataManager saves, exports, and imports trigger data", async () => {
  const game = createGame();
  const store = new DataManager({ game });
  store.registerSettings();
  await store.saveTriggers([{ id: "one" }]);
  await store.saveConditions([{ id: "bloodied" }]);
  assert.deepEqual(store.exportData(), {
    moduleId: "rnk-triggerz",
    triggers: [{ id: "one" }],
    conditions: [{ id: "bloodied" }]
  });
  await store.saveTriggers("bad");
  await store.saveConditions("bad");
  assert.deepEqual(store.get(SETTING_KEYS.TRIGGERS), []);
  assert.deepEqual(store.get(SETTING_KEYS.CONDITIONS), []);
  const imported = await store.importData({ triggers: [{ id: "two" }], conditions: [{ id: "stunned" }] });
  assert.equal(imported.triggers[0].id, "two");
  await store.importData(null);
  assert.deepEqual(store.getTriggers(), []);
  assert.deepEqual(store.getConditions(), []);
});

test("DataManager upserts and deletes configured data", async () => {
  const game = createGame();
  const store = new DataManager({ game });
  store.registerSettings();
  await assert.rejects(() => store.upsertTrigger({ path: "x" }), /Trigger requires an id/);
  await assert.rejects(() => store.upsertCondition({ name: "No ID" }), /Condition requires an id/);
  assert.deepEqual(await store.upsertTrigger({ id: "t1", path: "system.hp.value", value: 1 }), {
    id: "t1",
    path: "system.hp.value",
    value: 1
  });
  await store.upsertTrigger({ id: "t1", path: "system.hp.value", value: 2 });
  assert.deepEqual(store.getTriggers(), [{ id: "t1", path: "system.hp.value", value: 2 }]);
  assert.deepEqual(await store.deleteTrigger("t1"), []);
  assert.deepEqual(await store.upsertCondition({ id: "c1", name: "Cold" }), { id: "c1", name: "Cold" });
  await store.upsertCondition({ id: "c1", name: "Chilled" });
  assert.deepEqual(store.getConditions(), [{ id: "c1", name: "Chilled" }]);
  assert.deepEqual(await store.deleteCondition("c1"), []);
});
