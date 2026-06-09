# DEVLOG — Hook 'Em, Boot 'Em

A running log of the *process* (PRD §7.2): what was built, decisions & rationale
(especially deviations from the PRD), per-machine gotchas, "how to add a level"
learnings, and open questions carried forward.

---

## 2026-06-06 — Phases 0–2 (scaffold, 6502 core, challenge engine + template)

### Built
- **Phase 0 — Scaffold.** Vite + React + TS + R3F project, hand-authored (no
  `create-vite` — the repo already contained `PRD.md`, which would have blocked
  the scaffolder, and hand-authoring gave full control of config). CodeMirror 6,
  Zustand, postprocessing wired. `DEVLOG.md` + `ATTRIBUTION.md` created.
- **Phase 1 — 6502 core.** Clean-room TypeScript 6502 behind the uniform
  `Machine` interface (`src/machines/mos6502/`):
  - `opcodes.ts` — single source of truth for all 151 documented opcodes
    (mnemonic+mode → byte for the assembler; byte → def for the CPU).
  - `cpu.ts` — functional (not cycle-exact) core: all addressing modes, correct
    NVZC flags, binary **and** BCD ADC/SBC, the indirect-JMP page bug, branch &
    page-cross cycle penalties.
  - `assembler.ts` — two-pass assembler: labels, `define`, `*=` origin, `dcb`
    data, lo/hi byte selectors, zp-vs-abs auto-selection, relative-branch range
    checks.
  - `display.ts` — easy6502 32×32 / 16-colour memory-mapped display.
  - `index.ts` — `Machine` impl wrapping the above.
- **Phase 2 — Challenge engine + level template.**
  - Declarative challenge JSON (`engine/challenge.ts`) with a generic
    `SuccessCheck` evaluated against `getState()` only (`engine/challengeRunner.ts`).
  - `content/levels.ts` registry + `content/challengeLoader.ts` (auto-discovery
    via `import.meta.glob`, ordered by filename).
  - `engine/progression.ts` — localStorage save (completion + per-challenge code
    + resume), in-order unlock rule.
  - 5 verified 6502 challenges: load → draw pixel → paint row → fill page →
    flood screen (pointers). Difficulty curve teaches registers → memory-mapped
    I/O → indexed loop → counter-wrap → zero-page pointers/`(zp),Y`.
  - **`_template/` level** (copyable minimal machine + example challenge +
    README checklist) — proves the drop-in path is real, not aspirational.
  - Full React UI: CodeEditor (burnt-orange 6502 syntax mode), RegisterInspector
    (renders from descriptor), Console, LessonPanel, and a UT-themed GameShell.
  - R3F scene with a primitive placeholder 6502 console + the **live pixel
    display rendered as a DataTexture on the hardware**, OrbitControls, bloom.

### Works
- `npm test`: **23/23 passing** — 6502 assembler/CPU semantics, all 5 challenge
  reference solutions pass + empty programs fail (§10.2), template drop-in (§10.6).
- `npm run dev`: full loop verified in-browser via the Preview MCP — typing a
  solution, Run/Step/Reset, registers/flags update, the screen lights up on the
  3D hardware, pass/fail feedback, all 5 challenges completed, **progress
  persists to localStorage** across reloads (§10.4).
- `tsc -b` clean.

### Decisions & rationale
- **Clean-room 6502 in TS, not a fork.** easy6502's sim is CC-BY JS embedded in a
  tutorial; reimplementing behind `Machine` keeps the fork from entangling the
  engine (PRD risk: "fork drift") and makes attribution clean. ISA/display/palette
  still credited to easy6502 in `ATTRIBUTION.md`.
- **Functional, not cycle-exact.** PRD calls for "real but simplified." Cycle
  counts are tracked approximately (base + page-cross + branch-taken) for the
  inspector; we are explicitly *not* a preservation project (SIMH exists).
- **`BRK` halts** (no IRQ vectoring). For a teaching emulator, "program ends" is
  the honest, useful behaviour; documented as a per-machine gotcha below.
- **Success-checks are pure data** against `getState()` so challenge authors
  never touch TS, and the engine never special-cases a machine.
- **Store owns the live `Machine`** (Zustand) and bridges its imperative
  step/run/reset into reactive state; the UI only ever sees the interface.

### Per-machine gotchas (6502)
- Display is memory-mapped at **$0200–$05FF**, 1 byte/pixel, low nibble = colour.
  `DataTexture` ignores `flipY` for raw data → we flip rows manually in
  `scene/Display.tsx` so memory row 0 shows at the top.
