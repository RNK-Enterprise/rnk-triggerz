import { TEMPLATE_PATHS } from "../constants.js";
import { GMHubActions } from "./GMHubActions.js";
import { buildGMHubContext } from "./GMHubContext.js";
import { bindGMHubEvents } from "./GMHubEvents.js";

export function createGMHubWindowClass(applicationApi) {
  const { ApplicationV2, HandlebarsApplicationMixin } = applicationApi;

  return class GMHubWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "rnk-triggerz-gm-hub",
      classes: ["rnk-triggerz-gm-hub"],
      window: {
        title: "RNKTRIGGERZ.GMHub.Title",
        resizable: true
      },
      position: {
        width: 900,
        height: 720
      }
    };

    static PARTS = {
      main: {
        template: TEMPLATE_PATHS.GM_HUB,
        scrollY: [".rnk-triggerz-hub"]
      }
    };

    constructor(options = {}) {
      super(options);
      this.dataManager = options.dataManager;
      this.conditionAdapter = options.conditionAdapter;
      this.uiManager = options.uiManager;
      this.env = options.env;
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      return {
        ...context,
        ...buildGMHubContext({ dataManager: this.dataManager, env: this.env })
      };
    }

    _onRender() {
      const actions = new GMHubActions({
        dataManager: this.dataManager,
        conditionAdapter: this.conditionAdapter,
        uiManager: this.uiManager,
        env: this.env
      });
      bindGMHubEvents({ element: this.element, actions });
    }

    async close(options) {
      this.uiManager.clearGMHub(this);
      return super.close(options);
    }
  };
}
