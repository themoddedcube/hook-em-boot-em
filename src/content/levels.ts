/**
 * The level registry (PRD §7.1) — the one place that lists playable eras, in
 * chronological order (keep this list sorted by `year`). The shell renders
 * whatever is here; adding a machine is a single new entry. Everything else
 * (engine, UI, progression, era timeline, "travel to next era") is generic.
 */

import { Level } from "../engine/level";
import { createSsem } from "../machines/ssem";
import { createPdp8 } from "../machines/pdp8";
import { createAltair8800 } from "../machines/altair8800";
import { createMos6502 } from "../machines/mos6502";
import { createMips } from "../machines/mips";
import { createLc3 } from "../machines/lc3";
import { createArm } from "../machines/arm";

export const LEVELS: Level[] = [
  {
    id: "eniac",
    title: "ENIAC",
    year: 1945,
    kind: "puzzle",
    puzzleDir: "eniac",
    modelPath: "/assets/models/eniac.glb",
    blurb:
      "The first general-purpose electronic computer, and it filled a whole " +
      "room. There was no software to type. You programmed it by plugging in " +
      "patch cables, so wiring it up is exactly what you'll do.",
    specs: {
      size: "about 17 m by 2.4 m, in a big U shape",
      sizeCompare: "it took up a whole room",
      weight: "around 30 tons",
      memory: "twenty 10-digit accumulators (about 200 digits)",
      speed: "roughly 5,000 additions a second",
      price: "about $400,000 in 1945 (close to $7 million today)",
      note: "18,000 vacuum tubes, and it was often programmed by six women mathematicians.",
    },
  },
  {
    id: "ssem",
    title: "Manchester Baby",
    year: 1948,
    machineFactory: createSsem,
    challengeDir: "ssem",
    modelPath: "/assets/models/ssem.glb",
    blurb:
      "The first computer to ever run a program from its own memory. It has " +
      "seven instructions, 32 words of storage, and no way to add (you " +
      "subtract and flip signs instead). Its screen is the memory itself, " +
      "shown as glowing dots.",
    specs: {
      size: "a row of equipment racks about 5 m long",
      sizeCompare: "it filled a lab wall",
      weight: "around 1 tonne",
      memory: "32 words of 32 bits (128 bytes)",
      speed: "about 700 instructions a second",
      price: "a one-off research prototype, never sold",
      note: "Its very first program ran about 3.5 million operations in 52 minutes.",
    },
  },
  {
    id: "pdp8",
    title: "DEC PDP-8",
    year: 1965,
    machineFactory: createPdp8,
    challengeDir: "pdp8",
    modelPath: "/assets/models/pdp8.glb",
    blurb:
      "The first minicomputer ordinary labs could actually afford. It finally " +
      "had real addition, loops, subroutines, and a clattering Teletype for " +
      "getting data in and out. This is where computers escaped the big " +
      "air-conditioned room.",
    specs: {
      size: "about 0.7 m by 0.6 m by 0.8 m",
      sizeCompare: "roughly the size of a fridge",
      weight: "around 110 kg (250 lb)",
      memory: "4096 words of 12 bits (about 6 KB)",
      speed: "about 330,000 additions a second",
      price: "$18,500 in 1965 (close to $180,000 today)",
      note: "Around 50,000 were sold, and it made 'minicomputer' a household word.",
    },
  },
  {
    id: "altair8800",
    title: "Altair 8800",
    year: 1974,
    machineFactory: createAltair8800,
    challengeDir: "altair8800",
    modelPath: "/assets/models/altair8800.glb",
    blurb:
      "The mail-order kit that kicked off the personal computer. It runs on " +
      "Intel's 8080, with seven registers, a proper stack, and a front panel " +
      "of switches and blinking lights. It's also where Microsoft got started.",
    specs: {
      size: "about 43 cm by 46 cm by 18 cm",
      sizeCompare: "it sits on a desk",
      weight: "around 11 kg (25 lb)",
      memory: "256 bytes in the base kit, expandable to 64 KB",
      speed: "a 2 MHz 8080, about 300,000 instructions a second",
      price: "$439 as a kit in 1975 (close to $2,600 today)",
      note: "Gates and Allen's Altair BASIC was Microsoft's very first product.",
    },
  },
  {
    id: "commodore64",
    title: "Commodore 64",
    year: 1982,
    machineFactory: createMos6502,
    challengeDir: "commodore64",
    modelPath: "/assets/models/commodore64.glb",
    blurb:
      "The best-selling computer of all time, the beige breadbox that put a " +
      "real machine in millions of bedrooms. Inside is the MOS 6510, a 6502 " +
      "with an extra I/O port. You program the chip everyone's favourite home " +
      "computer ran on.",
    specs: {
      size: "about 40 cm by 22 cm by 7 cm",
      sizeCompare: "a chunky beige keyboard you set on your desk",
      weight: "around 1.8 kg (4 lb)",
      memory: "64 KB of RAM (hence the '64')",
      speed: "a 1.023 MHz MOS 6510 (about 500,000 instructions a second)",
      price: "$595 at launch in 1982 (about $1,900 today)",
      note: "Around 17 million sold, more than any other single computer model in history.",
    },
  },
  {
    id: "n64",
    title: "Nintendo 64",
    year: 1996,
    machineFactory: createMips,
    challengeDir: "n64",
    modelPath: "/assets/models/n64.glb",
    blurb:
      "The console that brought Mario, Zelda, and Goldeneye into millions of " +
      "living rooms. Inside is a MIPS R4300i, the same family of RISC chip " +
      "that ran Unix workstations and the original PlayStation. You program " +
      "the architecture that defined modern computing.",
    specs: {
      size: "about 26 cm by 19 cm by 7 cm",
      sizeCompare: "fits in two hands",
      weight: "around 1.1 kg (2.4 lb)",
      memory: "4 MB of RDRAM (expandable to 8 MB)",
      speed: "a 93.75 MHz MIPS R4300i (a 64-bit RISC chip)",
      price: "$199 at launch in 1996 (about $400 today)",
      note: "Over 32 million sold. The R4300i was the most famous mass-market MIPS chip ever shipped.",
    },
  },
  {
    id: "lc3",
    title: "LC-3",
    year: 2000,
    machineFactory: createLc3,
    challengeDir: "lc3",
    modelPath: "/assets/models/lc3.glb",
    blurb:
      "The teaching computer from UT Austin's EE 306 (Patt and Patel). Eight " +
      "registers, condition codes, a clean modern design, built for one job: " +
      "helping you see how all the other machines really work.",
    specs: {
      size: "none at all, it's imaginary",
      sizeCompare: "an idea that runs on any computer",
      weight: "zero, it's a specification, not a machine",
      memory: "65,536 words of 16 bits (128 KB)",
      speed: "as fast as whatever runs the simulator",
      price: "free, it lives in a textbook",
      note: "Designed by Yale Patt and Sanjay Patel, the ISA you study in UT Austin's EE 306.",
    },
  },
  {
    id: "iphone",
    title: "iPhone",
    year: 2007,
    machineFactory: createArm,
    challengeDir: "iphone",
    modelPath: "/assets/models/iphone.glb",
    blurb:
      "The slab of glass that changed how people think about computers. Inside " +
      "is an ARM chip, the same family that runs every iPhone since, every " +
      "Android, every Apple Silicon Mac, and an increasing share of the racks " +
      "at TACC. The most-shipped CPU architecture in history.",
    specs: {
      size: "about 14.6 cm by 7.1 cm by 0.8 cm (modern iPhone)",
      sizeCompare: "it fits in your pocket",
      weight: "around 170 g (6 oz)",
      memory: "8 GB of RAM in a current iPhone",
      speed: "modern A-series Apple chips run at several GHz on multiple cores",
      price: "$799+ in 2026 (the 2007 original was $499)",
      note: "Roughly 250 billion ARM chips have shipped, more than any other architecture in history.",
    },
  },
  {
    id: "tacc",
    title: "TACC",
    year: 2024,
    kind: "finale",
    blurb:
      "The finish line. UT's own supercomputers, some of the fastest on Earth, " +
      "are humming away a short walk across campus. From a 30-ton room to your " +
      "own backyard.",
  },
];

export const getLevel = (id: string): Level | undefined =>
  LEVELS.find((l) => l.id === id);