- `$FE` is refreshed with a random byte each instruction (easy6502 convention,
  used by snake-style programs); RNG is injectable for deterministic tests.
- Programs default to origin **$0600**; `load()` also points the reset vector
  ($FFFC) at the origin.
- zp-vs-abs: numeric operands < $100 assemble to zero-page; **forward label
  references assemble as absolute** (size must be known in pass 1).

### "How to add a level" learnings
- The `import.meta.glob` loader means **new challenge JSON needs no imports** —
  just drop `NN-name.json` in the right folder. Confirmed it picks up
  `_template/` automatically.
- One friction point folded in already: `SuccessCheck` fields like
  `rangeAllNonZero` are **single objects, not arrays** — a JSON authoring slip
  (wrapping in `[ ]`) silently mis-evaluated. Hardened the checker's `hex()` and
  documented the shape in `engine/challenge.ts`. (Consider a JSON schema later.)

### Open questions / TODOs (Phases 0–2)
- Consider a JSON schema for challenge files to catch authoring slips at build.
- Consider step-through highlighting of the current PC line in the editor.

---

## 2026-06-06 — Phases 3–4 (3D hardware, UT theming & polish)

### Built
- **Phase 3 — 3D hardware (Blender).** Authored the 6502 console
  **parametrically in Blender via BlenderMCP** (`bpy` script): case, angled front
  panel, screen + bezel, a 4×4 hex keypad, a power LED, and a burnt-orange reset
  knob. Followed PRD §4 export discipline — applied transforms, recalculated
  normals outward, PBR metallic-roughness materials, **deliberately named
  interactive meshes** (`screen`, `knob_reset`, `led_power`, `key_0`…`key_F`),
  cameras/lights excluded, Y-up. Exported to `assets/models/6502.glb` (~47 KB).
- **R3F integration.** `scene/HardwareModel.tsx` loads the GLB via `useGLTF`,
  finds `screen` by name and overlays the **live pixel display** (DataTexture) on
  it via a Box3-derived placement, makes `knob_reset` clickable (→ reset), and
  ties `led_power` emissive to run state. `scene/modelLoader.ts` resolves the
  registry's declarative `modelPath` to a Vite-served URL (`import.meta.glob`
  over root `assets/`), keeping levels pure data. `ModelErrorBoundary` falls back
  to the primitive placeholder if a GLB is missing/broken — the loop never breaks.
- **Phase 4 — Theming & polish.** One-time narrative **intro overlay**
  (`ui/IntroOverlay.tsx`, "you find a computing time machine…", persists a seen
  flag), brightened/retuned scene lighting + camera (3/4 top-down, lower
  exposure, calmer bloom), burnt-orange throughout.

### Works
- `npm test`: **23/23 passing**. `tsc -b` clean. `npm run build` succeeds and
  bundles the GLB into `dist/assets/`.
- In-browser (Preview MCP): GLB loads with **no console errors**, the screen mesh
  lights up burnt-orange when the flood-fill runs, all 5 challenges complete,
  progress persists across reloads, intro shows on first visit only.

### Decisions & rationale
- **fal.ai blocker:** the connected fal.ai account returned **403 "Exhausted
  balance"**, so AI texture/prop generation was unavailable this session. This
  only affected the *material enhancement* (PRD §4 endorses AI for
  materials/props **only**, never the authenticity-critical geometry). The
  hardware itself was authored by the **primary recommended path — parametric
  Blender** — with procedural PBR materials standing in for a fal texture.
  **TODO:** once the fal balance is topped up, generate a seamless retro-plastic
  base-color texture and pack it into `mat_case` (the bpy script + material slot
  are ready), and optionally an incidental desk prop. Wiring is already in place.
- **Root `assets/` (per PRD §7) served via glob import**, not `public/` — keeps
  the repo shape the PRD specifies while the level registry stays declarative.

### Per-machine gotchas (6502 / scene)
- Blender Z-up → glTF Y-up on export: the `screen` top face ends up facing +Y;
  the Display plane is placed at the screen bbox top with `rotation=[-π/2,0,0]`.
- `useGLTF` scene is cloned per mount to survive HMR / multiple mounts.
- **Camera/OrbitControls defaults only apply on a full mount** — editing the
  `camera` prop and HMR-reloading does NOT move the camera (controls retain
  state). Hard-reload to see new camera defaults.

