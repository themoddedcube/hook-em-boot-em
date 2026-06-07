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
import { createLc3 } from "../machines/lc3";

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
    id: "mos6502",
    title: "MOS 6502",
    year: 1976,
    machineFactory: createMos6502,
    challengeDir: "6502",
    modelPath: "/assets/models/6502.glb",
    blurb:
      "The cheap little chip that put computers in people's homes. It ran the " +
      "Apple I, the Commodore 64, and the NES. You get registers, addressing " +
      "modes, and a 32 by 32 screen to draw on.",
    specs: {
      size: "a 5.6 mm silicon chip in a 40-pin package (about 5 cm)",
      sizeCompare: "smaller than a fingernail",
      weight: "a few grams",
      memory: "can address 64 KB",
      speed: "1 to 2 MHz, over 500,000 instructions a second",
      price: "$25 in 1975 (about $140 today)",
      note: "Rival chips cost around $200, so its low price is what made home computers possible.",
    },
  },
  {
    id: "lc3",
    title: "LC-3",
    year: 2003,
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
