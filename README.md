# Hook 'Em, Boot 'Em

> An interactive 3D game on the history of computer architecture, for UT Austin
> ECE students. Program nine landmark eras from ENIAC to the iPhone in their own
> assembly languages, on interactive 3D recreations of the actual hardware.

A web-first journey through nine landmark eras of computing. You play a
Cockrell School ECE student who finds a "computing time machine" in the basement
of the ECE building. To power it forward through history, you write real
(simplified) assembly for each era's actual ISA, on a 3D model of the actual
hardware, with the screen, lamps, and teletype responding live.

The arc runs in strict chronological order, and each level's final sandbox
explains why humanity needed the next stage of computing. It ends, fittingly,
at the Texas Advanced Computing Center on UT's own campus, where some of the
fastest machines on Earth are humming away a short walk across the Forty Acres.

[![Tests](https://img.shields.io/badge/tests-129%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()

---

## The journey

Nine eras, in strict chronological order. Each one is a **famous, recognizable
computer** (or, for ENIAC, a famous experience), and each one teaches the
single architectural concept that motivated the next era.

| Year | Machine | What it teaches |
|---|---|---|
| 1945 | **ENIAC** | "Software was wiring." A patch-cable plugboard puzzle: sources feed accumulators that feed the output. Drag a cable or click to wire it up. |
| 1948 | **Manchester Baby (SSEM)** | The first stored-program computer. Seven instructions, 32 words, no ADD (you subtract and negate your way to everything). |
| 1965 | **DEC PDP-8** | The minicomputer that escaped the air-conditioned room. Real addition, ISZ loops, JMS subroutines, a clattering Teletype. |
| 1974 | **Altair 8800** (Intel 8080) | The $439 mail-order kit that launched the personal computer. Seven registers, a real stack with CALL/RET, blinking LEDs. |
| 1982 | **Commodore 64** (MOS 6502) | The best-selling computer of all time. 17 million sold. Programmable through its MOS 6510 (a 6502 variant) with a 32 by 32 screen to draw on. |
| 1996 | **Nintendo 64** (MIPS R4300i) | The console you blew into. The MIPS architecture inside is the canonical RISC: 32 registers, load-store, syscalls. The chip family that ran a generation of Unix workstations. |
| 2000 | **LC-3** | UT Austin's teaching ISA (Patt & Patel, EE 306). Eight registers, condition codes, TRAP services. The bridge to modern coursework. |
| 2007 | **iPhone** (ARM64) | The slab of glass that changed how the world thinks about computers. ARM, the most-shipped CPU architecture in history. Roughly 250 billion units. |
| Today | **TACC** | A celebratory finale. ENIAC vs Frontera, side by side, with a recap of every leap you actually programmed. |

Each assembly era ships its own historically faithful (but pedagogically
simplified) ISA, a Blender-authored 3D model with named interactive meshes, a
spec card showing the machine's real size and price, history-rich lessons, a
counter-difficulty challenge arc, and a free-play sandbox whose lesson explains
why the next era had to exist.

---

## Running it

Requirements: Node.js 22+, npm.

```bash
git clone https://github.com/themoddedcube/hook-em-boot-em.git
cd hook-em-boot-em
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm test             # run the test suite (Vitest)
npm run build        # production build into dist/
npm run preview      # serve the production build
npm run typecheck    # tsc -b --noEmit
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Web (browser) | Zero install, share by URL, reuse the JS ecosystem. |
| Framework | React 18 + TypeScript + Vite | Fast DX, strict types, panel-heavy UI. |
| 3D | React Three Fiber + Drei + Postprocessing | Declarative scene graph, screen overlays, bloom. |
| Editor | CodeMirror 6 | Lightweight, themeable; custom 6502 / Intel / LC-3 syntax modes. |
| State | Zustand | Minimal store bridging the imperative Machine into reactive React state. |
| 3D assets | Blender (parametric) | Authored via the Blender MCP server with `bpy` Python, exported as GLB. |
| Tests | Vitest | 129 tests covering every CPU, every assembler, every reference solution. |

---

## The architecture: one Machine interface, seven assembly cores

The whole project hangs off a single TypeScript interface in
[`src/engine/machineInterface.ts`](src/engine/machineInterface.ts):

```ts
interface Machine {
  readonly descriptor: MachineDescriptor;
  assemble(src: string): AssembleResult;
  load(bytes: Uint8Array, origin?: number): void;
  step(): void;
  run(maxSteps?: number): void;
  reset(): void;
  getState(): MachineState;
  onDisplayUpdate(cb: DisplayCallback): () => void;
  onOutput(cb: OutputCallback): () => void;
}
```

Every assembly era implements this interface, with seven cores covering the
full arc:

| ISA | Machines using it | Implementation |
|---|---|---|
| MOS 6502 | Commodore 64 (1982) | `src/machines/mos6502/` |
| SSEM | Manchester Baby (1948) | `src/machines/ssem/` |
| PDP-8 | DEC PDP-8 (1965) | `src/machines/pdp8/` |
| Intel 8080 | Altair 8800 (1974) | `src/machines/altair8800/` |
| MIPS | Nintendo 64 (1996) | `src/machines/mips/` |
| LC-3 | LC-3 (2000) | `src/machines/lc3/` |
| ARM64 | iPhone (2007) | `src/machines/arm/` |

**The engine, UI, challenge runner, and progression know nothing about which
machine they are driving.** The register inspector renders itself from the
descriptor. The challenge success-checks are written against the generic
`MachineState` shape (registers, flags, memory), never against any machine's
internals.

That is the entire trick. Adding a new era is just:

1. A new `src/machines/<id>/` folder implementing `Machine`.
2. Challenge JSON under `src/content/challenges/<dir>/`.
3. A Blender-authored GLB at `assets/models/<id>.glb` with deliberately named
   meshes (`screen`, `knob_reset`, `led_power`, ...).
4. **One** new entry in [`src/content/levels.ts`](src/content/levels.ts).

The PRD spells this out in §7.1; see
[`src/machines/_template/README.md`](src/machines/_template/README.md) for the
copyable starter and the full checklist.

The ENIAC plugboard (a non-assembly "puzzle" level) and the TACC finale (a
non-playable "finale") use a small extension of the same idea:
`Level.kind = "assembly" | "puzzle" | "finale"`, with the shell branching
between the three experiences. The era timeline and progression stay generic
across all kinds.

---

## Pedagogy

Each level's challenge arc is built around the previous machine's pain, so the
player feels the next leap before reading about it.

- **Baby** has no I/O, no add, and weighs a tonne. So 1965 needs a minicomputer.
- **PDP-8** is real but still $18,500 and fridge-sized. So 1974 needs the
  microprocessor and the personal kit.
- **Altair** is personal but a $439 kit with switches. So 1982 needs the
  Commodore 64: cheap, easy, and on 17 million desks.
- **Commodore 64** flooded the world with 8-bit computers, but the CISC
  approach was hitting limits. So the mid-80s brought the RISC revolution and
  by 1996 the Nintendo 64's MIPS chip put it in millions of living rooms.
- **MIPS** and its cousins were everywhere but each chip was its own dialect.
  So 2000 brought a teaching ISA, the LC-3, designed to distill RISC into
  something a student can read in an afternoon.
- **LC-3** is imaginary, on purpose. So the arc closes on a real, modern,
  in-shipping computer: the **iPhone**, with the ARM architecture that's now
  in every phone, every Apple Silicon Mac, and an increasing share of TACC.

Each level ends with a free-play **sandbox** (the ∞ button) whose lesson is the
bridge to the next era. A spec card overlay shows the machine's real size,
weight, memory, speed, and price, so the room-to-fingernail scale lands.

---

## Project structure

```
src/
  machines/                Each folder implements the Machine interface.
    mos6502/  ssem/  pdp8/  altair8800/  mips/  lc3/  arm/  _template/
  engine/
    machineInterface.ts    The seam. Everything talks through this.
    challengeRunner.ts     Generic assemble + run + success-check.
    puzzle.ts              ENIAC plugboard dataflow evaluator.
    progression.ts         localStorage save + unlock rule.
    level.ts               Level type (assembly / puzzle / finale).
  content/
    levels.ts              The level registry, sorted by year.
    challenges/<dir>/*.json   Auto-discovered challenge JSON per era.
    puzzles/eniac/*.json      ENIAC plugboard puzzles.
  scene/                   React Three Fiber: GLB loader, camera rig, displays.
  ui/                      CodeMirror editor, inspector, console, lesson panel,
                           plugboard, intro, finale, spec card.
  state/gameStore.ts       Zustand store bridging Machine into React.
  app/GameShell.tsx        The top-level shell + era timeline.
assets/models/             Blender GLBs for each machine.
src/content/challenges/    All challenge JSON, one folder per era.
DEVLOG.md                  Running build log: decisions, gotchas, what's next.
ATTRIBUTION.md             Per-source licenses + credits (CC BY for easy6502, etc).
PRD.md                     The original product requirements doc.
```

---

## Verification

The test suite covers:

- Every CPU's semantics (carry, condition codes, addressing modes, JSR/RET, ISZ
  skip, the SSEM's subtract-only arithmetic, the LC-3's PC-relative loads, etc).
- Every assembler (labels, directives, branch-range checks, syntax errors).
- The ENIAC plugboard evaluator (sources, accumulators, output).
- A **generic verifier** that loads every shipped challenge's `reference`
  solution through the standard challenge runner and asserts it passes (and that
  an empty program fails). This proves every success-checker is sound and every
  level is actually solvable.

```bash
$ npm test
Test Files  10 passed (10)
Tests       129 passed (129)
```

---

## Adding a new era

See [`src/machines/_template/README.md`](src/machines/_template/README.md). The
short version: copy `_template/`, replace its toy ISA with your machine's real
assembler + CPU, drop in challenge JSON, author a GLB with the right named
meshes, add one entry to `levels.ts`. **No edits to the engine, UI, or shell.**

---

## Credits

- **ISA references**: the published specifications for each machine (PDP-8
  Small Computer Handbook, Intel 8080 manual, the LC-3 textbook by Yale Patt
  and Sanjay Patel, the SSEM and ENIAC historical record, etc).
- **6502 inspiration**: the [easy6502](https://github.com/skilldrick/easy6502)
  tutorial by Nick Morgan (CC BY 4.0). Our 6502 emulator is an original
  TypeScript implementation; the 32 by 32 display layout and 16-color palette
  follow easy6502's convention.
- **LC-3**: designed by Yale Patt and Sanjay Patel for "Introduction to
  Computing Systems" (the textbook used in UT Austin's EE 306).

See [`ATTRIBUTION.md`](ATTRIBUTION.md) for the full per-source breakdown.

---

## License notes

This project's own code is yours under the repository's license. Third-party
content retains the licenses listed in `ATTRIBUTION.md`. We avoided any
copyleft-incompatible cores on purpose (no GPL `fake6502`, no AGPL SoCDP-8); the
historical-machine implementations are clean-room TypeScript from public ISA
specifications.

---

## Project documents

- [`PRD.md`](PRD.md): the product requirements that drove the design.
- [`DEVLOG.md`](DEVLOG.md): a running build log with decisions, gotchas, and
  what's next. Updated at the end of each work session.
- [`ATTRIBUTION.md`](ATTRIBUTION.md): per-source credits and license notes.

---

Hook 'em. 🤘