### Model v2 (remade after review)
First GLB had a floating angled "panel_front" slab that intersected everything —
looked broken. Reworked from reference (Wikipedia KIM-1 + retro-computing
sources): a **flat single-board** design that reads as a real KIM-1-style 6502
SBC — green PCB, the signature **six red 7-segment LED digits**, a **24-key hex
keypad (6×4)** with a maroon function column, decorative DIP chips + a gold edge
connector, the burnt-orange reset button, and our color pixel `screen` inset with
a bezel. Keypad keys are now named `key_<row>_<col>`; the R3F bindings only use
`screen`/`knob_reset`/`led_power`, so no code change was needed (the interface
seam held). Tuned camera to a top-down 3/4 view and lowered exposure to tame LED
bloom.

### "How to add a level" learnings (folded into `_template/README.md`)
- A GLB needs only deliberate mesh names + a file in `assets/models/`; the
  registry `modelPath` + `modelLoader` resolve it with no code edits. Binding new
  interactive meshes is the one place that may need per-machine R3F code — that
  belongs in the machine's own `HardwareModel`-style component, not the engine.

### Open questions / TODOs (carried forward to Phase 5)
- Top up fal.ai → add the AI-generated case texture + an incidental prop.
- Audio, front-panel switch mode, LC-3, TACC finale remain deferred (MVP scope).
- Bundle is ~1.6 MB (three.js + postprocessing); code-split if it matters later.

---

## 2026-06-06 — Phase 5 (second machine: Manchester Baby / SSEM)

### Built — the real test of §7.1
Added the **SSEM (Manchester Baby, 1948)**, the world's first stored-program
computer, as chronological level 1. Chosen over the Altair because its 7-
instruction subtract-only ISA is trivial to reimplement (no license), its
Williams-tube store IS a 32×32 dot display (maps onto our display pipeline), and
its first program (highest factor by repeated subtraction) gives history-rich
challenges (PRD §5.4).

- `machines/ssem/`: `cpu.ts` (32-word × 32-bit store, one accumulator, CI,
  7 instructions: JMP/JRP/LDN/STO/SUB/CMP/STP — **no ADD**), `assembler.ts`
  (one line = one store word; labels, NUM data; packs to a 128-byte LE image),
  `display.ts` (renders the 32 words as the live 32×32 Williams-tube dot grid),
  `index.ts` (the `Machine` impl).
- `content/challenges/ssem/`: 5 history-forward challenges — load-negative →
  subtract (no add) → add-by-negation → loop with skip-if-negative → Kilburn's
  remainder-by-repeated-subtraction capstone. Each lesson tells the 1948 story
  (Williams/Kilburn/Tootill, the stored-program leap vs ENIAC's wiring, the
  52-minute first run on 2¹⁸).
- `assets/models/ssem.glb`: Blender-authored 1948 equipment cabinet — forward-
  facing CRT (the `screen`), glowing vacuum valves, metal dials, the burnt-orange
  `knob_reset`, red `led_power`.
- UI: a **time-travel era timeline** in the topbar (Manchester Baby → MOS 6502),
  clickable to switch machines.

### The seam held (the key result)
Adding a whole new era required **only**: a new `machines/ssem/` folder, challenge
JSON, one GLB, and **one `levels.ts` entry**. The challenge runner, progression,
inspector, console, editor, and scene all worked unchanged. The single shared
change was *generic*, not a special-case: `MachineDescriptor.registerBits` (the
SSEM accumulator is 32-bit), plus generalizing `HardwareModel` to orient the
display from the `screen` mesh's geometry (so a forward-facing CRT and an upward-
facing board both work) and auto-center any model. This is exactly the §7.1
contract working as designed.

### Works
- `npm test`: **40/40** (SSEM CPU semantics + all 5 references pass via the
  generic verifier + empty programs fail). `tsc -b` clean. `npm run build`
  bundles both GLBs.
- Verified live via DOM/eval: era timeline switches machines, all 5 SSEM
  challenges pass through the unchanged UI with in-order unlocking; the model
  renders (confirmed via a Blender still render of `ssem.glb`).

### Per-machine gotchas (SSEM)
- **No ADD**: add via `a+b = -(-a-b)`; **no plain load**: only LDN (load
  negative); **no copy**: copy a word by negating twice (LDN/STO/LDN). These
  quirks are the pedagogy and are surfaced in the lessons.
