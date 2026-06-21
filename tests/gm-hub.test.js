import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import {
  buildEffectChanges,
  buildConditionPayload,
  buildTriggerPayload,
  getNamedElement,
  GMHubActions,
  readBoolean,
  readNumber,
  readText,
  slugifyId
} from "../src/windows/GMHubActions.js";
import {
  actorAssignedConditionIds,
  assignedConditionLabels,
  buildConditionOptions,
  buildGMHubContext,
  buildSelectedTokens,
  buildStatusOptions,
  cleanStatusLabel,
  summarizeCondition,
  summarizeTrigger,
  statusDisplayLabel
} from "../src/windows/GMHubContext.js";
import { bindGMHubEvents } from "../src/windows/GMHubEvents.js";
import { createGMHubWindowClass } from "../src/windows/GMHubWindow.js";
import { createButton } from "./helpers.mjs";

function createStore() {
  const state = {
    imported: null,
    triggers: [
      {
        id: "t1",
        name: "T1",
        path: "system.hp.value",
        operator: OPERATORS.LTE,
        value: "50%",
        actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "c1" }]
      }
    ],
    conditions: [{ id: "c1", name: "Cold", img: "cold.svg" }]
  };
  return {
    state,
    exportData: () => ({ moduleId: "rnk-triggerz", triggers: state.triggers, conditions: state.conditions }),
    getConditions: () => state.conditions,
    async importData(data) {
      state.imported = data;
      state.triggers = data.triggers;
      state.conditions = data.conditions;
      return data;
    },
    async upsertCondition(condition) {
      state.conditions = state.conditions.filter((existing) => existing.id !== condition.id);
      state.conditions.push(condition);
      return condition;
    },
    async deleteCondition(id) {
      state.conditions = state.conditions.filter((condition) => condition.id !== id);
      return state.conditions;
    },
    async upsertTrigger(trigger) {
      state.triggers = state.triggers.filter((existing) => existing.id !== trigger.id);
      state.triggers.push(trigger);
      return trigger;
    },
    async deleteTrigger(id) {
      state.triggers = state.triggers.filter((trigger) => trigger.id !== id);
      return state.triggers;
    }
  };
}

function createEnv({ isGM = true, selected = [{ id: "token", name: "Token", actor: { id: "actor" } }] } = {}) {
  const notifications = [];
  return {
    notifications,
    game: {
      system: { id: "custom-system-builder" },
      user: { isGM },
      i18n: {
        has: () => true,
        localize: (key) => ({ "EFFECT.StatusDead": "Dead" }[key] ?? `localized:${key}`)
      }
    },
    CONFIG: {
      statusEffects: [
        { id: "stunned", label: "Stunned", img: "stun.svg" },
        { id: "dead", name: "EFFECT.StatusDead", img: "dead.svg" },
        { id: "c1", name: "Cold Status", img: "cold-status.svg" }
      ]
    },
    canvas: { tokens: { controlled: selected } },
    ui: {
      notifications: {
        notify(type, message) {
          notifications.push([type, message]);
        },
        info(message) {
          this.notify("info", message);
        },
        warn(message) {
          this.notify("warn", message);
        },
        error(message) {
          this.notify("error", message);
        }
      }
    }
  };
}

function createForm(values = {}, checked = {}, namedItem = false) {
  const elements = {};
  for (const [name, value] of Object.entries(values)) elements[name] = { value };
  for (const [name, value] of Object.entries(checked)) elements[name] = { checked: value };
  return namedItem ? { elements: { namedItem: (name) => elements[name] } } : { elements };
}

function createSubmitTarget() {
  return {
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    submit() {
      return this.listeners.submit({
        currentTarget: this,
        preventDefault() {
          this.prevented = true;
        }
      });
    }
  };
}

