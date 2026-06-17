/**
 * Auto-complétion du pseudo-code ilaria-algo :
 *   - squelettes de structures (Si, Pour, Tant que, Selon, Procedure, …) ;
 *   - mots-clés, types, littéraux et opérateurs logiques ;
 *   - noms de variables et de sous-programmes déjà présents dans le code.
 */

import {
  Completion,
  CompletionContext,
  CompletionResult,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { KEYWORDS, TYPES } from "../core/tokens";
import { lex } from "../core/lexer";

// ---------- Squelettes (snippets) ----------
const SNIPPETS: Completion[] = [
  snippetCompletion(
    "Algorithme ${Nom}\n    Variables\n        ${declarations}\n    Debut\n        ${corps}\n    Fin",
    { label: "Algorithme … (squelette complet)", type: "keyword", boost: 99 }
  ),
  snippetCompletion("Si ${condition} Alors\n    ${corps}\nFinSi", {
    label: "Si … Alors … FinSi",
    type: "keyword",
    boost: 90,
  }),
  snippetCompletion(
    "Si ${condition} Alors\n    ${corps}\nSinon\n    ${sinon}\nFinSi",
    { label: "Si … Sinon … FinSi", type: "keyword", boost: 89 }
  ),
  snippetCompletion(
    "Pour ${i} <- ${debut} a ${fin} Faire\n    ${corps}\nFinPour",
    { label: "Pour … FinPour", type: "keyword", boost: 88 }
  ),
  snippetCompletion("Tant que ${condition} Faire\n    ${corps}\nFinTantQue", {
    label: "Tant que … FinTantQue",
    type: "keyword",
    boost: 87,
  }),
  snippetCompletion("Repeter\n    ${corps}\nJusqua ${condition}", {
    label: "Repeter … Jusqua",
    type: "keyword",
    boost: 86,
  }),
  snippetCompletion(
    "Selon ${variable} Faire\n    Cas ${valeur} :\n        ${corps}\n    Autre :\n        ${defaut}\nFinSelon",
    { label: "Selon … FinSelon", type: "keyword", boost: 85 }
  ),
  snippetCompletion("Procedure ${Nom}(${parametres})\n    ${corps}\nFinProcedure", {
    label: "Procedure … FinProcedure",
    type: "keyword",
    boost: 84,
  }),
  snippetCompletion(
    "Fonction ${Nom}(${parametres}) : ${Type}\n    ${corps}\n    Retourner ${valeur}\nFinFonction",
    { label: "Fonction … FinFonction", type: "keyword", boost: 83 }
  ),
  snippetCompletion('Afficher "${texte}"', { label: "Afficher …", type: "keyword", boost: 70 }),
  snippetCompletion("Lire ${variable}", { label: "Lire …", type: "keyword", boost: 70 }),
];

// ---------- Mots-clés simples, types, littéraux ----------
const STATIC_WORDS: Completion[] = [
  ...Object.values(KEYWORDS).map(
    (label): Completion => ({ label, type: "keyword" })
  ),
  ...Object.values(TYPES).map((label): Completion => ({ label, type: "type" })),
  { label: "vrai", type: "constant" },
  { label: "faux", type: "constant" },
  { label: "ET", type: "keyword" },
  { label: "OU", type: "keyword" },
  { label: "NON", type: "keyword" },
];

/** Récupère les noms de variables et de sous-programmes présents dans le code. */
function collectNames(source: string): { vars: string[]; funcs: string[] } {
  const { tokens } = lex(source);
  const vars = new Set<string>();
  const funcs = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "identifier") vars.add(t.value);
    if (
      t.type === "keyword" &&
      (t.normalized === "procedure" || t.normalized === "fonction")
    ) {
      const n = tokens[i + 1];
      if (n && n.type === "identifier") funcs.add(n.value);
    }
  }
  return { vars: [...vars], funcs: [...funcs] };
}

export function algoCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(
    /[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/
  );
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const options: Completion[] = [...SNIPPETS, ...STATIC_WORDS];

  const { vars, funcs } = collectNames(context.state.doc.toString());
  for (const f of funcs) {
    options.push({ label: f, type: "function", detail: "sous-programme", apply: f + "(" });
  }
  for (const v of vars) {
    if (!funcs.includes(v)) options.push({ label: v, type: "variable" });
  }

  return {
    from: word.from,
    options,
    validFor: /^[A-Za-zÀ-ÖØ-öø-ÿ0-9_]*$/,
  };
}
