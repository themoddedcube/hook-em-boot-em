# PRD — "Hook 'Em, Boot 'Em" *(working title)*
### An interactive 3D game on the history of computer architecture, for UT Austin ECE students

---

## Context

ECE students learn instruction-set architecture and computer organization abstractly — registers, opcodes, addressing modes — without feeling *why* these abstractions exist or how brutally constrained early machines were. This game makes that history visceral: players time-travel through landmark computers (ENIAC → Manchester Baby → PDP-8 → Altair 8800 → MOS 6502), solving **real, simplified assembly challenges on each machine's actual ISA**, while interacting with **3D recreations of the real hardware** (flip the Altair's switches, watch the PDP-8's front-panel lamps blink).

The world is **UT Austin–themed**: the narrative frames the player as a Cockrell School ECE student whose journey through computing history ends at home — **TACC's supercomputer (Frontera/Stampede) on UT's own campus** — closing the arc from a 30-ton vacuum-tube room to a top-10 supercomputer they can walk past. The **LC-3** (Yale Patt, UT Austin; the teaching ISA in EE 306 / Patt & Patel's textbook) serves as the capstone "modern teaching architecture" bridge level, tying the game directly to the curriculum students are already taking.

**Why now / why this:** No existing product fills the four-way intersection of (1) *real* historic ISAs, (2) chronological multi-machine progression, (3) gamified puzzles, and (4) interactive 3D hardware. Assembly games (TIS-100, Turing Complete, Human Resource Machine) use *fictional* architectures; faithful emulators (SIMH, SoCDP-8, Easy6502) are single-machine, non-gamified hobbyist tools. This game is "TIS-100's puzzle craft applied to *real* ENIAC→6502 history, on the actual front panels."

**Decisions locked with the user:** Web-first (browser). Real-but-simplified ISA emulation. MVP = **one machine, built deep** (full vertical slice). Audience = UT Austin ECE students; UT-themed world.

---

## 1. Goals & non-goals

### Goals
- Teach the *evolution* of computer architecture experientially — each level makes one historical leap legible (plugboard → stored program → minicomputer ISA → microprocessor registers → modern teaching ISA).
- Every challenge runs on a **faithful (if simplified) emulator of the real ISA**, so skills transfer to real coursework.
- Hardware is **interactive 3D** — players manipulate the actual control surface (switches, lamps, teletype) of each machine.
- Curriculum-aligned: usable as supplementary material for UT EE 306 / EE 460N; LC-3 capstone bridges to the textbook.
- Pedagogy that reinforces history: each machine's challenges **echo what the machine was actually first used for**.

### Non-goals (v1)
- Not a cycle-accurate hardware preservation project (SIMH already exists for that).
- Not a multiplayer/social product.
- Not a from-scratch CPU-builder (Turing Complete/nandgame own that niche).
- No native desktop/console build in v1 (architected so a thin shell is possible later).

---

## 2. Target users & success metrics

**Primary:** UT Austin ECE undergrads (EE 306 / EE 460N), and incoming students building intuition before coursework.
**Secondary:** retro-computing enthusiasts; CS-history educators anywhere.

**Success metrics (MVP):**
- Vertical-slice completion rate (player finishes the 6502 level's challenge arc) > 60% of starters.
- Median session ≥ 15 min; ≥ 1 returning session per player.
- Qualitative: playtesters can articulate one architectural "leap" unprompted after playing.
- Instructor signal: at least one UT ECE TA/professor willing to link it as optional material.

---

## 3. Tech stack (grounded by research)

| Layer | Choice | Why |
|---|---|---|
| **Runtime** | Web (browser) | Zero install, shareable by URL, maximizes reuse of the JS emulator ecosystem. |
| **App framework** | **React + TypeScript + Vite** | Fast DX; UI is panel-heavy (code editor, lesson text, console) — React fits. |
| **3D** | **React Three Fiber (R3F) + Drei** (MIT) | Declarative scene graph maps cleanly to "each switch/LED is a stateful component"; `<Html>` overlays for code/teletype panels; matches plain Three.js perf. `@react-three/postprocessing` for LED bloom; optional `@react-three/rapier` for switch physics. |
| **Code editor** | CodeMirror 6 | Lightweight, themeable (burnt-orange syntax), good for an assembly DSL. |
| **State** | Zustand | Minimal; good for machine/register/challenge state. |
| **Assets** | Blender → **glTF/GLB** | GLB self-contained; loaded via `useGLTF`. |
| **Later (optional)** | Godot 4 (MIT) shell | Only if a Steam/itch native build is wanted; would require re-binding C cores. Not v1. |

### Emulator core strategy (per machine)
Reuse permissive JS cores; reimplement the trivial ones; wrap each behind a **uniform `Machine` interface** (see §6) so the game layer is emulator-agnostic.

| Machine | Source | License | Plan |
|---|---|---|---|
| **MOS 6502** *(MVP)* | fork **skilldrick/easy6502** | **CC BY 4.0** | Assembler + sim + 32×32 pixel display already bundled. **Attribute** (CC-BY is a content license — keep attribution, verify before commercial use). |
| Intel 8080 / Altair 8800 | **wixette/8800-simulator** (Apache-2.0) wrapping **maly/8080js** (MIT) | permissive | Front-panel sim reusable almost directly. |
| PDP-8 | **MircoT/js-pdp8** or port **tenbaht/sdp-8** | (verify) / lighter | **Avoid SoCDP-8 (AGPL-3.0** network copyleft) unless complying. |
| Manchester Baby / SSEM | **reimplement in JS** | n/a (our code) | 7 instructions, 32-word store — trivial; use pfaivre/dandan154 as references. |
| ENIAC | **bespoke non-emulated "plugboard" mini-game** | n/a | ENIAC had no stored-program ISA; build a patch-the-cables puzzle + diorama, not an emulator. |
| **LC-3** *(capstone)* | small custom interpreter (well-documented ISA) | n/a | Curriculum bridge; standard LC-3 spec. |

**License watch-outs to honor:** easy6502 = CC-BY (attribute); `fake6502` = GPL-2.0 **and author-deprecated** (do not use); SoCDP-8 = AGPL-3.0 (avoid for shipped product). Confirm "(verify)" licenses in each repo's LICENSE before committing code.

---

## 4. The 3D / Blender pipeline

These machines are **boxy: rectangular panels, rows of identical switches, lamps, legends** — ideal for **parametric/scripted modeling**, *not* generative AI meshes.

**Recommended workflow:**
1. **Author hardware parametrically in Blender** — use reference photos for panel layouts; generate switch/LED grids procedurally (`bpy` via the **BlenderMCP** Python-exec tool, which can place N identical switches in a row from real spec).
2. **Hand-author the front panels** where accuracy is the whole point (Altair LED/switch arrangement, PDP-8/I console legends).
3. Pull **PBR materials from PolyHaven** (via BlenderMCP) and incidental props from generative tools — but **do not** rely on Hyper3D/Rodin for the hardware itself (organic topology, wrong proportions, no faithful legends).
4. **Export GLB:** apply transforms (Ctrl+A loc/rot/scale), center at origin, recalc normals outward, **PBR metallic-roughness only**, textures ≤ 2K, **name interactive meshes deliberately** (`switch_A0`, `led_run`, `panel_front`) so R3F can target parts by name. Validate in a glTF viewer before wiring up.

**Reality check on AI model generation:** Not viable end-to-end for authenticity-critical hardware. The valuable AI path is **procedural placement via Python-exec + reference photos**, with AI used only for materials/incidental props. (The user is setting up the Blender↔Claude connection; I can drive parametric panel generation through BlenderMCP once connected.)

---

## 5. Game design

### 5.1 Narrative & world (UT-themed)
A framing device: the player is a Cockrell School ECE student who finds a "computing time machine" in the ECE building. Each level is an era they visit; completing its challenges earns a component that powers the machine forward in time. **Final destination: TACC on the UT campus** — the payoff that the bleeding edge is literally in their backyard. Burnt-orange UI, Bevo/Hook-'em flourishes used tastefully, "museum exhibit" aesthetic per era.

### 5.2 Level arc (full game vision)
1. **ENIAC (1945)** — plugboard puzzle + diorama. "Software was physical wiring." (non-emulated)
2. **Manchester Baby / SSEM (1948)** — the stored-program leap; 7 instructions. First challenge: subtract, count to zero, find a divisor (echoing its historic highest-factor program).
3. **PDP-8 (1965)** — minicomputer ISA; toggle in a bootloader; 8 instructions, ISZ loops, multiply-by-repeated-addition, teletype I/O.
4. **Altair 8800 / Intel 8080 (1974)** — front-panel switch programming; registers expand; the canonical "toggle in a program, watch the LEDs blink."
5. **MOS 6502 (1976)** — *MVP machine* — registers + addressing modes + branches, then pixel-display challenges on the 32×32 screen.
6. **LC-3 (capstone)** — UT/Patt teaching ISA; bridges retro → modern coursework.
7. **TACC (finale)** — non-playable celebratory scene; contrast ENIAC vs Frontera.

### 5.3 Core gameplay loop (per machine)
**Read lesson/history beat → study the 3D hardware → write/enter a program → run on the real emulator → observe hardware + register state → pass the challenge → unlock next.**
- Two interaction modes per machine where historically apt: **(a) front-panel mode** (flip switches / toggle bits, the authentic-but-tedious path) and **(b) editor mode** (type assembly into CodeMirror — the "later era" convenience). Front-panel mode for early machines, editor for later, mirroring real history.
- **Register/memory inspector** always visible — the pedagogical heart: watch the accumulator, PC, flags change per step. Step / run / reset controls.

### 5.4 Challenge design principle
Each machine's challenges **echo its real first programs** so puzzle + history reinforce each other (SSEM → highest factor; PDP-8 → increment-and-skip loops; Altair → toggle-and-blink; 6502 → draw pixels / snake, mining the **Easy6502 / Wikiversity (public-domain) / 6502.org** curricula as ready-made content).

---

## 6. MVP definition — the 6502 vertical slice

**Why 6502 first** (despite being mid-timeline): best tooling and free curriculum (easy6502 CC-BY, Wikiversity PD, 6502.org), real text assembly, and **visually satisfying** pixel-drawing challenges that make a great demo. It proves the entire loop end-to-end; other machines then plug into the same framework.

**MVP must-haves:**
1. **One scene**: a 3D **Apple I / KIM-1–style 6502 machine** (GLB from Blender) with at least one interactive element (e.g., KIM-1 hex keypad or a power/reset toggle) + the 32×32 pixel display rendered on/near the hardware.
2. **6502 emulator + assembler** (forked easy6502) behind a uniform `Machine` interface:
   ```ts
   interface Machine {
     assemble(src: string): { bytes: Uint8Array; errors: AsmError[] }
     load(bytes: Uint8Array): void
     step(): void; run(): void; reset(): void
     getState(): { registers; flags; memory; cycles }
     onDisplayUpdate(cb): void   // pixel display / lamps
   }
   ```
3. **UI**: CodeMirror assembly editor (burnt-orange theme) + live register/flag/memory inspector + step/run/reset + console output.
4. **Challenge engine**: a JSON-defined challenge (prompt, starter code, success check on final state/output, hints). Ship **3–5 challenges**: load a value → store to screen (draw a pixel) → fill a row → fill the screen → simple loop ("snake"/animate).
5. **Progression + lesson text**: short history beats framing each challenge; UT-themed shell around it.
6. **Save state**: localStorage (challenge completion + last code).

**Explicitly deferred past MVP:** other machines, ENIAC plugboard, front-panel switch mode, LC-3, TACC finale, accounts/cloud save, audio.

---

## 7. Architecture (repo shape)

```
src/
  machines/                 # one folder per machine; all implement Machine interface
    mos6502/                # MVP: fork of easy6502 wrapped behind Machine
      assembler.ts
      cpu.ts
      display.ts
      index.ts              # exports Machine impl
  engine/
    machineInterface.ts     # the uniform Machine contract (§6)
    challengeRunner.ts      # loads challenge JSON, runs, checks success
    progression.ts          # unlock graph, localStorage persistence
  scene/                    # R3F
    MachineScene.tsx        # loads GLB, wires named meshes -> interaction
    Hardware6502.tsx
    Display.tsx             # pixel display as a texture/plane
  ui/
    CodeEditor.tsx          # CodeMirror 6 + 6502 syntax mode
    RegisterInspector.tsx
    Console.tsx
    LessonPanel.tsx
  content/
    challenges/6502/*.json  # challenge definitions + lesson text
  app/
    GameShell.tsx           # UT-themed layout, routing between levels
assets/
  models/6502.glb           # from Blender (named meshes)
```
**Key design rule:** the **`Machine` interface is the seam** — every future machine (8080, PDP-8, SSEM, LC-3) implements it, and the challenge engine + UI never know which machine they're driving. This is what makes "build one deep, then add eras" cheap.

### 7.1 Levels must be drop-in replicable (first-class requirement)
We will keep adding machines after the 6502, so **adding a new level must require zero changes to the engine, UI, or shell** — only new files in known locations. Enforce this from day one, even though the MVP has one machine:

- **A level = a self-contained folder, nothing more.** Everything a level needs lives under `src/machines/<name>/` (emulator wrapped behind `Machine`), `src/content/challenges/<name>/*.json` (challenges + lesson text), and `assets/models/<name>.glb` (named meshes). No level-specific code anywhere else.
- **Registration is data, not code.** A single `src/content/levels.ts` registry lists levels in chronological order with `{ id, title, year, machineFactory, challengeDir, modelPath, blurb }`. The shell renders whatever the registry contains — adding a level means adding one entry, not editing components.
- **The `Machine` interface is the only contract.** If a new machine implements it, the editor, inspector, console, step/run/reset, challenge runner, and progression all work unchanged. Anything a machine needs that isn't in the interface is a signal the interface (not the engine) should evolve — extend it generically, never special-case a machine in the engine.
- **Challenges are pure declarative JSON** (prompt, starter code, success-check spec, hints, lesson) so non-programmers (or future-you) can author levels without touching TS. Keep the success-check expressed against the generic `getState()` shape, not machine internals.
- **Ship a `_template/` level** (a copyable machine folder + example challenge JSON + a `README` checklist: "to add a level, copy this, implement `Machine`, add challenges, drop the GLB, add one registry entry, done"). Build it as part of Phase 2 so the pattern is proven, not aspirational.
- **Per-machine difficulty/lesson content stays in the JSON**, so tuning a level never means a code change.

### 7.2 Keep a development log (DEVLOG.md)
Because this is a long, multi-level build (and partly AI-assisted), maintain a running **`DEVLOG.md`** at the repo root capturing the *process*, not just the result. Update it at the end of each work session / phase. Each entry records:
- **Date + phase**, what was built, and what works/doesn't yet.
- **Decisions & rationale** — especially anything that deviates from this PRD, and *why* (so the reasoning isn't lost).
- **Per-machine gotchas** — quirks of each emulator core, ISA edge cases, display-mapping details, license/attribution notes for that core. This becomes the cheat-sheet that makes the *next* level faster.
- **"How to add a level" learnings** — every time we add a machine, note any friction that the `_template/` or `Machine` interface should absorb, then fold it back in. The log feeds continuous improvement of the replication path.
- **Open questions / TODOs** carried forward.

Also keep `ATTRIBUTION.md` (license + credit for each reused core, e.g. easy6502 CC-BY) updated as cores are added — this is a compliance requirement, not optional.

---

## 8. Phased roadmap

- **Phase 0 — Scaffold:** Vite + React + TS + R3F project; placeholder cube scene; CodeMirror + inspector shell; create **`DEVLOG.md`** and **`ATTRIBUTION.md`** with their first entries. *(no emulator yet)*
- **Phase 1 — 6502 core:** fork/wrap easy6502 behind `Machine`; register inspector live; step/run/reset working with a hand-typed program.
- **Phase 2 — Challenge engine + level template:** JSON challenge format + success-checker; the `levels.ts` registry; wire 3–5 6502 challenges; progression + localStorage. Build the **`_template/` level** (copyable folder + checklist) and the registry-driven shell so replication is proven, not aspirational (§7.1).
- **Phase 3 — 3D hardware:** Blender-author the 6502 machine GLB (parametric, named meshes) via BlenderMCP; load in R3F; render pixel display on hardware; one interactive element.
- **Phase 4 — UT theming & polish:** burnt-orange UI, lesson/history beats, intro framing; playtest the vertical slice; tune challenge difficulty.
- **Phase 5 — Second machine (proof of extensibility):** drop in **Altair 8800** (wixette + 8080js) behind the same interface to validate the seam, *or* SSEM (reimplement) as the chronological "level 1." **This is the real test of §7.1** — it should require only a new `machines/` folder, challenge JSON, a GLB, and one `levels.ts` entry. Any friction encountered gets logged in `DEVLOG.md` and folded back into `_template/` and the `Machine` interface.

---

## 9. Risks & mitigations
- **License compliance** — attribute easy6502 (CC-BY); avoid GPL `fake6502` and AGPL SoCDP-8; verify "(verify)" repos before use. *(Confirm each LICENSE before importing code.)*
- **AI can't model accurate hardware** — use parametric/`bpy` + reference photos; AI only for materials/props.
- **Scope creep across 6 machines** — the `Machine` interface + "one deep first" discipline contains this; everything past the 6502 slice is explicitly deferred.
- **Emulator fork drift** — wrap, don't entangle; keep the fork isolated in `machines/mos6502/`.
- **Pixel-display fidelity** — easy6502's display model is documented; render as a texture on an R3F plane.

---

## 10. Verification (how we'll know the slice works)
1. **Unit:** assemble + run a known 6502 program (e.g. `LDA #$01; STA $0200`) and assert register/memory final state via `getState()`.
2. **Challenge engine:** each of the 3–5 challenges passes with its reference solution and fails with an empty/wrong program (success-checker is sound).
3. **3D:** GLB loads in R3F; named interactive mesh responds to click; pixel display updates when the program writes to display memory.
4. **End-to-end playtest:** a fresh player can open the app, read the first lesson, write/paste a solution, run it, see registers change + a pixel drawn, and unlock challenge 2 — with progress surviving a reload (localStorage).
5. **Run locally:** `npm run dev`, manual walkthrough of the full loop; optionally drive the browser via the Preview MCP for automated smoke-checking.
6. **Replicability check:** copying `_template/` and adding a trivial dummy level (one no-op challenge) makes it appear and play through the shell with **zero edits** to engine/UI/shell — proves the drop-in path from §7.1.
7. **Process check:** `DEVLOG.md` and `ATTRIBUTION.md` exist and have an entry per phase/added core.

---

## Open question for later (not blocking)
The MVP machine is the **6502** for tooling reasons, but narratively the game "starts at the first computer." Two equally valid framings: (a) ship the 6502 slice standalone as a demo and add earlier machines as prequel levels; or (b) immediately follow with the **SSEM** as chronological "level 1." Phase 5 will decide based on playtest feedback. *(No decision needed now.)*
