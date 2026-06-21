import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import {
  TriggerEngine,
  buildTriggerLabel,
  comparableValues,
  compareValues,
  coerceValue,
  createDefaultTrigger,
  evaluateTrigger,
  isNumericValue,
  linkedActionsForTrigger,
  normalizeTrigger,
  resolvePathValue,
  resolveTriggerRightValue,
  resolveUpdatePath
} from "../src/TriggerEngine.js";

const entity = { hasPlayerOwner: true, system: { hp: { value: 4, max: 10 } } };
const csbHpMax = 10;
const csbEntity = { hasPlayerOwner: true, system: { props: { HP: 4, HP_MAX: csbHpMax, midlife: csbHpMax / 2 } } };

test("trigger value helpers coerce and format values", () => {
  assert.equal(isNumericValue("5"), true);
  assert.equal(isNumericValue("abc"), false);
  assert.equal(isNumericValue(""), false);
  assert.equal(isNumericValue(null), false);
  assert.equal(isNumericValue(undefined), false);
  assert.deepEqual(comparableValues("4", "5"), [4, 5]);
  assert.deepEqual(comparableValues("abc", "5"), ["abc", "5"]);
  assert.equal(compareValues(OPERATORS.LTE, "4", "5"), true);
  assert.equal(compareValues(OPERATORS.LTE, "10", "5"), false);
  assert.equal(coerceValue("5", 1), 5);
  assert.equal(coerceValue("true", false), true);
  assert.equal(coerceValue("false", true), false);
  assert.equal(coerceValue("abc", "x"), "abc");
  assert.equal(resolvePathValue(entity, { "system.hp.max": 12 }, "system.hp.max"), 12);
  assert.equal(resolvePathValue(entity, {}, "system.hp.max"), 10);
  assert.equal(resolvePathValue(csbEntity, {}, "system.props.HP_MAX"), 10);
  assert.equal(resolvePathValue(csbEntity, {}, "system.props.midlife"), 5);
  assert.equal(resolveUpdatePath({ "system.props.HP": 4 }, "system.props.HP"), "system.props.HP");
  assert.equal(resolveUpdatePath({ "props.HP": 4 }, "system.props.HP"), "props.HP");
  assert.equal(resolveUpdatePath({ "props.HP": 4 }, "system.props.missing"), undefined);
  assert.equal(resolveUpdatePath({ "props.HP": 4 }, "actor.props.HP"), undefined);
  assert.equal(resolveTriggerRightValue({ value: "50%", comparePath: "system.hp.max" }, entity, 4), 5);
  assert.equal(resolveTriggerRightValue({ value: "50%", comparePath: "system.hp.max" }, entity, 4, { "system.hp.max": 12 }), 6);
  assert.equal(resolveTriggerRightValue({ value: "system.hp.max" }, entity, 4), 10);
  assert.equal(resolveTriggerRightValue({ value: "system.hp.max" }, entity, 4, { "system.hp.max": 12 }), 12);
  assert.equal(resolveTriggerRightValue({ value: "", comparePath: "system.hp.max" }, entity, 4), 10);
  assert.equal(resolveTriggerRightValue({ value: "", comparePath: "system.hp.max" }, entity, 4, { "system.hp.max": 12 }), 12);
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
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: "system.hp.max", operator: OPERATORS.LT }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: "", comparePath: "system.hp.max", operator: OPERATORS.LT }, entity, { system: { hp: { value: 4 } } }), true);
  assert.equal(evaluateTrigger({ id: "t", path: "system.hp.value", value: 4 }, entity, { "system.hp.value": 4 }), true);
  assert.equal(evaluateTrigger({ id: "csb", path: "system.props.HP", value: "system.props.midlife", operator: OPERATORS.LTE }, csbEntity, { "system.props.HP": 4 }), true);
  assert.equal(evaluateTrigger({ id: "csb-token", path: "system.props.HP", value: "system.props.midlife", operator: OPERATORS.GT }, csbEntity, { "props.HP": 6 }), true);
  assert.equal(evaluateTrigger({ id: "csb-high", path: "system.props.HP", value: "system.props.midlife", operator: OPERATORS.LTE }, csbEntity, { "system.props.HP": "10" }), false);
});

