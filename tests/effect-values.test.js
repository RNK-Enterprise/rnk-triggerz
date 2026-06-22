import assert from "node:assert/strict";
import test from "node:test";
import {
  csbPathExpression,
  csbValueExpression,
  isCSBEffectKey,
  isCSBPropPath,
  makeCSBFormula,
  normalizeEffectChange,
  normalizeEffectChanges,
  trimEffectText,
  unwrapCSBFormula
} from "../src/EffectValues.js";

test("Effect value helpers recognize CSB paths and formulas", () => {
  assert.equal(trimEffectText("  value  "), "value");
  assert.equal(trimEffectText(null), "");
  assert.equal(isCSBPropPath("system.props.force"), true);
  assert.equal(isCSBPropPath("props.force"), true);
  assert.equal(isCSBPropPath("system.force"), false);
  assert.equal(isCSBEffectKey("props.force"), true);
  assert.equal(isCSBEffectKey("system.force"), false);
  assert.equal(unwrapCSBFormula("${ HP_MAX / 2 }$"), "HP_MAX / 2");
  assert.equal(unwrapCSBFormula("HP_MAX"), "");
  assert.equal(csbPathExpression("system.props.force"), "force");
  assert.equal(csbPathExpression("props.force"), "force");
  assert.equal(csbPathExpression("system.force"), "");
  assert.equal(csbValueExpression(""), "");
  assert.equal(csbValueExpression("${ HP_MAX / 2 }$"), "HP_MAX / 2");
  assert.equal(csbValueExpression("system.props.force"), "force");
  assert.equal(csbValueExpression("props.force"), "force");
  assert.equal(csbValueExpression("-1"), "-1");
  assert.equal(csbValueExpression("plain text"), "");
  assert.equal(makeCSBFormula("current - 1"), "${ current - 1 }$");
});

test("normalizeEffectChange converts CSB prop math into custom formulas", () => {
  assert.deepEqual(normalizeEffectChange({
    key: "system.props.force",
    mode: 2,
    value: "-1",
    priority: 1
  }), {
    key: "system.props.force",
    mode: 0,
    value: "${ current + (-1) }$",
    priority: 1
  });
  assert.deepEqual(normalizeEffectChange({
    key: "props.force",
    mode: 1,
    value: "2",
    priority: 1
  }).value, "${ current * (2) }$");
  assert.deepEqual(normalizeEffectChange({
    key: "system.props.force",
    mode: 5,
    value: "system.props.forceMax",
    priority: 1
  }).value, "${ forceMax }$");
  assert.deepEqual(normalizeEffectChange({
    key: "system.props.force",
    mode: "0",
    value: "plain",
    priority: 1
  }), {
    key: "system.props.force",
    mode: 0,
    value: "plain",
    priority: 1
  });
  assert.deepEqual(normalizeEffectChange({
    key: "system.force",
    mode: 2,
    value: "system.props.force",
    priority: 1
  }).value, "${ force }$");
  assert.deepEqual(normalizeEffectChange(null), { mode: 0, value: "" });
  assert.deepEqual(normalizeEffectChanges([{ key: "system.props.force", mode: 2, value: "-1" }])[0].mode, 0);
  assert.deepEqual(normalizeEffectChanges(null), []);
});
