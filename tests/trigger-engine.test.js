import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import {
  TriggerEngine,
  buildTriggerLabel,
  coerceValue,
  createDefaultTrigger,
  evaluateTrigger,
  normalizeTrigger,
  resolveTriggerRightValue
} from "../src/TriggerEngine.js";

const entity = { hasPlayerOwner: true, system: { hp: { value: 4, max: 10 } } };

test("trigger value helpers coerce and format values", () => {
  assert.equal(coerceValue("5", 1), 5);
  assert.equal(coerceValue("true", false), true);
  assert.equal(coerceValue("false", true), false);
  assert.equal(coerceValue("abc", "x"), "abc");
  assert.equal(resolveTriggerRightValue({ value: "50%", comparePath: "system.hp.max" }, entity, 4), 5);
  assert.equal(resolveTriggerRightValue({ value: undefined }, entity, "x"), "");
  assert.equal(buildTriggerLabel({ path: "system.hp.value", value: 0 }), "system.hp.value eq 0");
});

test("normalizeTrigger validates required fields and operators", () => {
  assert.throws(() => normalizeTrigger({ path: "x" }), /requires an id/);
  assert.throws(() => normalizeTrigger({ id: "x" }), /requires a path/);
  assert.throws(() => normalizeTrigger({ id: "x", path: "x", operator: "bad" }), /Unsupported/);
  assert.deepEqual(normalizeTrigger({ id: "x", path: "system.hp.value", value: 4, actions: { type: "noop" } }).actions, [{ type: "noop" }]);
});

test("evaluateTrigger handles ownership, missing updates, zero guards, and operators", () => {
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4, pcOnly: true }, { hasPlayerOwner: false }, { system: { hp: { value: 4 } } }), false);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4, npcOnly: true }, entity, { system: { hp: { value: 4 } } }), false);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4 }, entity, { system: { hp: {} } }), false);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 0, notZero: true }, entity, { system: { hp: { value: 0 } } }), false);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4 }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 5, operator: OPERATORS.NE }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 5, operator: OPERATORS.LT }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4, operator: OPERATORS.LTE }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 3, operator: OPERATORS.GT }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4, operator: OPERATORS.GTE }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: "50%", comparePath: "system.hp.max", operator: OPERATORS.LT }, entity, { system: { hp: { value: 4 } } }), true);
});

test("TriggerEngine executes matched actions only", async () => {
  const actions = [];
  const adapter = {
    async runAction(target, action, macroRunner) {
      actions.push({ target, action });
      if (action.type === ACTION_TYPES.RUN_MACRO) return macroRunner(action.macroId, target);
      return action;
    }
  };
  const engine = new TriggerEngine({ adapter, macroRunner: async (id) => actions.push({ macro: id }) });
  const triggers = [
    { id: "hit", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "bloodied" }] },
    { id: "miss", path: "system.hp.value", value: 9, actions: [{ type: ACTION_TYPES.REMOVE_CONDITION, condition: "bloodied" }] },
    { id: "macro", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }] }
  ];
  const matched = await engine.processUpdate(entity, { system: { hp: { value: 4 } } }, triggers);
  assert.deepEqual(matched.map((trigger) => trigger.id), ["hit", "macro"]);
  assert.equal(actions.length, 3);
});

test("TriggerEngine default macro runner is callable", async () => {
  const adapter = {
    async runAction(target, action, macroRunner) {
      return macroRunner(action.macroId, target);
    }
  };
  const engine = new TriggerEngine({ adapter });
  const matched = await engine.processUpdate(entity, { system: { hp: { value: 4 } } }, [
    { id: "macro", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }] }
  ]);
  assert.equal(matched.length, 1);
});

test("createDefaultTrigger creates an apply-condition trigger", () => {
  const trigger = createDefaultTrigger("bloodied-at-half", "system.hp.value", 5, "bloodied");
  assert.equal(trigger.actions[0].type, ACTION_TYPES.APPLY_CONDITION);
});
