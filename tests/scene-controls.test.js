import assert from "node:assert/strict";
import test from "node:test";
import { createControlGroup, createOpenHubTool, injectControlGroup, registerSceneControlHook } from "../src/hooks/UIHooks.js";

test("scene tool opens hub only on active change", () => {
  const calls = [];
  const triggerz = { uiManager: { openGMHub: () => calls.push("open") } };
  const env = { game: { i18n: { has: () => true, localize: () => "Localized Open" } } };
  const tool = createOpenHubTool(triggerz, env);
  assert.equal(tool.title, "Localized Open");
  tool.onChange(false);
  tool.onChange(true);
  assert.deepEqual(calls, ["open"]);
});

test("control group matches array and object scene control shapes", () => {
  const tool = { name: "openHub" };
  assert.deepEqual(createControlGroup(tool, []).tools, [tool]);
  assert.deepEqual(createControlGroup(tool, {}).tools, { openHub: tool });
});

test("injectControl supports array replacement, append, object insert, and rejects invalid shapes", () => {
  const existing = [{ name: "rnk-triggerz" }];
  const replacement = { name: "rnk-triggerz", tools: [] };
  assert.equal(injectControlGroup(existing, replacement)[0], replacement);
  const next = [];
  injectControlGroup(next, replacement);
  assert.equal(next[0], replacement);
  const objectControls = {};
  injectControlGroup(objectControls, replacement);
  assert.equal(objectControls["rnk-triggerz"], replacement);
});

test("registerSceneControls handles missing Hooks and registers callback", () => {
  const hooks = {
    callback: null,
    on(name, callback) {
      this.name = name;
      this.callback = callback;
    }
  };
  const env = { Hooks: hooks, game: { i18n: { has: () => false } } };
  registerSceneControlHook(env, () => ({ uiManager: { openGMHub: () => undefined } }));
  assert.equal(hooks.name, "getSceneControlButtons");
  const controls = [];
  hooks.callback(controls);
  assert.equal(controls[0].name, "rnk-triggerz");
});
