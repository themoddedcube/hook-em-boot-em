/**
 * A minimal CodeMirror 6 stream language for 6502-style assembly, plus a
 * burnt-orange highlight style. Tokenizes comments, labels, numbers, the '#'/'$'
 * sigils, mnemonics, and directives — enough to make the editor feel alive
 * without a full grammar.
 */

import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { MNEMONICS } from "../machines/mos6502/opcodes";

const DIRECTIVES = new Set(["DEFINE", "DCB"]);

const asmMode = StreamLanguage.define<{ expectLabel: boolean }>({
  startState: () => ({ expectLabel: true }),
  token(stream) {
    if (stream.eatSpace()) return null;

    // Comment to end of line.
    if (stream.peek() === ";") {
      stream.skipToEnd();
      return "comment";
    }

    // Hex / binary / decimal numbers and the immediate sigil.
    if (stream.match(/^#?\$[0-9a-fA-F]+/) || stream.match(/^#?%[01]+/) || stream.match(/^#?\d+/)) {
      return "number";
    }
    if (stream.eat("#")) return "operator";

    // Origin directive.
    if (stream.match(/^\*\s*=/)) return "keyword";

    // Identifier-ish run.
    const word = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (word) {
      const text = (word as RegExpMatchArray)[0];
      const upper = text.toUpperCase();
      // Label definition: identifier immediately followed by a colon.
      if (stream.peek() === ":") {
        return "labelName";
      }
      if (MNEMONICS.has(upper)) return "keyword";
      if (DIRECTIVES.has(upper)) return "keyword";
      return "variableName";
    }

    stream.next();
    return null;
  },
});

const BURNT_ORANGE = "#bf5700";

const highlight = HighlightStyle.define([
  { tag: t.comment, color: "#6b6257", fontStyle: "italic" },
  { tag: t.keyword, color: BURNT_ORANGE, fontWeight: "600" },
  { tag: t.number, color: "#d7a86e" },
  { tag: t.operator, color: "#c98a3b" },
  { tag: t.labelName, color: "#f2c98a", fontWeight: "600" },
  { tag: t.variableName, color: "#cdd6e0" },
]);

export const asm6502 = () => [asmMode, syntaxHighlighting(highlight)];
