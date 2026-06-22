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
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import { RNKTriggerz, actorUpdateEntity, tokenActorEntity, tokenActorUpdateData } from "../src/RNKTriggerz.js";
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
  const gmHubMenu = env.game.settings.menus.get("rnk-triggerz.gmHub");
  assert.equal(gmHubMenu.label, "RNKTRIGGERZ.Settings.GMHub.Label");
  assert.equal(gmHubMenu.type.prototype instanceof env.foundry.applications.api.ApplicationV2, true);
  const menuCalls = [];
  triggerz.uiManager.openGMHub = (options) => {
    menuCalls.push(options);
    return "hub";
  };
  assert.equal(await new gmHubMenu.type().render(true), "hub");
  assert.deepEqual(menuCalls, [{ force: true }]);
  assert.equal(triggerz.ready(), triggerz);
  assert.deepEqual(triggerz.exportData(), { moduleId: "rnk-triggerz", triggers: [], conditions: [] });
  await triggerz.importData({ triggers: [{ id: "t", path: "system.hp.value", value: 1 }], conditions: [] });
  assert.equal(triggerz.exportData().triggers[0].id, "t");
  await triggerz.importData({ triggers: [], conditions: [{ id: "brulure", name: "Brulure" }] });
  assert.deepEqual(triggerz.resolveCondition("brulure"), { id: "brulure", name: "Brulure" });
  assert.deepEqual(triggerz.triggerEngine.resolveAction({ type: ACTION_TYPES.REMOVE_CONDITION, condition: "brulure" }).condition, { id: "brulure", name: "Brulure" });
  assert.equal(triggerz.resolveCondition("missing"), "missing");
  assert.deepEqual(triggerz.resolveCondition({ id: "inline" }), { id: "inline" });
  assert.equal(triggerz.resolveCondition(null), null);
  assert.deepEqual(await triggerz.processActorUpdate({ hasPlayerOwner: true }, {}), []);
  assert.deepEqual(await triggerz.processTokenUpdate({ hasPlayerOwner: true }, {}), []);
});

test("RNKTriggerz processes CSB token actor delta updates", async () => {
  const env = createEnv();
  const triggerz = new RNKTriggerz({ env }).init();
  await triggerz.importData({
    triggers: [{ id: "midlife", path: "system.props.HP", operator: OPERATORS.LTE, value: "system.props.midlife", actions: [] }],
    conditions: []
  });
  const actor = { hasPlayerOwner: true, system: { props: { HP: 4, HP_MAX: 10, midlife: 5 } } };
  assert.deepEqual(tokenActorUpdateData({ delta: { system: { props: { HP: 4 } } } }), { system: { props: { HP: 4 } } });
  assert.deepEqual(tokenActorUpdateData({ "delta.system.props.HP": 4 }), { "system.props.HP": 4 });
  assert.deepEqual(tokenActorUpdateData({ "delta.props.HP": 4 }), { "props.HP": 4 });
  assert.deepEqual(tokenActorUpdateData({ "actorData.system.props.HP": 4 }), { "system.props.HP": 4 });
  assert.deepEqual(tokenActorUpdateData({ "delta.actorData.system.props.HP": 4 }), { "system.props.HP": 4 });
  assert.deepEqual(tokenActorUpdateData({ "_source.system.props.HP": 4 }), { "system.props.HP": 4 });
  assert.deepEqual(tokenActorUpdateData({ delta: { actorData: { system: { props: { HP: 4 } } } } }), { system: { props: { HP: 4 } } });
  assert.deepEqual(tokenActorUpdateData({ _source: { system: { props: { HP: 4 } } } }), { system: { props: { HP: 4 } } });
  assert.deepEqual(tokenActorUpdateData({ actorData: { system: { props: { HP: 4 } } } }), { system: { props: { HP: 4 } } });
  assert.deepEqual(tokenActorUpdateData({ delta: null }), {});
  assert.deepEqual(tokenActorUpdateData({ actorData: 1 }), {});
  assert.deepEqual(tokenActorUpdateData({ x: 100 }), { x: 100 });
  assert.deepEqual(tokenActorUpdateData(null), {});
  assert.deepEqual(actorUpdateEntity({
    toObject: () => ({ system: { props: { HP: 4 } } }),
    hasPlayerOwner: true,
    flags: { live: true },
    id: "actor-id",
    name: "Actor Name",
    type: "character",
    img: "actor.png",
    system: { props: { HP: 4, midlife: 5 } }
  }, { "system.props.HP": 6 }), {
    system: { props: { HP: 6, midlife: 5 } },
    hasPlayerOwner: true,
    flags: { live: true },
    id: "actor-id",
    name: "Actor Name",
    type: "character",
    img: "actor.png"
  });
  assert.deepEqual(actorUpdateEntity(null, { "system.props.HP": 6 }).system.props, { HP: 6 });
  assert.deepEqual(actorUpdateEntity({ system: { props: { HP: 4 } } }, null).system.props, { HP: 4 });
  assert.deepEqual(tokenActorEntity({
    actor: { hasPlayerOwner: true, system: { props: { HP: 9 } } },
    delta: { system: { props: { HP_MAX: 10, midlife: 5 } } }
  }, { "delta.system.props.HP": 4 }).system.props, { HP: 4, HP_MAX: 10, midlife: 5 });
  assert.deepEqual(tokenActorEntity({
    actor: { toObject: () => ({ system: { props: { HP: 9 } } }), hasPlayerOwner: false },
    actorData: { "system.props.midlife": 5 }
  }, {}).system.props, { HP: 9, midlife: 5 });
  assert.deepEqual(tokenActorEntity({
    actor: { system: 0, tags: [] },
    delta: { system: { props: { midlife: 5 } }, tags: { active: true } }
  }, {}).system.props, { midlife: 5 });
  assert.deepEqual(tokenActorEntity({
    actor: { system: "bad" },
    delta: { system: { props: { midlife: 5 } } }
  }, {}).system.props, { midlife: 5 });
  assert.deepEqual(tokenActorEntity(1, { "delta.system.props.HP": 4 }).system.props, { HP: 4 });
  assert.deepEqual((await triggerz.processTokenUpdate({ actor }, { "delta.system.props.HP": 4 })).map((trigger) => trigger.id), ["midlife"]);
  assert.deepEqual((await triggerz.processTokenUpdate({ actor }, { "delta.props.HP": 4 })).map((trigger) => trigger.id), ["midlife"]);
  assert.deepEqual((await triggerz.processTokenUpdate({ actor }, { actorData: { system: { props: { HP: 10 } } } })).map((trigger) => trigger.id), []);
  assert.deepEqual(await triggerz.processTokenUpdate(null, {}), []);
});