- **Simplifications (documented in `cpu.ts`):** CI modeled as a modern PC
  (execute-then-advance) and JMP/JRP take direct targets; the real Baby
  incremented CI before fetch and jumped indirectly through the store. The
  historically essential traits (subtract-only, load-negative, skip-if-negative,
  32×32 store, STP) are faithful.
- Store words travel through `Machine.load(bytes)` as a 128-byte little-endian
  image; challenge success-checks read the accumulator `A` (a register), keeping
  them on the generic `getState()` shape.

### Tooling note
The browser Preview screenshot tool began timing out at the capture layer this
session (the app itself is responsive — `eval` runs instantly and all
interactions succeed). Verified Phase 5 via DOM inspection + a Blender render
instead. Not an app bug.

### Open questions / TODOs (carried forward)
- Top up fal.ai → AI textures/props for the machines.

---

## 2026-06-06 — UI fixes + two more eras (LC-3, Altair 8800)

User asks: blend/hide scrollbars; make the default camera face each machine's
screen; fix the 32-bit register cell overflow ("A $00000000"); and "add the rest
of the computers."

### UI fixes
- **Scrollbars** blended into the theme (thin, dark thumb, transparent track;
  Firefox `scrollbar-*` + WebKit `::-webkit-scrollbar`).
- **Register overflow** fixed: the inspector cell grid widened (minmax 102px) and
  `.reg-val` font/letter-spacing tuned so an 8-hex-digit 32-bit value (the SSEM
  accumulator) fits; verified via DOM (val 101px < cell 119px, no overflow).
- **Camera auto-frames the screen.** `HardwareModel` now reports the screen
  mesh's world centre + facing normal; a `CameraRig` in the scene positions the
  camera in front of (and slightly above) the screen and points OrbitControls at
  it whenever the level changes. Works for upward-facing and viewer-facing
  screens alike — and for any future machine, no per-machine tuning.

### Two new eras (the arc is now five machines)
- **Altair 8800 / Intel 8080 (1974)** — inserted between PDP-8 and 6502.
  Faithful 8080 subset (`machines/altair8800/`): A,B,C,D,E,H,L + SP/PC, the five
  flags, MOV/MVI/LXI, all 8 ALU ops (reg+imm), INR/DCR/INX/DCX/DAD, jumps/calls/
  returns incl. conditional, PUSH/POP, LDA/STA/LDAX/STAX, OUT/IN, rotates. PAL-ish
  Intel-mnemonic assembler. Display = the iconic **front-panel red LED readout**
  (address+data buses). 5 challenges: registers → flags/loops → register pairs →
  OUT teletype → CALL/RET stack capstone. History: $439 kit, Popular Electronics
  Jan 1975, Microsoft's first product.
- **LC-3 (2003, capstone)** — the UT Austin / Patt & Patel teaching ISA, the EE
  306 bridge. `machines/lc3/`: 16-bit, R0–R7, N/Z/P, all 15 opcodes, PC-relative
  loads/stores, TRAP services (OUT/PUTS/GETC/HALT). Assembler with .ORIG/.FILL/
  .BLKW/.STRINGZ. It's an *abstract* machine with no raster display — descriptor
  omits `display`, the scene shows a terminal (display overlay gated off via a new
  `showDisplay` prop), and output goes to the console. 5 curriculum challenges:
  eight registers → branches/CC → load-store → Hello World (PUTS) → array-sum
  (LDR) capstone.