test("GM hub context builds usable render data", () => {
  const env = createEnv({
    selected: [
      { id: "t1", name: "Named", actor: { getFlag: () => ["c1"] } },
      { document: { id: "t2", name: "Document Name" } },
      { actor: { id: "a1", name: "Actor Name" } },
      {}
    ]
  });
  const context = buildGMHubContext({ dataManager: createStore(), env });
  assert.equal(context.version, "1.0.0");
  assert.equal(context.moduleMode, "localized:RNKTRIGGERZ.GMHub.SystemAgnostic");
  assert.equal("systemId" in context, false);
  assert.equal(context.mode, "GM");
  assert.equal(buildGMHubContext({ dataManager: createStore(), env: createEnv({ isGM: false }) }).mode, "Player");
  assert.equal(context.triggerCount, 1);
  assert.equal(context.conditionCount, 1);
  assert.equal(context.selectedTokenCount, 4);
  assert.equal(context.selectedTokens[0].assignmentSummary, "Cold");
  assert.equal(context.triggers[0].actionSummary, "c1");
  assert.equal(context.conditions[0].label, "Cold");
  assert.equal(context.conditionOptions.some((option) => option.value === "stunned"), true);
  assert.equal(context.pathOptions[0].label.startsWith("localized:"), true);
  assert.equal(context.effectModeOptions[5].label.startsWith("localized:"), true);
  assert.equal(JSON.parse(context.exportJson).moduleId, "rnk-triggerz");
});

test("context helpers summarize statuses, conditions, triggers, and tokens", () => {
  const env = createEnv();
  assert.deepEqual(cleanStatusLabel("EFFECT.StatusUnconscious"), "Unconscious");
  assert.deepEqual(cleanStatusLabel("custom-status_name"), "custom status name");
  assert.deepEqual(cleanStatusLabel("Status"), "Status");
  assert.deepEqual(cleanStatusLabel(null), "");
  assert.equal(statusDisplayLabel({ name: "EFFECT.StatusDead" }, env), "Dead");
  assert.equal(statusDisplayLabel({ name: "EFFECT. Status Dead" }, env), "Status Dead");
  assert.equal(statusDisplayLabel({ name: "EFFECT.StatusUnconscious" }, { game: { i18n: { has: () => false } } }), "Unconscious");
  assert.equal(statusDisplayLabel({ name: "EFFECT.StatusProne" }, { game: { i18n: { has: () => true, localize: (key) => key } } }), "Prone");
  assert.equal(statusDisplayLabel({ label: "Already Clean" }, env), "Already Clean");
  assert.equal(statusDisplayLabel({ id: "id-only" }, env), "id only");
  assert.equal(statusDisplayLabel({}, env), "");
  assert.deepEqual(buildStatusOptions(env), [
    { value: "c1", label: "Cold Status", img: "cold-status.svg" },
    { value: "dead", label: "Dead", img: "dead.svg" },
    { value: "stunned", label: "Stunned", img: "stun.svg" }
  ]);
  const previousConfig = globalThis.CONFIG;
  globalThis.CONFIG = { statusEffects: [{ id: "default", name: "DefaultStatus" }] };
  try {
    assert.deepEqual(buildStatusOptions(), [{ value: "default", label: "Default Status", img: undefined }]);
  } finally {
    globalThis.CONFIG = previousConfig;
  }
  assert.deepEqual(buildStatusOptions({ CONFIG: { statusEffects: [{ id: "plain" }] } }), [{ value: "plain", label: "plain", img: undefined }]);
  assert.deepEqual(buildStatusOptions({ CONFIG: {} }), []);
  assert.deepEqual(buildConditionOptions([{ id: "c1", name: "Cold" }], buildStatusOptions(env)), [
    { value: "c1", label: "Cold", source: "saved" },
    { value: "dead", label: "Dead", source: "status" },
    { value: "stunned", label: "Stunned", source: "status" }
  ]);
  assert.deepEqual(buildConditionOptions([{ id: "plain" }], []), [{ value: "plain", label: "plain", source: "saved" }]);
  assert.equal(summarizeTrigger({ id: "empty", path: "x", operator: "eq", value: 1 }).actionSummary, "No actions");
  assert.equal(summarizeTrigger({ id: "labeled", label: "Existing Label", actions: [{ type: "customAction" }] }).label, "Existing Label");
  assert.equal(summarizeTrigger({ id: "typed", path: "x", operator: "eq", value: 1, actions: [{ type: "customAction" }] }).actionSummary, "customAction");
  assert.equal(summarizeTrigger({ id: "macro", path: "x", operator: "eq", value: 1, actions: [{ type: "runMacro", macroId: "m1" }] }).actionSummary, "m1");
  assert.deepEqual(summarizeCondition({ id: "plain" }), {
    id: "plain",
    label: "plain",
    img: "icons/svg/aura.svg",
    description: "",
    changeSummary: "No changes"
  });
  assert.equal(summarizeCondition({ id: "one", changes: [{ key: "x" }] }).changeSummary, "1 change");
  assert.equal(summarizeCondition({ id: "two", description: "Two changes", changes: [{ key: "x" }, { key: "y" }] }).changeSummary, "2 changes");
  assert.deepEqual(actorAssignedConditionIds({ getFlag: () => ["dead"] }), ["dead"]);
  assert.deepEqual(actorAssignedConditionIds({ flags: { "rnk-triggerz": { assignedConditions: ["stunned"] } } }), ["stunned"]);
  assert.deepEqual(actorAssignedConditionIds({}), []);
  assert.deepEqual(assignedConditionLabels(["c1", "missing"], [{ value: "c1", label: "Cold" }]), ["Cold", "missing"]);
  assert.equal(buildSelectedTokens({ canvas: { tokens: { controlled: [{ document: { id: "d1" } }] } } })[0].name, "Unknown token");
  assert.equal(buildSelectedTokens({
    canvas: { tokens: { controlled: [{ name: "Assigned", actor: { flags: { "rnk-triggerz": { assignedConditions: ["stunned"] } } } }] } }
  }, [{ value: "stunned", label: "Stunned" }])[0].assignmentSummary, "Stunned");
  assert.deepEqual(buildSelectedTokens({}), []);
});

