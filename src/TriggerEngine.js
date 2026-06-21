import { ACTION_TYPES, OPERATORS } from "./constants.js";
import { asArray, getProperty, hasProperty, makeError } from "./utils.js";

export const COMPARATORS = Object.freeze({
  [OPERATORS.EQ]: (left, right) => left === right,
  [OPERATORS.NE]: (left, right) => left !== right,
  [OPERATORS.LT]: (left, right) => left < right,
  [OPERATORS.LTE]: (left, right) => left <= right,
  [OPERATORS.GT]: (left, right) => left > right,
  [OPERATORS.GTE]: (left, right) => left >= right
});

export function coerceValue(value, exemplar) {
  if (typeof exemplar === "number") return Number(value);
  if (typeof exemplar === "boolean") return value === true || value === "true";
  return String(value);
}

export function resolveTriggerRightValue(trigger, entity, leftValue) {
  const rawValue = String(trigger.value ?? "");
  if (rawValue.endsWith("%")) {
    const base = Number(getProperty(entity, trigger.comparePath));
    return base * (Number(rawValue.slice(0, -1)) / 100);
  }
  return coerceValue(rawValue, leftValue);
}

export function buildTriggerLabel(trigger) {
  const operator = trigger.operator ?? OPERATORS.EQ;
  return `${trigger.path} ${operator} ${trigger.value}`;
}

export function normalizeTrigger(trigger) {
  if (!trigger?.id) throw makeError("Trigger requires an id.", { trigger });
  if (!trigger.path) throw makeError("Trigger requires a path.", { trigger });
  const operator = trigger.operator ?? OPERATORS.EQ;
  if (!COMPARATORS[operator]) throw makeError(`Unsupported trigger operator: ${operator}`, { trigger });
  return {
    ...trigger,
    operator,
    label: trigger.label ?? buildTriggerLabel({ ...trigger, operator }),
    actions: asArray(trigger.actions)
  };
}

export function evaluateTrigger(trigger, entity, update) {
  const prepared = normalizeTrigger(trigger);
  if (prepared.pcOnly && !entity?.hasPlayerOwner) return false;
  if (prepared.npcOnly && entity?.hasPlayerOwner) return false;
  if (!hasProperty(update, prepared.path)) return false;
  const leftValue = getProperty(update, prepared.path);
  if (prepared.notZero && leftValue === 0) return false;
  const rightValue = resolveTriggerRightValue(prepared, entity, leftValue);
  return COMPARATORS[prepared.operator](leftValue, rightValue);
}

export class TriggerEngine {
  constructor({ adapter, macroRunner = async () => undefined } = {}) {
    this.adapter = adapter;
    this.macroRunner = macroRunner;
  }

  async processUpdate(entity, update, triggers = []) {
    const matched = [];
    for (const trigger of triggers.map(normalizeTrigger)) {
      if (!evaluateTrigger(trigger, entity, update)) continue;
      matched.push(trigger);
      for (const action of trigger.actions) {
        await this.adapter.runAction(entity, action, this.macroRunner);
      }
    }
    return matched;
  }
}

export function createDefaultTrigger(id, path, value, condition) {
  return normalizeTrigger({
    id,
    name: id,
    path,
    value,
    operator: OPERATORS.EQ,
    actions: [
      {
        type: ACTION_TYPES.APPLY_CONDITION,
        condition
      }
    ]
  });
}