- Both ship a Blender GLB (Altair blue switch/LED box; LC-3 modern monitor +
  keyboard) and a spec card (the LC-3's is playful — "purely imaginary, an idea
  that runs on any computer").

### "Why the next stage" wiring, end to end
The bridges now chain cleanly: Baby (no add/IO, a tonne of racks) → PDP-8 (real
ISA, IO, but $18.5k cabinet) → Altair (personal, but a $439 switch-toggling kit)
→ 6502 (the $25 chip that finished the job) → LC-3 (distilled for teaching → C/
compilers + TACC supercomputing). Each level's sandbox lesson names the specific
limitation the next era resolves; the "Travel to <next era>" button follows the
chronological registry order.

### Works
- `npm test`: **91/91** (each new machine's semantics + all 5 levels' references
  via the generic verifier; sandboxes skipped). `tsc -b` clean; `npm run build`
  bundles all five GLBs (~1.7 MB JS, 507 KB gzip).
- Verified live via DOM/eval: era timeline reads 1948→1965→1974→1976→2003;
  every Altair & LC-3 challenge passes; teletype/console prints "HI","ALTAIR",
  "HELLO","HOOK EM"; spec cards + sandboxes work; register cell no longer
  overflows. (Browser screenshot tool still timing out at the capture layer —
  verified via DOM + Blender renders.)

### The seam held (five times now)
Two more ISAs — one with a brand-new display *kind* (front-panel LEDs) and one
with *no* display at all — dropped in as `machines/` folders + challenge JSON +
GLBs + one `levels.ts` line each. The only generic engine change across all of
Phase 5+ was additive: `registerBits` and a `showDisplay`/`onFrame` plumb-through
in the scene. No special-casing anywhere in the engine or challenge runner.

### Remaining special-format experiences (not assembly machines)
- **ENIAC (1945)** — would be the chronological first, but it's a plugboard
  *patch-the-cables* mini-game, not an assembly ISA (PRD §5.2). Needs bespoke UI
  outside the editor/Machine model.
- **TACC finale** — a non-playable celebratory scene contrasting ENIAC vs
  Frontera (PRD §5.2). A cutscene, not a machine.
  Both are better built as their own custom experiences than forced through the
  assembly seam.

---

## 2026-06-06 — The bookends: ENIAC plugboard + TACC finale (arc complete)

Completed the full chronological arc (7 eras) by adding the two non-assembly
experiences the PRD calls for.

### Level kinds (generic extension)
`Level.kind` = "assembly" (default) | "puzzle" | "finale"; `machineFactory` and
`challengeDir` are now optional. The store guards non-assembly levels
(`mountNonAssembly`: no machine, no code) and gained a generic `markComplete`.
The shell branches on `kind`: assembly → editor view; puzzle → `<EniacLevel>`;
finale → `<TaccFinale>`. The era timeline + progression stay generic across all
kinds. The five assembly machines were untouched.

### ENIAC (1945) — the plugboard puzzle (chronological level 1)
"Software was physical wiring." A non-assembly dataflow puzzle: constant SOURCES
feed ACCUMULATORS (which add) feed the OUTPUT; the player runs **patch cables**
(click an output jack, then an input jack; click a cable to remove). Pure
evaluator in `engine/puzzle.ts` (verified in `puzzle.test.ts`), SVG board in
`ui/PlugboardPuzzle.tsx`, 3 puzzles + sandbox in `content/puzzles/eniac/`. The
lessons hit the history hard: 30 tons, 18,000 tubes, no stored program,
reprogrammed by rewiring (often by six women mathematicians), and the
von-Neumann stored-program idea that motivates the Baby. The sandbox bridge →
1948.

### TACC (finale) — closing the arc
A non-playable celebratory scene (`ui/TaccFinale.tsx`): an ENIAC-1945 vs
TACC-today comparison table (size, speed, memory, power, how-you-program-it), a
recap of every leap the player actually programmed, and a "travel back to 1945"
replay button — the room-to-backyard payoff (PRD §5.1).

### Works
- `npm test`: **95/95** (plugboard evaluator + the 5 assembly machines + all
  references; non-assembly levels excluded from the assembly verifier). `tsc -b`
  clean; `npm run build` succeeds.
- Verified live via DOM/eval: era timeline reads **1945→1948→1965→1974→1976→
  2003→2024**; the ENIAC plugboard solves (wire source→OUTPUT, output=42, banner
  shows, completion persists); the TACC finale renders with the comparison +
  replay.

### Gotcha / TODO
- **Blender MCP disconnected** mid-session, so I couldn't author an `eniac.glb`.
  The ENIAC scene uses a CSS/SVG "diorama" (pulsing tubes + patch cables) instead
  — robust and Blender-independent. TODO: when Blender + fal.ai are back, author a
  proper ENIAC GLB and point the registry's modelPath at it (the model-loading
  path already supports it).

---

## 2026-06-06 — Era pedagogy (specs, "why-next" bridges, sandbox) + PDP-8

User asks: keep the game chronological; design challenges so the player feels
*why humanity needed the next stage*; add an end-of-level **sandbox** for free
play; and **show each machine's physical size**.

### Built — generic features (all eras, no per-machine code)
- **Spec card** (`ui/SpecCard.tsx` + `Level.specs`): an overlay on the 3D scene
  showing real size / weight / memory / speed / price for each machine, size
  first — so the room→wardrobe→chip scale contrast lands. Filled in for every era.
