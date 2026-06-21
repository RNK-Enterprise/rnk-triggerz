# RNK Triggerz

RNK Triggerz is a system-agnostic Foundry VTT module for trigger-driven status
automation, condition overlays, and GM workflow control.

## Current Build

Version: 1.0.0

- Scene control launcher
- GM hub shell
- Trigger engine foundation
- Foundry ActiveEffect adapter
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
