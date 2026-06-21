export const MODULE_ID = "rnk-triggerz";
export const MODULE_TITLE = "RNK Triggerz";
export const MODULE_VERSION = "1.0.0";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;

export const SETTING_KEYS = Object.freeze({
  ENABLE_SCENE_CONTROL: "enableSceneControl",
  TRIGGERS: "triggers",
  CONDITIONS: "conditions",
  DEBUG: "debug"
});

export const ACTOR_FLAG_KEYS = Object.freeze({
  ASSIGNED_CONDITIONS: "assignedConditions"
});

export const ACTION_TYPES = Object.freeze({
  APPLY_CONDITION: "applyCondition",
  REMOVE_CONDITION: "removeCondition",
  TOGGLE_CONDITION: "toggleCondition",
  RUN_MACRO: "runMacro"
});

export const OPERATORS = Object.freeze({
  EQ: "eq",
  NE: "ne",
  LT: "lt",
  LTE: "lte",
  GT: "gt",
  GTE: "gte"
});

export const SOCKET_EVENTS = Object.freeze({
  REFRESH_HUB: "refreshHub",
  IMPORT_DATA: "importData"
});

export const DEFAULT_SETTINGS = Object.freeze({
  [SETTING_KEYS.ENABLE_SCENE_CONTROL]: true,
  [SETTING_KEYS.TRIGGERS]: [],
  [SETTING_KEYS.CONDITIONS]: [],
  [SETTING_KEYS.DEBUG]: false
});

export const TEMPLATE_PATHS = Object.freeze({
  GM_HUB: `modules/${MODULE_ID}/templates/gm-hub.hbs`
});
