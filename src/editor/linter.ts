/**
 * Linter CodeMirror : branche les erreurs détectées par le parser ilaria-algo
 * sous le code, avec soulignement et message au survol.
 */

import { linter, Diagnostic } from "@codemirror/lint";
import { analyze } from "../core/analyze";

export const algoLinter = linter((view) => {
  const source = view.state.doc.toString();
  const errors = analyze(source);
  const max = view.state.doc.length;

  const diagnostics: Diagnostic[] = errors.map((e) => {
    // On borne les positions pour rester dans le document.
    const from = Math.min(Math.max(0, e.from), max);
    const to = Math.min(Math.max(from, e.to), max);
    return {
      from,
      to: to > from ? to : Math.min(from + 1, max),
      severity: e.severity,
      message: e.message,
      source: "ilaria-algo",
    };
  });

  return diagnostics;
});