- **"Why the next stage" bridges**: authored as each level's **sandbox** lesson,
  explicitly naming the limitation this machine hits and the advance the next era
  brings (Baby: no I/O, no add, a tonne of racks → minicomputer; PDP-8: $18.5k
  cabinet → microprocessor; 6502: assembly is hard, one chip isn't enough →
  LC-3 + TACC). The challenge arcs themselves are designed around the gaps:
  SSEM (no add) → PDP-8 (real add, loops, **subroutines**, **Teletype I/O**).
- **Sandbox mode** (`Challenge.sandbox`): a no-objective free-play entry, last in
  each level (∞ dot), unlocked after the challenges. The store skips success
  evaluation; the shell shows a sandbox note + a **"Travel to <next era> →"**
  button driven by the chronological `LEVELS` order. The verifier skips sandboxes.
- Chronological ordering is the single source of truth in `levels.ts` (kept
  sorted by year); the era timeline, unlock flow, and "travel to next era" all
  follow it.

### Built — the PDP-8 (1965), inserted between SSEM and 6502
- `machines/pdp8/`: faithful-subset 12-bit core — `cpu.ts` (AC + Link + PC,
  6 memory-reference ops with page/indirect + autoindex addressing, the OPR
  group-1/2 microcode, Teletype IOTs), `assembler.ts` (PAL-style: `*origin`,
  `LABEL,`, `SYM=val`, auto page/indirect selection, OR-combined micro-ops,
  decimal-default numbers), `display.ts` (the **front-panel lamp readout** —
  AC/PC/MB as a live 12×3 amber lamp grid), `index.ts`.
- 5 history-rich challenges + sandbox: TAD addition ("a computer you could buy")
  → ISZ loop → multiply-by-repeated-addition → **Teletype output** (the I/O the
  Baby never had) → **JMS subroutine** capstone (printing "PDP"). Lessons cover
  DEC 1965, ~$18.5k, ~50,000 sold, the refrigerator-sized cabinet, octal culture.
- `assets/models/pdp8.glb`: a PDP-8/I-style console — beige cabinet, DEC blue
  front panel with magenta trim, the lamp panel (`screen`), two rows of toggle
  switches, `knob_reset`, `led_power`.

### The seam, again
PDP-8 dropped in as a new `machines/` folder + challenge JSON + one GLB + one
`levels.ts` line. No engine/UI/shell edits. The display pipeline absorbed a
third, totally different display kind (lamp panel) with zero changes — it just
pushes RGBA frames like the others.

### Works
- `npm test`: **57/57** (PDP-8 semantics: TAD carry→Link, ISZ skip, multiply,
  Teletype, JMS/JMP-I; all references for all 3 levels pass; sandboxes skipped).
  `tsc -b` clean; `npm run build` bundles all three GLBs.
- Verified live via DOM/eval: era timeline reads 1948 → 1965 → 1976; all PDP-8
  challenges pass; teletype prints "HI"/"PDP"; the spec cards show sizes; the
  sandbox prints "HELLO" and offers "Travel to … →". (Browser screenshot tool
  still timing out at the capture layer — verified via DOM + Blender renders.)

