/**
 * Représentation d'une erreur (ou avertissement) détectée dans le code.
 * Les positions sont absolues (compatibles CodeMirror) ET en ligne/colonne
 * (pour des messages lisibles côté humain).
 */

export type Severity = "error" | "warning";

export interface AlgoError {
  severity: Severity;
  message: string;
  from: number; // position absolue de début
  to: number; // position absolue de fin
  line: number; // 1-indexé
  col: number; // 1-indexé
}

/** Fabrique une erreur en français, prête à être affichée. */
export function makeError(
  message: string,
  from: number,
  to: number,
  line: number,
  col: number,
  severity: Severity = "error"
): AlgoError {
  return { severity, message, from, to, line, col };
}
