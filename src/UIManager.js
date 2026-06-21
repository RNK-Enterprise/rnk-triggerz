import { createGMHubWindowClass } from "./windows/GMHubWindow.js";

export function forceRenderApplication(app) {
  return app.render({ force: true });
}

export class UIManager {
  constructor({ env = globalThis, dataManager, conditionAdapter, windowClass = null } = {}) {
    this.env = env;
    this.dataManager = dataManager;
    this.conditionAdapter = conditionAdapter;
    this.gmHub = null;
    this.windowClass = windowClass ?? createGMHubWindowClass(env.foundry.applications.api);
  }

  openGMHub({ force = false } = {}) {
    if (this.gmHub && !force) {
      this.gmHub.bringToTop();
      return this.gmHub;
    }
    if (this.gmHub && force) this.gmHub.close();
    this.gmHub = new this.windowClass({
      dataManager: this.dataManager,
      conditionAdapter: this.conditionAdapter,
      uiManager: this,
      env: this.env
    });
    forceRenderApplication(this.gmHub);
    return this.gmHub;
  }

  clearGMHub(app) {
    if (this.gmHub === app) this.gmHub = null;
  }

  renderOpenWindows() {
    if (!this.gmHub) return false;
    this.openGMHub({ force: true });
    return true;
  }
}
