import assert from "node:assert/strict";
import test from "node:test";
import { forceRenderApplication, UIManager } from "../src/UIManager.js";

class Hub {
  constructor(options) {
    this.options = options;
    this.closed = false;
    this.brought = false;
  }
  render(options) {
    this.renderOptions = options;
    return this;
  }
  bringToTop() {
    this.brought = true;
  }
  close() {
    this.closed = true;
  }
}

function createEnv() {
  return { foundry: { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Cls) => Cls } } } };
}

test("forceRenderApplication uses ApplicationV2 force options", () => {
  const hub = new Hub({});
  assert.equal(forceRenderApplication(hub), hub);
  assert.deepEqual(hub.renderOptions, { force: true });
});

test("UIManager opens, focuses, force-replaces, clears, and renders hub", () => {
  const manager = new UIManager({ env: createEnv(), dataManager: { id: "data" }, windowClass: Hub });
  const first = manager.openGMHub();
  assert.deepEqual(first.renderOptions, { force: true });
  assert.equal(first.options.dataManager.id, "data");
  assert.equal(manager.openGMHub(), first);
  assert.equal(first.brought, true);
  const opened = manager.openGMHub({ force: true });
  assert.equal(first.closed, true);
  assert.deepEqual(opened.renderOptions, { force: true });
  assert.equal(manager.renderOpenWindows(), true);
  assert.equal(opened.closed, true);
  assert.notEqual(manager.gmHub, opened);
  assert.deepEqual(manager.gmHub.renderOptions, { force: true });
  manager.clearGMHub(first);
  assert.notEqual(manager.gmHub, null);
  manager.clearGMHub(manager.gmHub);
  assert.equal(manager.gmHub, null);
  assert.equal(manager.renderOpenWindows(), false);
});

test("UIManager can derive window class from Foundry ApplicationV2 API", () => {
  const env = {
    foundry: {
      applications: {
        api: {
          ApplicationV2: class {
            async _prepareContext() {
              return {};
            }
            render(options) {
              this.renderOptions = options;
              return this;
            }
          },
          HandlebarsApplicationMixin: (Cls) => Cls
        }
      }
    }
  };
  const manager = new UIManager({ env, dataManager: { exportData: () => ({ triggers: [], conditions: [] }) } });
  assert.deepEqual(manager.openGMHub().renderOptions, { force: true });
});