test("RNKTriggerz removes conditions when actor update satisfies a path value trigger", async () => {
  const env = createEnv();
  const triggerz = new RNKTriggerz({ env }).init();
  await triggerz.importData({
    triggers: [{
      id: "remove-brulure",
      path: "system.props.HP",
      operator: OPERATORS.GT,
      value: "system.props.midlife",
      actions: [{ type: ACTION_TYPES.REMOVE_CONDITION, condition: "brulure" }]
    }],
    conditions: [{ id: "brulure", name: "Brulure" }]
  });
  const actor = {
    toObject: () => ({ system: { props: { HP: 4 } } }),
    hasPlayerOwner: true,
    system: { props: { HP: 4, HP_MAX: 10, midlife: 5 } },
    effects: [{ id: "effect-1", name: "Brulure" }],
    deleted: [],
    async deleteEmbeddedDocuments(type, ids) {
      this.deleted.push({ type, ids });
      return ids;
    }
  };
  assert.deepEqual((await triggerz.processActorUpdate(actor, { "system.props.HP": 6 })).map((trigger) => trigger.id), ["remove-brulure"]);
  assert.deepEqual(actor.deleted, [{ type: "ActiveEffect", ids: ["effect-1"] }]);
});

test("RNKTriggerz removes conditions when token delta satisfies a path value trigger", async () => {
  const env = createEnv();
  const triggerz = new RNKTriggerz({ env }).init();
  await triggerz.importData({
    triggers: [{
      id: "remove-brulure",
      path: "system.props.HP",
      operator: OPERATORS.GT,
      value: "system.props.midlife",
      actions: [{ type: ACTION_TYPES.REMOVE_CONDITION, condition: "brulure" }]
    }],
    conditions: [{ id: "brulure", name: "Brulure" }]
  });
  const actor = {
    hasPlayerOwner: true,
    system: { props: { HP: 4 } },
    effects: [{ id: "effect-1", name: "Brulure" }],
    deleted: [],
    async deleteEmbeddedDocuments(type, ids) {
      this.deleted.push({ type, ids });
      return ids;
    }
  };
  const token = { actor, delta: { system: { props: { HP_MAX: 10, midlife: 5 } } } };
  assert.deepEqual((await triggerz.processTokenUpdate(token, { "delta.system.props.HP": 6 })).map((trigger) => trigger.id), ["remove-brulure"]);
  assert.deepEqual(actor.deleted, [{ type: "ActiveEffect", ids: ["effect-1"] }]);
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
