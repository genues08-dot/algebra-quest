# Algebra Quest

Offline Duolingo-style algebra study app. Spec: docs/superpowers/specs/2026-11-11-algebra-quest-design.md

- Tests: `node --test "tests/*.test.js"`
- No npm packages, no build step, no ES modules. The app runs from file://.
- Making a unit from packet photos: follow spec section 10 and write `units/<unit-id>.json`. Then run `node tools/validate-unit.js units/<unit-id>.json` and fix every error before telling the user to import it.