### Per-machine gotchas (PDP-8)
- **No multiply** (build from TAD + loop); **no stack** (JMS stores the return
  address in the subroutine's first word; return via `JMP I sub`). These are the
  pedagogy and are surfaced in lessons.
- `TAD` *adds* to AC (doesn't load) — easy to forget to `CLA` first in a print
  loop (hit this in the sandbox starter; fixed).
- Assembler programs must be contiguous from their origin (default `*200`);
  good enough for the challenge set, documented in `assembler.ts`.

---

## 2026-06-06 — LC-3 live terminal + a human-voice copy pass

### LC-3 screen now works
The LC-3 had no raster display, so its 3D monitor showed nothing. Added a new
display kind: `MachineDescriptor.terminal`. `HardwareModel` now takes a
`screenKind` ("raster" | "terminal" | "none"); MachineScene derives it from the
descriptor. New `scene/TerminalScreen.tsx` renders the console output to a
`CanvasTexture` (green-on-black, blinking cursor) on the screen mesh, so the
LC-3 monitor shows OUT/PUTS output live. Also retuned the camera so
forward-facing screens are framed head-on and tight (the LC-3 keyboard/stand no
longer dominate the shot).

### Human-voice copy pass (no em dashes)
Rewrote ALL player-facing text in a warmer, more conversational voice and
removed em dashes entirely (per the user's request), using commas / periods /
parentheses instead, and turning ranges like "1-2 MHz" into "1 to 2". Scope:
every level blurb + spec card (including the SpecCard separator), all ~34
challenge and puzzle lessons / prompts / successText / labels, and the UI strings
(intro, finale, console, sandbox notes, captions). Only JSDoc code comments
still contain em dashes (developer-only, never shown). All `reference` solutions
were preserved verbatim; `npm test` stays 95/95 green, confirming nothing broke.

---

## 2026-06-06 — ENIAC diorama (Blender back), fal.ai still blocked

Blender's MCP came back online, so I built the ENIAC scene properly.

- First attempt was a baked render still, but it read as a flat image (the user
  called it out). Replaced it with a **live, orbit-able 3D model** like every
  other era. Authored a compact ENIAC GLB in Blender: a U of vacuum-tube
  cabinets with glowing tubes, the burnt-orange `knob_reset`, and `led_power`.
  Kept the footprint small (no oversized floor) so the bounding box frames well.
- ENIAC has no display, so `HardwareModel` reports a **"diorama" frame**
  (whole-model bbox, front-and-above) when a model lacks a `screen` mesh, and
  `CameraRig` gives it a 3/4 museum framing. The earlier "dark" ENIAC was the old
  model's 6.5 m floor blowing up the bbox and pushing the camera too far; with
  the compact model the framing is correct (verified by logging the rig). This
  is generic, so any future screen-less live model frames itself.
- **fal.ai is still balance-blocked** (403 "Exhausted balance"), unchanged. All
  models are pure parametric Blender; no AI textures. Top up to enable that path.

### ENIAC plugboard: drag-to-wire
Added drag-to-connect alongside the existing click-to-connect (`PlugboardPuzzle`):
press an output jack, drag a live dashed cable to an input jack, release to
connect. Input jacks highlight + grow while a drag is in flight. Implemented
with pointer events (pointerdown on output starts the drag, the SVG's
pointermove updates the preview in viewBox coords, the input jack's pointerup
commits, and a window pointerup cancels a drag released on empty space). Click
mode is untouched, and clicking a cable still removes it. Verified both paths in
the browser (drag and click each solve puzzle 1); tests stay 95/95.

### Scale figures, whole-machine framing, knob-hover fix
Three small UX fixes:
- **Human scale figure** (`ScaleFigure`): a simple blue silhouette stands beside
  each physical machine, sized per level (`Level.figureHeight`, in model units)
  so the real-world scale reads: a person dwarfed by the ENIAC room, about a
  PDP-8 console's height, towering over a flat 6502 board. The LC-3 (imaginary)
  gets none.
- **Whole-machine framing**: `HardwareModel` now reports a frame covering the
  model + figure as a bounding sphere; `CameraRig` fits it using the *actual*
  viewport aspect (the scene column is narrow/portrait, so width is the limiting
  FOV — earlier framing zoomed wide models in too far). Default view is a 3/4
  front-above shot that takes in the whole machine with the screen still visible.
- **Knob hover fix**: the reset knob's hover "tweaked out" because a group-wide
  `onPointerMove` toggled state as the ray crossed nearby meshes. Replaced with a
  single invisible hit-sphere over the knob using stable `onPointerOver`/`Out`.
Verified ENIAC (figure dwarfed), PDP-8 (figure ~console height) and 6502 (figure
towers over the board) frame well; LC-3 keeps its terminal and no figure. 95/95.

---

## 2026-06-09 — Patt-grade fame pass: Commodore 64, Nintendo 64, iPhone

Major arc rework before emailing Yale Patt and other UT ECE professors. Three
problems a Patt-grade reviewer would spot in the prior arc:
1. "MOS 6502" framed a chip as a computer.
2. A 27-year gap between 1976 and 2003 skipped the RISC revolution and the
   entire 80s/90s desktop era.
3. Nothing real, famous, or recognizable to current undergrads between LC-3
   (which is imaginary by design) and TACC.

User insisted on a **fame-first** arc: every post-1980 level had to be a
machine UT students would instantly recognize.

### Final arc (9 eras, in strict chronological order)
1945 ENIAC → 1948 Manchester Baby → 1965 PDP-8 → 1974 Altair 8800 →
**1982 Commodore 64** (renamed from "MOS 6502") → **1996 Nintendo 64** (new) →
2000 LC-3 (year corrected from 2003) → **2007 iPhone** (new) → today TACC.

### Renamed: MOS 6502 → Commodore 64 (1982)
- `git mv src/content/challenges/6502 → commodore64` (5 challenges + sandbox).
- Level entry: id, title, year, challengeDir all updated; specs rewritten as
  C64 facts (17 million sold, 64 KB RAM, 1 MHz 6510, $595 launch).
  `machineFactory` stays `createMos6502` — the C64's 6510 is functionally a
  6502 with an extra I/O port, defensibly the same teaching ISA.
- New Blender model: beige breadbox keyboard with the rainbow-stripe accent,
  function-key column, and an inset CRT for the live 32×32 pixel display.

### NEW: Nintendo 64 (1996, MIPS R4300i)
`src/machines/mips/` — a clean teaching subset of MIPS in the spirit of SPIM
and MARS:
- `cpu.ts`: 32 GP regs ($0 hardwired), R/I/J types (add, sub, and/or/xor, slt,
  sll, srl, addi/andi/ori/slti, lui, lw/sw, beq/bne, j/jal, jr), syscall on
  $v0 (1=print int, 4=print string, 10=exit).
- `assembler.ts`: two-pass; `.text` / `.data` sections; labels; `.word`,
  `.asciiz`; `li`/`la`/`move` pseudo-ops; `offset($reg)` memory addressing.
- `mips.test.ts`: 6 unit tests, all pass.
- N64 Blender model: charcoal console with the iconic giant cartridge sticking
  up, four colored controller ports, red power button. Bundled with a small
  CRT behind the console so the syscall terminal renders on a real TV.
- 5 challenges + sandbox covering registers → branches → load-store →
  hello-world → array-sum capstone (same shape as LC-3's, deliberately).

### NEW: iPhone (2007, ARM64 teaching subset)
`src/machines/arm/` — small ARM64-flavored teaching CPU:
- `cpu.ts`: 64-bit registers via BigInt64Array, x0-x9 + sp/lr/pc named, NZCV
  flags. MOV / ADD / SUB / AND / ORR / EOR (reg or 8-bit immediate),
  LDR / STR with `[base, #offset]`, CMP, B + B.EQ/NE/LT/GT/LE/GE, BL/RET,
  SVC #0 with Darwin-style x16=svc-num convention (1=print int, 4=print
  string, 93=exit).
- `assembler.ts`: real ARM64 syntax (`mov x0, #5`, `cmp x1, x2`, `b.ne loop`,
  `[x1, #4]`). Emits a private 32-bit teaching bytecode rather than real ARM
  machine code — the syntax is what matters for recognition; the wire format
  is internal.
- `arm.test.ts`: 6 unit tests, all pass on first run.
- iPhone Blender model: glass-and-titanium slab with camera plateau, side
  buttons, Dynamic Island. The `screen` mesh is the phone's front face, so
  the live syscall terminal renders right where the iPhone's display is.
  That's the perfect visual metaphor.
- 5 challenges + sandbox: modern-registers → CMP+B.NE → LDR/STR → hello-world
  → array-sum. Same capstone shape as MIPS and LC-3, deliberately, so the
  player feels the pattern travel across architectures.

### Bridge prose pass
- Altair sandbox now bridges to the Commodore 64 (was vaguely "the 6502 chip").
- Commodore 64 sandbox now bridges to the Nintendo 64 (RISC revolution).
- New N64 sandbox bridges to LC-3 (teaching distillation of RISC).
- LC-3 lesson 01 calls back to MIPS's 32-register file ("LC-3 trims to 8 so
  the whole ISA fits on one page").
- LC-3 lesson 05 calls back to MIPS's array-sum loop ("you've written this
  exact shape once already; you'll write it again on ARM").
- LC-3 sandbox now bridges to the iPhone (real modern ARM hardware).
- iPhone sandbox bridges to TACC.

### Results
- `npm test`: **129/129 passing** (up from 95). 12 new CPU unit tests + 22
  new auto-verified reference solutions through the generic engine, on top
  of the 95 we had before. `tsc -b` clean.
- The §7.1 seam held twice more: MIPS and ARM each dropped in as just a new
  `machines/<id>/` folder + challenge JSON + Blender GLB + one `levels.ts`
  entry. No engine, UI, or shell edits required.
- LC-3 year corrected 2003 → 2000 (Patt & Patel 1st ed).
