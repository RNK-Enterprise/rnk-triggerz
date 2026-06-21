import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_TYPES } from "../src/constants.js";
import { ConditionAdapter, makeEffectData } from "../src/ConditionAdapter.js";

function createActor() {
  const actor = {
    effects: [],
    created: [],
    deleted: [],
    async createEmbeddedDocuments(type, data) {
      this.created.push({ type, data });
      return data;
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.deleted.push({ type, ids });
      return ids;
    }
  };
  return actor;
}

test("makeEffectData builds stable ActiveEffect data", () => {
  assert.deepEqual(makeEffectData("burning", { id: "burning", name: "Burning", img: "burn.svg" }, { transfer: true }), {
    name: "Burning",
    img: "burn.svg",
    description: "",
    statuses: ["burning"],
    changes: [],
    disabled: false,
    transfer: true,
    flags: { "rnk-triggerz": { conditionId: "burning", source: "condition-adapter" } }
  });
  assert.equal(makeEffectData({ id: "cold", name: "Cold", img: "cold.svg", changes: [{ key: "x" }] }).name, "Cold");
  assert.equal(makeEffectData({ id: "cold", description: "Chilled" }).description, "Chilled");
  assert.equal(makeEffectData({ id: "status-name-only" }, { name: "Status Name" }).name, "Status Name");
  assert.equal(makeEffectData({ id: "id-only" }).name, "id-only");
  assert.equal(makeEffectData(null, { name: "Nameless", img: "named.svg" }, { transfer: false }).name, "Nameless");
  assert.equal(makeEffectData(null).name, undefined);
  assert.equal(makeEffectData({ id: "plain" }).img, "icons/svg/aura.svg");
});

test("ConditionAdapter resolves actors, statuses, and existing effects", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "stunned" }] } });
  const actor = { effects: [{ statuses: new Set(["stunned"]) }] };
  assert.equal(adapter.toActor({ actor }), actor);
  assert.equal(adapter.toActor(actor), actor);
  assert.deepEqual(adapter.getStatus("stunned"), { id: "stunned" });
  assert.equal(adapter.getStatus("missing"), undefined);
  assert.equal(new ConditionAdapter({ config: null }).getStatus("missing"), undefined);
  assert.equal(new ConditionAdapter({ config: {} }).getStatus("missing"), undefined);
  assert.equal(adapter.hasEffect(actor, "stunned"), true);
  assert.equal(adapter.hasEffect({ effects: [{ statuses: ["burning"] }] }, "burning"), true);
  assert.equal(adapter.hasEffect({ effects: [{ getFlag: () => "flagged" }] }, "flagged"), true);
  assert.equal(adapter.hasEffect({ effects: [{ statuses: [], getFlag: () => "other", name: "other" }] }, "missing"), false);
  assert.equal(adapter.hasEffect({ effects: [{ name: "named" }] }, "named"), true);
  assert.equal(adapter.hasEffect({ effects: [] }, "missing"), false);
});

test("ConditionAdapter applies through CSB toggleStatusEffect when status exists", async () => {
  const calls = [];
  const actor = { toggleStatusEffect: async (...args) => calls.push(args) };
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "stunned" }] } });
  await adapter.apply(actor, "stunned", { overlay: true });
  assert.deepEqual(calls, [["stunned", { active: true, overlay: true }]]);
});

test("ConditionAdapter applies fallback ActiveEffects and reports missing actors", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await assert.rejects(() => adapter.apply(null, "burning"), /No actor/);
  await assert.rejects(() => adapter.apply({}, "burning"), /cannot create/);
  const actor = createActor();
  await adapter.apply(actor, "burning");
  assert.equal(actor.created[0].type, "ActiveEffect");
  assert.equal(actor.created[0].data[0].name, "burning");
});

test("ConditionAdapter removes through toggle, fallback delete, and no-op path", async () => {
  const calls = [];
  const toggleActor = { toggleStatusEffect: async (...args) => calls.push(args) };
  const csbAdapter = new ConditionAdapter({ config: { statusEffects: [{ id: "stunned" }] } });
  await csbAdapter.remove(toggleActor, "stunned");
  assert.deepEqual(calls, [["stunned", { active: false, overlay: false }]]);

  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await assert.rejects(() => adapter.remove(null, "burning"), /No actor/);
  assert.deepEqual(await adapter.remove({ effects: [] }, "burning"), []);
  const actor = createActor();
  actor.effects = [{ id: "e1", statuses: ["burning"] }, { id: null, statuses: ["burning"] }];
  assert.deepEqual(await adapter.remove(actor, "burning"), ["e1"]);
});

test("ConditionAdapter toggles and runs actions", async () => {
  const actor = createActor();
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await adapter.toggle(actor, "burning");
  assert.equal(actor.created.length, 1);
  actor.effects = [{ id: "e1", name: "burning" }];
  await adapter.toggle(actor, "burning");
  assert.equal(actor.deleted.length, 1);

  await adapter.runAction(actor, { type: ACTION_TYPES.APPLY_CONDITION, condition: "a" });
  await adapter.runAction(actor, { type: ACTION_TYPES.REMOVE_CONDITION, condition: "a" });
  await adapter.runAction(actor, { type: ACTION_TYPES.TOGGLE_CONDITION, condition: "a" });
  const macroResult = await adapter.runAction(actor, { type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }, async (id, target) => ({ id, target }));
  assert.equal(macroResult.id, "m1");
  await assert.rejects(() => adapter.runAction(actor, { type: "bad" }), /Unknown trigger action/);
});

test("ConditionAdapter assigns and unassigns actor-specific conditions", async () => {
  const actor = {
    flags: {},
    setCalls: [],
    unsetCalls: [],
    getFlag(moduleId, key) {
      return this.flags[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.setCalls.push({ moduleId, key, value });
      this.flags[moduleId] ??= {};
      this.flags[moduleId][key] = value;
      return value;
    },
    async unsetFlag(moduleId, key) {
      this.unsetCalls.push({ moduleId, key });
      delete this.flags[moduleId]?.[key];
      return true;
    }
  };
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  assert.deepEqual(adapter.assignedConditionIds(actor), []);
  assert.deepEqual(await adapter.assign({ actor }, { id: "holyShield" }), ["holyShield"]);
  assert.deepEqual(await adapter.assign(actor, "holyShield"), ["holyShield"]);
  assert.deepEqual(await adapter.assign(actor, "burning"), ["holyShield", "burning"]);
  assert.deepEqual(adapter.assignedConditionIds(actor), ["holyShield", "burning"]);
  assert.deepEqual(await adapter.unassign(actor, "holyShield"), ["burning"]);
  assert.deepEqual(await adapter.unassign(actor, "burning"), []);
  assert.equal(actor.unsetCalls.length, 1);
  assert.deepEqual(adapter.assignedConditionIds({ flags: { "rnk-triggerz": { assignedConditions: ["fallback"] } } }), ["fallback"]);
  await assert.rejects(() => adapter.assign(null, "x"), /No actor/);
  await assert.rejects(() => adapter.assign({}, null), /requires an id/);
  await assert.rejects(() => adapter.assign({}, "x"), /cannot store/);
  await assert.rejects(() => adapter.unassign(null, "x"), /No actor/);
  await assert.rejects(() => adapter.unassign(actor, null), /requires an id/);
  await assert.rejects(() => adapter.unassign({}, "x"), /cannot store/);
});