test("form helpers parse builder inputs", () => {
  assert.equal(slugifyId(" Bloodied at 50%! "), "bloodied-at-50");
  assert.equal(slugifyId(null), "");
  assert.equal(getNamedElement(createForm({ x: "a" }), "x").value, "a");
  assert.equal(getNamedElement({ x: { value: "direct" } }, "x").value, "direct");
  assert.equal(readText(createForm({ x: "  a  " }, {}, true), "x"), "a");
  assert.equal(readText({}, "missing"), "");
  assert.equal(readBoolean(createForm({}, { check: true }), "check"), true);
  assert.equal(readBoolean(createForm({}, { check: false }), "check"), false);
  assert.equal(readBoolean({}, "check"), false);
  assert.equal(readNumber(createForm({ x: "5" }), "x", 20), 5);
  assert.equal(readNumber(createForm({ x: "bad" }), "x", 20), 20);
  assert.deepEqual(buildEffectChanges(createForm({
    changeKey1: "system.bonus",
    changeMode1: "2",
    changeValue1: "3",
    changePriority1: "25",
    changeKey2: "",
    changeKey3: "system.flag",
    changeMode3: "bad",
    changeValue3: "true",
    changePriority3: "bad"
  })), [
    { key: "system.bonus", mode: 2, value: "3", priority: 25 },
    { key: "system.flag", mode: 0, value: "true", priority: 20 }
  ]);
  assert.deepEqual(buildConditionPayload(createForm({ statusId: "stunned" }, {}, true), { id: "stunned", name: "Stunned", img: "stun.svg" }), {
    id: "stunned",
    name: "Stunned",
    img: "stun.svg",
    description: "",
    changes: [],
    homebrew: false
  });
  assert.deepEqual(buildConditionPayload(createForm({
    conditionId: "custom",
    conditionName: "Custom",
    conditionImg: "custom.svg",
    conditionDescription: "Custom condition",
    changeKey1: "system.rank",
    changeMode1: "5",
    changeValue1: "elite",
    changePriority1: "30"
  }), undefined), {
    id: "custom",
    name: "Custom",
    img: "custom.svg",
    description: "Custom condition",
    changes: [{ key: "system.rank", mode: 5, value: "elite", priority: 30 }],
    homebrew: true
  });
  assert.deepEqual(buildConditionPayload(createForm({ statusId: "labeled" }), { id: "labeled", label: "Labeled" }), {
    id: "labeled",
    name: "Labeled",
    img: "icons/svg/aura.svg",
    description: "",
    changes: [],
    homebrew: false
  });
  assert.deepEqual(buildConditionPayload(createForm({ conditionId: "fallback" }), undefined), {
    id: "fallback",
    name: "fallback",
    img: "icons/svg/aura.svg",
    description: "",
    changes: [],
    homebrew: true
  });
});

