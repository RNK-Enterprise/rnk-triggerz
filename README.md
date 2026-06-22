# RNK Triggerz

RNK Triggerz is a system-agnostic Foundry VTT module for trigger-driven status
automation, condition overlays, and GM workflow control.

## Current Build

Version: 1.0.3

- Scene control launcher
- Foundry settings toggle for the scene control launcher
- GM hub settings menu launcher
- GM hub shell
- Trigger engine foundation
- Trigger values can be literals, actor data paths, or percentages against a compare path
- Triggers can be saved with no direct action for linked condition workflows
- Conditions can link to existing Apply Trigger and Remove Trigger rules
- Foundry ActiveEffect adapter
- CSB ActiveEffect path math normalization
- Custom System Builder status adapter path
- Import/export storage layer
- Bible-aligned `main.js` and `src/` architecture
- Socket boundary
- Strict automated validation and coverage gates

## Validation

```bash
npm run check
```

Coverage is enforced for source JavaScript with Node's built-in test runner.
Manifest, templates, styles, and localization are validated separately.
