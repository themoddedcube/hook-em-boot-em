# Attribution & Licenses

This project reuses, ports, and is informed by several open resources. Per
PRD §9 this file is a **compliance requirement** and is updated as cores/assets
are added. The project's own code is under the repository's license; third-party
content retains the licenses below.

## Emulator cores & ISA references

| Component | Source | License | How it's used |
|---|---|---|---|
| **MOS 6502** ISA, 32×32 display model, 16-colour palette | [skilldrick/easy6502](https://github.com/skilldrick/easy6502) | **CC BY 4.0** | Our 6502 assembler + CPU in `src/machines/mos6502/` are a clean-room TypeScript reimplementation of the documented 6502 ISA. The **memory-mapped display layout** ($0200–$05FF), the **$FE random byte / $FF last-key** convention, and the **16-colour palette** follow the easy6502 tutorial. Attribution required by CC BY 4.0; see note below. |
| 6502 opcode/cycle reference | [6502.org](http://www.6502.org/) | reference only | Cross-checked opcode bytes, addressing modes, and cycle counts. |
| **SSEM / Manchester Baby** ISA + behaviour | historical spec (University of Manchester; Wikipedia & retro-computing sources) | **our own code** | `machines/ssem/` is an original TypeScript implementation from the documented 7-instruction ISA — no third-party code. Historical facts (21 June 1948 first run, Williams/Kilburn/Tootill, the highest-factor first program) used in lesson text are public historical record. |
| **DEC PDP-8** ISA + behaviour | documented PDP-8 spec (DEC Small Computer Handbook; Wikipedia & retro-computing sources) | **our own code** | `machines/pdp8/` is an original TypeScript implementation of a faithful subset (memory-reference + OPR microcode + Teletype IOTs). Historical facts (1965, DEC, ~$18.5k, ~50,000 sold) are public record. |
| **Intel 8080 / Altair 8800** ISA + behaviour | documented 8080 ISA (Intel 8080 manual; Wikipedia & retro-computing sources) | **our own code** | `machines/altair8800/` is an original TypeScript implementation of a faithful 8080 subset. Historical facts (1974–75, MITS, $439 kit, Popular Electronics, Altair BASIC) are public record. |
| **LC-3** ISA + behaviour | "Introduction to Computing Systems" (Patt & Patel) — published ISA spec | **our own code** | `machines/lc3/` is an original TypeScript implementation from the published LC-3 ISA. The LC-3 is a teaching specification; our code is independent. Credit to Yale Patt & Sanjay Patel for the ISA design. |
| **MIPS** ISA + behaviour | Hennessy & Patterson, "Computer Organization and Design"; SPIM/MARS conventions | **our own code** | `machines/mips/` is an original TypeScript implementation of a teaching subset of MIPS (R-type, I-type, J-type, syscall) in the spirit of SPIM and MARS. Used in the Nintendo 64 level because the N64's R4300i is part of the same MIPS family. |
| **ARM** ISA syntax | ARM Architecture Reference Manual (AArch64) — public ISA spec | **our own code** | `machines/arm/` is an original TypeScript implementation with ARM64 syntax (MOV/ADD/CMP/B.NE/LDR/STR/BL/RET/SVC). The wire format is a private 32-bit teaching bytecode (not real ARM machine code), chosen for simplicity; the assembly *syntax* matches what students would see in a real AArch64 disassembly. Used in the iPhone level. |
| **ENIAC** plugboard mini-game | inspired by ENIAC's patch-cable programming (historical) | **our own code** | `engine/puzzle.ts` + `ui/PlugboardPuzzle.tsx` are an original dataflow puzzle, not an emulator. Historical facts (1945, ~30 tons, 18,000 tubes, the six women programmers) are public record. |
| **Commodore 64**, **Nintendo 64**, **iPhone** historical detail | public record | level framing only | Brand and historical facts used in lesson text (sales figures, launch dates, chip part numbers, prices) are widely documented public information. No proprietary content or trademarks are reproduced. |
| **ENIAC** plugboard mini-game | inspired by ENIAC's patch-cable programming (historical) | **our own code** | `engine/puzzle.ts` + `ui/PlugboardPuzzle.tsx` are an original dataflow puzzle, not an emulator. Historical facts (1945, ~30 tons, 18,000 tubes, the six women programmers) are public record. |
| **TACC finale** | factual comparison (TACC / UT Austin public info) | **our own content** | `ui/TaccFinale.tsx` is original; the ENIAC-vs-TACC figures are rounded public facts for illustration. |

### Required CC BY 4.0 notice (easy6502)

> Portions of this project's 6502 emulation (the memory-mapped pixel display
> layout, the 16-colour palette, and ISA behaviour) are derived from
> **"Easy 6502" by Nick Morgan** (skilldrick/easy6502), licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). No endorsement
> implied. Changes were made (reimplemented in TypeScript, wrapped behind a
> generic `Machine` interface).

## License watch-outs honored (PRD §3, §9)

- **`fake6502`** — GPL-2.0 **and** author-deprecated → **NOT used**.
- **SoCDP-8** — AGPL-3.0 (network copyleft) → **avoided** for any shipped PDP-8.
- For future cores, **verify each repo's LICENSE before importing code**:
  - Intel 8080 / Altair 8800: wixette/8800-simulator (Apache-2.0) + maly/8080js (MIT).
  - PDP-8: MircoT/js-pdp8 or tenbaht/sdp-8 (verify before use).
  - Manchester Baby / SSEM, LC-3: reimplemented from spec → our own code.

## 3D assets

| Asset | Source / tool | License | Notes |
|---|---|---|---|
| `assets/models/eniac.glb` | Blender (parametric) | project asset | ENIAC-style U of vacuum-tube cabinets with glowing valves, authored parametrically per PRD §4. |
| `assets/models/ssem.glb` | Blender (parametric) | project asset | 1948-style equipment cabinet with forward-facing CRT, authored parametrically per PRD §4. |
| `assets/models/pdp8.glb` | Blender (parametric) | project asset | PDP-8/I-style minicomputer console (lamp panel + toggle switches), authored parametrically per PRD §4. |
| `assets/models/altair8800.glb` | Blender (parametric) | project asset | Altair 8800-style blue case with front-panel LEDs + toggle switches, authored parametrically per PRD §4. |
| `assets/models/commodore64.glb` | Blender (parametric) | project asset | Commodore 64 breadbox: beige keyboard chassis with the rainbow stripe and an inset CRT for the pixel display, authored parametrically per PRD §4. |
| `assets/models/n64.glb` | Blender (parametric) | project asset | Nintendo 64-style console with cartridge slot, four controller ports, red power button, and an inset CRT for syscall output, authored parametrically per PRD §4. |
| `assets/models/lc3.glb` | Blender (parametric) | project asset | Modern workstation (monitor + keyboard) standing in for the abstract LC-3, authored parametrically per PRD §4. |
| `assets/models/iphone.glb` | Blender (parametric) | project asset | Modern bezel-less smartphone (glass front + titanium frame + camera plateau). The screen mesh is the front face, so the live syscall terminal renders right on the phone's display. Authored parametrically per PRD §4. |

## Libraries

Runtime/build dependencies (React, React Three Fiber, Drei, three.js,
CodeMirror 6, Zustand, Vite, Vitest) retain their own permissive licenses (MIT /
Apache-2.0) as declared in `package.json` and `node_modules`.