test("buildTriggerPayload supports condition actions, macro actions, and generated ids", () => {
  const macro = buildTriggerPayload(
    createForm(
      {
        triggerName: "Macro Trigger",
        triggerId: "macro-id",
        triggerPathCustom: "system.hp.value",
        operator: OPERATORS.LT,
        value: "5",
        actionType: ACTION_TYPES.RUN_MACRO,
        macroId: "macro-1",
        comparePath: "system.hp.max",
        scope: "pc"
      },
      { notZero: true }
    )
  );
  assert.equal(macro.id, "macro-id");
  assert.equal(macro.pcOnly, true);
  assert.equal(macro.notZero, true);
  assert.equal(macro.comparePath, "system.hp.max");
  assert.deepEqual(macro.actions, [{ type: ACTION_TYPES.RUN_MACRO, macroId: "macro-1" }]);

  const condition = buildTriggerPayload(createForm({
    triggerPath: "system.health.value",
    operator: OPERATORS.GTE,
    value: "1",
    actionType: ACTION_TYPES.TOGGLE_CONDITION,
    actionCondition: "stunned",
    scope: "npc"
  }));
  assert.equal(condition.id, "system-health-value-gte-1-togglecondition");
  assert.equal(condition.name, "system-health-value");
  assert.equal(condition.npcOnly, true);
  assert.deepEqual(condition.actions, [{ type: ACTION_TYPES.TOGGLE_CONDITION, condition: "stunned" }]);

  const defaults = buildTriggerPayload(createForm({ triggerPath: "system.hp.value" }));
  assert.equal(defaults.operator, OPERATORS.EQ);
  assert.equal(defaults.actions[0].type, ACTION_TYPES.APPLY_CONDITION);
});

test("GMHubActions exports, imports, saves, deletes, and refreshes", async () => {
  const store = createStore();
  const env = createEnv();
  const renders = [];
  const actions = new GMHubActions({
    dataManager: store,
    uiManager: { renderOpenWindows: () => renders.push("render") },
    env
  });
  assert.equal(new GMHubActions({ dataManager: store, uiManager: { renderOpenWindows: () => false }, env: {} }).notify("info", "missing.key", "fallback"), "fallback");
  const textarea = { value: "" };
  const exported = actions.exportToTextarea(textarea);
  assert.equal(textarea.value, exported);
  textarea.value = JSON.stringify({ triggers: [{ id: "new", path: "system.hp.value", value: 1 }], conditions: [] });
  assert.deepEqual(await actions.importFromTextarea(textarea), {
    triggers: [{ id: "new", path: "system.hp.value", value: 1 }],
    conditions: []
  });
  textarea.value = "{bad";
  assert.equal(await actions.importFromTextarea(textarea), null);
  assert.equal(actions.refresh(), 2);
  assert.equal(await actions.saveConditionFromForm(createForm({})), null);
  assert.equal((await actions.saveConditionFromForm(createForm({ conditionId: "burning" }))).id, "burning");
  assert.equal((await actions.deleteCondition("burning")).some((condition) => condition.id === "burning"), false);
  assert.equal(await actions.deleteCondition(""), null);
  assert.equal(await actions.saveTriggerFromForm(createForm({ actionCondition: "c1" })), null);
  assert.equal(await actions.saveTriggerFromForm(createForm({ triggerPath: "system.hp.value", actionType: ACTION_TYPES.RUN_MACRO })), null);
  assert.equal(await actions.saveTriggerFromForm(createForm({ triggerPath: "system.hp.value", actionType: ACTION_TYPES.APPLY_CONDITION })), null);
  assert.equal((await actions.saveTriggerFromForm(createForm({ triggerPath: "system.hp.value", value: "0", actionCondition: "c1" }))).path, "system.hp.value");
  assert.equal((await actions.saveTriggerFromForm(createForm({ triggerPath: "system.hp.value", actionType: ACTION_TYPES.RUN_MACRO, macroId: "m1" }))).actions[0].macroId, "m1");
  assert.equal((await actions.deleteTrigger("new")).some((trigger) => trigger.id === "new"), false);
  assert.equal(await actions.deleteTrigger(""), null);
  assert.equal(env.notifications.some((entry) => entry[0] === "error"), true);
});

