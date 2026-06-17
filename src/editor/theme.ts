/**
 * Thème visuel de l'éditeur ilaria-algo, aux couleurs d'ilaria Digital School
 * (fond bleu nuit, accents corail).
 */

import { EditorView } from "@codemirror/view";

export const algoTheme = EditorView.theme(
  {
    "&": {
      color: "#E6E6E6",
      backgroundColor: "#1B2233",
      fontSize: "15px",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      caretColor: "#FF5A5F",
      padding: "12px 0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#FF5A5F" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "#33405e" },
    ".cm-gutters": {
      backgroundColor: "#161C2B",
      color: "#5A6B85",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#242d42",
      color: "#FF8A8D",
    },
    ".cm-activeLine": { backgroundColor: "#212a3e" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
    // Soulignement des erreurs (vague rouge corail).
    ".cm-lintRange-error": {
      backgroundImage:
        "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"6\" height=\"3\"><path d=\"m0 3 l3 -3 l3 3\" fill=\"none\" stroke=\"%23FF5A5F\" stroke-width=\"0.8\"/></svg>')",
    },
    ".cm-tooltip": {
      backgroundColor: "#0F1420",
      border: "1px solid #FF5A5F",
      borderRadius: "6px",
      color: "#E6E6E6",
      padding: "2px 4px",
    },
    ".cm-tooltip.cm-tooltip-lint": { padding: "6px 10px", maxWidth: "320px" },
    ".cm-diagnostic": { padding: "2px 0" },
    ".cm-diagnostic-error": { borderLeft: "3px solid #FF5A5F" },
  },
  { dark: true }
);
