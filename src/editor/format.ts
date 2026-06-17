/**
 * Formatage automatique de l'indentation d'un algorithme ilaria-algo.
 * Recalcule l'indentation de chaque ligne d'après la structure des blocs,
 * en respectant l'imbrication Algorithme → Variables → Debut → Fin et les
 * structures de contrôle (Si, Pour, Tant que, Repeter, Selon, sous-programmes).
 */

import { lex } from "../core/lexer";

const INDENT = "    "; // 4 espaces

/** Mots-clés ouvrants → marqueur empilé. */
const OPEN: Record<string, string> = {
  algorithme: "algorithme",
  variables: "variables",
  si: "si",
  pour: "pour",
  "tant que": "tantque",
  repeter: "repeter",
  selon: "selon",
  procedure: "procedure",
  fonction: "fonction",
};

/** Mots-clés fermants → marqueur qu'ils referment. */
const CLOSE: Record<string, string> = {
  finsi: "si",
  finpour: "pour",
  fintantque: "tantque",
  finselon: "selon",
  finprocedure: "procedure",
  finfonction: "fonction",
  jusqua: "repeter",
  fin: "debut",
};

/** Renvoie le mot-clé structurant en tête de ligne (forme normalisée), ou null. */
function leadingKeyword(text: string): string | null {
  const { tokens } = lex(text);
  const first = tokens.find((t) => t.type !== "newline" && t.type !== "eof");
  if (!first) return null;
  if (first.type === "keyword") return first.normalized;
  return null;
}

export function formatSource(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  const stack: string[] = [];
  const top = (): string | undefined => stack[stack.length - 1];
  const pad = (n: number): string => INDENT.repeat(Math.max(0, n));

  for (const raw of lines) {
    const text = raw.trim();
    if (text === "") {
      out.push("");
      continue;
    }

    const kw = leadingKeyword(text) ?? "";

    // --- Fermetures (FinSi, FinPour, …, Jusqua, Fin) ---
    const closeTarget = CLOSE[kw];
    if (closeTarget) {
      while (stack.length && top() !== closeTarget) stack.pop();
      if (top() === closeTarget) stack.pop();
      out.push(pad(stack.length) + text);
      // « Fin » referme aussi l'algorithme s'il l'enveloppe.
      if (kw === "fin" && top() === "algorithme") stack.pop();
      continue;
    }

    // --- Intermédiaires Sinon / Sinon Si (dédentés, bloc conservé) ---
    if (kw === "sinon" || kw === "sinon si") {
      out.push(pad(stack.length - 1) + text);
      continue;
    }

    // --- Debut : ferme la section Variables puis ouvre le corps ---
    if (kw === "debut") {
      if (top() === "variables") stack.pop();
      out.push(pad(stack.length) + text);
      stack.push("debut");
      continue;
    }

    // --- Cas / Autre : ferme le cas précédent puis s'ouvre ---
    if (kw === "cas" || kw === "autre") {
      if (top() === "casbloc") stack.pop();
      out.push(pad(stack.length) + text);
      stack.push("casbloc");
      continue;
    }

    // --- Ouvertures (Algorithme, Variables, Si, Pour, …) ---
    const opener = OPEN[kw];
    if (opener) {
      out.push(pad(stack.length) + text);
      stack.push(opener);
      continue;
    }

    // --- Ligne ordinaire ---
    out.push(pad(stack.length) + text);
  }

  return out.join("\n");
}