test("GMHubActions applies conditions to selected actors", async () => {
  const store = createStore();
  const calls = [];
  const adapter = {
    async assign(actor, condition) {
      calls.push(["assign", actor.id, condition.id]);
      return [condition.id];
    },
    async unassign(actor, condition) {
      calls.push(["unassign", actor.id, condition.id]);
      return [];
    },
    async apply(actor, condition) {
      calls.push(["apply", actor.id, condition.id]);
      return "applied";
    },
    async remove(actor, condition) {
      calls.push(["remove", actor.id, condition.id]);
      return "removed";
    },
    async toggle(actor, condition) {
      calls.push(["toggle", actor.id, condition.id]);
      return "toggled";
    }
  };
  const actions = new GMHubActions({
    dataManager: store,
    conditionAdapter: adapter,
    uiManager: { renderOpenWindows: () => true },
    env: createEnv({ selected: [{ actor: { id: "actor-1" } }, { document: { actor: { id: "actor-2" } } }, { id: "token-actor" }] })
  });
  assert.equal(actions.resolveCondition("c1").name, "Cold");
  assert.equal(actions.resolveCondition("stunned").name, "Stunned");
  assert.equal(actions.resolveCondition("custom").name, "custom");
  assert.equal(actions.resolveCondition(""), null);
  assert.equal(actions.resolveCondition(null), null);
  assert.deepEqual(actions.selectedActors().map((actor) => actor.id), ["actor-1", "actor-2", "token-actor"]);
  assert.deepEqual(new GMHubActions({
    dataManager: store,
    conditionAdapter: adapter,
    uiManager: { renderOpenWindows: () => true },
    env: createEnv({ selected: [null] })
  }).selectedActors(), []);
  assert.deepEqual(await actions.assignToSelected(""), []);
  assert.deepEqual(await actions.unassignFromSelected(""), []);
  assert.deepEqual(await actions.applyToSelected("apply", ""), []);
  assert.deepEqual(await new GMHubActions({
    dataManager: store,
    conditionAdapter: adapter,
    uiManager: { renderOpenWindows: () => true },
    env: createEnv({ selected: [] })
  }).applyToSelected("apply", "c1"), []);
  assert.deepEqual(await new GMHubActions({
    dataManager: store,
    conditionAdapter: adapter,
    uiManager: { renderOpenWindows: () => true },
    env: createEnv({ selected: [] })
  }).assignToSelected("c1"), []);
  assert.deepEqual(await new GMHubActions({
    dataManager: store,
    conditionAdapter: adapter,
    uiManager: { renderOpenWindows: () => true },
    env: createEnv({ selected: [] })
  }).unassignFromSelected("c1"), []);
  assert.deepEqual(await actions.assignToSelected("c1"), [["c1"], ["c1"], ["c1"]]);
  assert.deepEqual(await actions.unassignFromSelected("stunned"), [[], [], []]);
  assert.deepEqual(await actions.applyToSelected("apply", "c1"), ["applied", "applied", "applied"]);
  assert.deepEqual(await actions.applyToSelected("remove", "stunned"), ["removed", "removed", "removed"]);
  assert.deepEqual(await actions.applyToSelected("toggle", "custom"), ["toggled", "toggled", "toggled"]);
  assert.equal(calls.length, 15);
});