test("linkedActionsForTrigger maps condition apply and remove trigger ids", async () => {
  assert.deepEqual(linkedActionsForTrigger({ id: "hit" }, [
    { id: "apply", applyTriggerId: "hit" },
    { id: "remove", removeTriggerId: "hit" },
    { id: "both", applyTriggerId: "hit", removeTriggerId: "hit" },
    { id: "skip", applyTriggerId: "miss", removeTriggerId: "miss" },
    null
  ]), [
    { type: ACTION_TYPES.APPLY_CONDITION, condition: { id: "apply", applyTriggerId: "hit" } },
    { type: ACTION_TYPES.REMOVE_CONDITION, condition: { id: "remove", removeTriggerId: "hit" } },
    { type: ACTION_TYPES.APPLY_CONDITION, condition: { id: "both", applyTriggerId: "hit", removeTriggerId: "hit" } },
    { type: ACTION_TYPES.REMOVE_CONDITION, condition: { id: "both", applyTriggerId: "hit", removeTriggerId: "hit" } }
  ]);
  const actions = [];
  const engine = new TriggerEngine({
    adapter: {
      async runAction(target, action) {
        actions.push({ target, action });
      }
    }
  });
  await engine.processUpdate(entity, { system: { hp: { value: 4 } } }, [
    { id: "hit", path: "system.hp.value", value: 4, actions: [] }
  ], "target", [{ id: "cold", applyTriggerId: "hit" }, { id: "warm", removeTriggerId: "hit" }]);
  assert.deepEqual(actions.map((entry) => [entry.target, entry.action.type, entry.action.condition.id]), [
    ["target", ACTION_TYPES.APPLY_CONDITION, "cold"],
    ["target", ACTION_TYPES.REMOVE_CONDITION, "warm"]
  ]);
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
  const engine = new TriggerEngine({
    adapter,
    macroRunner: async (id) => actions.push({ macro: id }),
    conditionResolver: (condition) => (condition === "bloodied" ? { id: "bloodied", name: "Bloodied" } : undefined)
  });
  assert.deepEqual(engine.resolveAction({ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }), { type: ACTION_TYPES.RUN_MACRO, macroId: "m1" });
  assert.deepEqual(engine.resolveAction({ type: ACTION_TYPES.APPLY_CONDITION, condition: "bloodied" }).condition, { id: "bloodied", name: "Bloodied" });
  assert.deepEqual(engine.resolveAction({ type: ACTION_TYPES.APPLY_CONDITION, condition: "missing" }).condition, "missing");
  const triggers = [
    { id: "hit", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "bloodied" }] },
    { id: "miss", path: "system.hp.value", value: 9, actions: [{ type: ACTION_TYPES.REMOVE_CONDITION, condition: "bloodied" }] },
    { id: "macro", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }] }
  ];
  const matched = await engine.processUpdate(entity, { system: { hp: { value: 4 } } }, triggers);
  assert.deepEqual(matched.map((trigger) => trigger.id), ["hit", "macro"]);
  assert.equal(actions.length, 3);
  assert.deepEqual(actions[0].action.condition, { id: "bloodied", name: "Bloodied" });
});

test("TriggerEngine default macro runner is callable", async () => {
  const adapter = {
    async runAction(target, action, macroRunner) {
      return macroRunner(action.macroId, target);
    }
  };
  const engine = new TriggerEngine({ adapter });
  assert.equal(engine.resolveAction({ type: ACTION_TYPES.APPLY_CONDITION, condition: "plain" }).condition, "plain");
  const matched = await engine.processUpdate(entity, { system: { hp: { value: 4 } } }, [
    { id: "macro", path: "system.hp.value", value: 4, actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }] }
  ]);
  assert.equal(matched.length, 1);
});

test("createDefaultTrigger creates an apply-condition trigger", () => {
  const trigger = createDefaultTrigger("bloodied-at-half", "system.hp.value", 5, "bloodied");
  assert.equal(trigger.actions[0].type, ACTION_TYPES.APPLY_CONDITION);
});
