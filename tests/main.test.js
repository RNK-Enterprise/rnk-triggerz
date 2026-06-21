import assert from "node:assert/strict";
import test from "node:test";
import "../main.js";
import {
  actorUpdateHook,
  getActiveInstance,
  initHook,
  readyHook,
  registerHooks,
  resetHooksForTests,
  tokenUpdateHook
} from "../src/hooks.js";
import { RNKTriggerz } from "../src/RNKTriggerz.js";
import { createGame } from "./helpers.mjs";

function createEnv() {
  class ApplicationV2 {
    async _prepareContext() {
      return {};
    }
    render(force) {
      this.force = force;
      return this;
    }
    close() {}
  }
  return {
    game: createGame({ userId: "u1", socket: { on() {}, emit() {} } }),
    CONFIG: { statusEffects: [] },
    canvas: { tokens: { controlled: [] } },
    foundry: { applications: { api: { ApplicationV2, HandlebarsApplicationMixin: (Cls) => Cls } } }
  };
}

test("RNKTriggerz initializes services and exposes API methods", async () => {
  const env = createEnv();
  const triggerz = new RNKTriggerz({ env }).init();
  assert.equal(triggerz.id, "rnk-triggerz");
  assert.equal(env.game.rnkTriggerz, triggerz);
  assert.equal(triggerz.ready(), triggerz);
  assert.deepEqual(triggerz.exportData(), { moduleId: "rnk-triggerz", triggers: [], conditions: [] });
  await triggerz.importData({ triggers: [{ id: "t", path: "system.hp.value", value: 1 }], conditions: [] });
  assert.equal(triggerz.exportData().triggers[0].id, "t");
  assert.deepEqual(await triggerz.processActorUpdate({ hasPlayerOwner: true }, {}), []);
  assert.deepEqual(await triggerz.processTokenUpdate({ hasPlayerOwner: true }, {}), []);
});

test("hooks register and route init, ready, actor, and token updates", () => {
  resetHooksForTests();
  assert.equal(registerHooks({}), false);
  const env = createEnv();
  env.Hooks = {
    onceCalls: [],
    onCalls: [],
    once(name, callback) {
      this.onceCalls.push({ name, callback });
    },
    on(name, callback) {
      this.onCalls.push({ name, callback });
    }
  };
  assert.equal(registerHooks(env), true);
  assert.deepEqual(env.Hooks.onceCalls.map((call) => call.name), ["init", "ready"]);
  assert.deepEqual(env.Hooks.onCalls.map((call) => call.name), ["updateActor", "updateToken", "getSceneControlButtons"]);
  const triggerz = initHook(env);
  assert.equal(getActiveInstance(), triggerz);
  assert.equal(readyHook(), triggerz);
  assert.equal(actorUpdateHook({}, {}, {}, "other", env), false);
  assert.equal(tokenUpdateHook({}, {}, {}, "other", env), false);
  assert.equal(actorUpdateHook({}, {}, {}, "u1", env), true);
  assert.equal(tokenUpdateHook({}, {}, {}, "u1", env), true);
});

test("registered callbacks execute against active instance", () => {
  resetHooksForTests();
  const env = createEnv();
  env.Hooks = {
    onceCalls: {},
    onCalls: {},
    once(name, callback) {
      this.onceCalls[name] = callback;
    },
    on(name, callback) {
      this.onCalls[name] = callback;
    }
  };
  registerHooks(env);
  env.Hooks.onceCalls.init();
  env.Hooks.onceCalls.ready();
  env.Hooks.onCalls.updateActor({}, {}, {}, "u1");
  env.Hooks.onCalls.updateToken({}, {}, {}, "u1");
  const controls = [];
  env.Hooks.onCalls.getSceneControlButtons(controls);
  assert.equal(controls[0].name, "rnk-triggerz");
});
