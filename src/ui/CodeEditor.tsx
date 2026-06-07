/**
 * The assembly code editor (CodeMirror 6 + the 6502 stream language).
 * Burnt-orange themed per PRD §6.3.
 */

import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { asm6502 } from "./asmLanguage";

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#16130f",
      color: "#cdd6e0",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      fontFamily:
        "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
      caretColor: "#bf5700",
    },
    ".cm-gutters": {
      backgroundColor: "#100d0a",
      color: "#534b40",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "rgba(191,87,0,0.07)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(191,87,0,0.12)" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#bf5700" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(191,87,0,0.25)",
    },
  },
  { dark: true }
);

export function CodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      extensions={[asm6502(), editorTheme, EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        foldGutter: false,
        autocompletion: false,
      }}
      style={{ height: "100%" }}
    />
  );
}
