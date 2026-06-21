import { ConditionAdapter } from "./ConditionAdapter.js";
import { DataManager } from "./DataManager.js";
import { MODULE_ID } from "./constants.js";
import { SocketHandler } from "./SocketHandler.js";
import { TriggerEngine } from "./TriggerEngine.js";
import { UIManager } from "./UIManager.js";

export class RNKTriggerz {
  constructor({ env = globalThis } = {}) {
    this.env = env;
    this.id = MODULE_ID;
    this.dataManager = new DataManager({ game: env.game, env });
    this.conditionAdapter = new ConditionAdapter({ config: env.CONFIG });
    this.triggerEngine = new TriggerEngine({ adapter: this.conditionAdapter });
    this.uiManager = null;
    this.socketHandler = null;
  }

  init() {
    this.dataManager.registerSettings();
    this.uiManager = new UIManager({
      env: this.env,
      dataManager: this.dataManager,
      conditionAdapter: this.conditionAdapter
    });
    this.socketHandler = new SocketHandler({
      game: this.env.game,
      dataManager: this.dataManager,
      uiManager: this.uiManager
    });
    this.socketHandler.register();
    this.env.game.rnkTriggerz = this;
    return this;
  }

  ready() {
    return this;
  }

  async processActorUpdate(actor, updateData) {
    return this.triggerEngine.processUpdate(actor, updateData, this.dataManager.getTriggers());
  }

  async processTokenUpdate(tokenDocument, updateData) {
    return this.triggerEngine.processUpdate(tokenDocument, updateData, this.dataManager.getTriggers());
  }

  exportData() {
    return this.dataManager.exportData();
  }

  importData(data) {
    return this.dataManager.importData(data);
  }
}
