export function createSettings() {
  const settings = new Map();
  const menus = new Map();
  const values = new Map();
  const calls = [];
  return {
    settings,
    menus,
    calls,
    register(moduleId, key, definition) {
      const fullKey = `${moduleId}.${key}`;
      calls.push(["register", fullKey]);
      settings.set(fullKey, definition);
      values.set(fullKey, structuredClone(definition.default));
    },
    registerMenu(moduleId, key, definition) {
      const fullKey = `${moduleId}.${key}`;
      calls.push(["registerMenu", fullKey]);
      menus.set(fullKey, { ...definition, key: fullKey, namespace: moduleId });
    },
    get(moduleId, key) {
      return values.get(`${moduleId}.${key}`);
    },
    async set(moduleId, key, value) {
      values.set(`${moduleId}.${key}`, structuredClone(value));
      return value;
    }
  };
}

export function createGame(overrides = {}) {
  return {
    settings: createSettings(),
    system: { id: "custom-system-builder" },
    user: { isGM: true },
    i18n: {
      has: (key) => key === "known.key",
      localize: (key) => `localized:${key}`
    },
    ...overrides
  };
}

export function createButton(action) {
  return {
    dataset: { action },
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      return this.listeners.click({ currentTarget: this });
    }
  };
}