test("bindGMHubEvents wires forms, deletes, selected buttons, import, export, refresh, and ignores unknown actions", async () => {
  const textarea = { value: JSON.stringify({ triggers: [], conditions: [] }) };
  const conditionForm = createSubmitTarget();
  const triggerForm = createSubmitTarget();
  const selected = { value: "select-condition" };
  const custom = { value: "custom-condition" };
  const buttons = [
    createButton("export"),
    createButton("import"),
    createButton("refresh"),
    createButton("delete-condition"),
    createButton("delete-trigger"),
    createButton("assign-selected"),
    createButton("unassign-selected"),
    createButton("apply-selected"),
    createButton("remove-selected"),
    createButton("toggle-selected"),
    createButton("unknown")
  ];
  buttons[3].dataset.id = "c1";
  buttons[4].dataset.id = "t1";
  const calls = [];
  const element = {
    querySelector(selector) {
      return {
        "[data-rnk-triggerz-export]": textarea,
        "[data-rnk-triggerz-condition-form]": conditionForm,
        "[data-rnk-triggerz-trigger-form]": triggerForm,
        "[data-rnk-triggerz-selected-condition-custom]": custom,
        "[data-rnk-triggerz-selected-condition]": selected
      }[selector];
    },
    querySelectorAll() {
      return buttons;
    }
  };
  const actions = {
    exportToTextarea: () => calls.push("export"),
    importFromTextarea: async () => calls.push("import"),
    refresh: () => calls.push("refresh"),
    saveConditionFromForm: async () => calls.push("save-condition"),
    saveTriggerFromForm: async () => calls.push("save-trigger"),
    deleteCondition: async (id) => calls.push(`delete-condition:${id}`),
    deleteTrigger: async (id) => calls.push(`delete-trigger:${id}`),
    assignToSelected: async (id) => calls.push(`assign:${id}`),
    unassignFromSelected: async (id) => calls.push(`unassign:${id}`),
    applyToSelected: async (method, id) => calls.push(`${method}:${id}`)
  };
  assert.equal(bindGMHubEvents({ element, actions }), 13);
  await conditionForm.submit();
  await triggerForm.submit();
  for (const button of buttons) await button.click();
  custom.value = "";
  await buttons[8].click();
  assert.deepEqual(calls, [
    "save-condition",
    "save-trigger",
    "export",
    "import",
    "refresh",
    "delete-condition:c1",
    "delete-trigger:t1",
    "assign:custom-condition",
    "unassign:custom-condition",
    "apply:custom-condition",
    "remove:custom-condition",
    "toggle:custom-condition",
    "remove:select-condition"
  ]);
});

test("GMHubWindow prepares context, binds events, and clears UI reference on close", async () => {
  class ApplicationV2 {
    constructor(options) {
      this.options = options;
      this.element = null;
    }
    async _prepareContext() {
      return { base: true };
    }
    async close(options) {
      this.closedWith = options;
      return this;
    }
  }
  const WindowClass = createGMHubWindowClass({ ApplicationV2, HandlebarsApplicationMixin: (Cls) => Cls });
  assert.deepEqual(WindowClass.PARTS.main.scrollY, [".rnk-triggerz-hub"]);
  assert.equal(WindowClass.DEFAULT_OPTIONS.position.width, 900);
  assert.equal(WindowClass.DEFAULT_OPTIONS.position.height, 720);
  const cleared = [];
  const textarea = { value: JSON.stringify({ triggers: [], conditions: [] }) };
  const buttons = [createButton("refresh")];
  const app = new WindowClass({
    dataManager: createStore(),
    conditionAdapter: { apply: async () => undefined },
    uiManager: {
      clearGMHub: (window) => cleared.push(window),
      renderOpenWindows: () => true
    },
    env: createEnv()
  });
  app.element = {
    querySelector: (selector) => ({ "[data-rnk-triggerz-export]": textarea }[selector]),
    querySelectorAll: () => buttons
  };
  const context = await app._prepareContext({});
  assert.equal(context.base, true);
  assert.equal(context.triggerCount, 1);
  app._onRender();
  await buttons[0].click();
  assert.equal(await app.close({ reason: "test" }), app);
  assert.equal(cleared[0], app);
});
