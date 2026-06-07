# `_template` — how to add a new level

A **level is data, not code** (PRD §7.1). Adding a historical machine requires
**zero edits to the engine, UI, or shell** — only new files in known locations
plus one registry entry. This folder is the proof and the starting point.

## The drop-in checklist

1. **Copy this folder** to `src/machines/<id>/` (e.g. `src/machines/altair8800/`).
   - Replace `index.ts`'s toy ISA with your machine's real assembler + CPU.
   - As they grow, split into `assembler.ts`, `cpu.ts`, `display.ts` like
     `machines/mos6502/` does. The only hard requirement is that `index.ts`
     exports a `MachineFactory` (a zero-arg function returning a `Machine`).
   - Fill in the `MachineDescriptor` (register/flag order, memory size, optional
     display geometry). The inspector renders itself from this — no UI code.

2. **Author challenges** as JSON under `src/content/challenges/<dir>/`.
   - Name files `01-...json`, `02-...json`; they load in filename order
     automatically (`content/challengeLoader.ts`, via `import.meta.glob`).
   - Each challenge: `lesson`, `prompt`, `starterCode`, `hints[]`, a declarative
     `success` check (expressed against the generic `getState()` shape — never
     machine internals), and a `reference` solution for the verifier.

3. **(Optional) Drop a GLB** at `assets/models/<id>.glb` with deliberately named
   interactive meshes (`switch_A0`, `led_run`, …) so R3F can target parts.

4. **Add ONE entry** to `src/content/levels.ts`:
   ```ts
   {
     id: "altair8800",
     title: "Altair 8800",
     year: 1974,
     machineFactory: createAltair8800,
     challengeDir: "altair8800",
     modelPath: "/assets/models/altair8800.glb",
     blurb: "Front-panel switch programming; the machine that launched Microsoft.",
   }
   ```

That's it. The editor, inspector, console, step/run/reset, challenge runner, and
progression all work unchanged because they only speak the `Machine` interface.

## The contract

Anything a machine needs that the `Machine` interface can't express is a signal
to **evolve the interface generically** — never special-case a machine in the
engine. Keep success-checks declarative so non-programmers can author levels.

## Verification

`src/engine/verification.test.ts` runs every registered level's reference
solutions and confirms each challenge passes (and an empty program fails).
`src/machines/_template/template.test.ts` proves this template's contract works
in isolation — the drop-in path from PRD §10.6.
