/**
 * Analyseur syntaxique (parser) du pseudo-code ilaria-algo.
 *
 * Objectif de la Phase 1 : détecter et expliquer clairement les erreurs de
 * structure, sans générer d'arbre exécutable (ce sera la Phase 2). Il vérifie :
 *   - l'équilibre des blocs (Si/FinSi, Pour/FinPour, Tant que/FinTantQue…) ;
 *   - les mots-clés obligatoires (Alors après Si, Faire après Pour…) ;
 *   - les fermetures qui ne correspondent pas au bloc ouvert ;
 *   - l'usage de « = » au lieu de « <- » dans une affectation ;
 *   - l'équilibre des parenthèses et des crochets ;
 *   - les blocs Cas/Sinon/Autre placés hors de leur structure.
 */

import { Token } from "./tokens";
import { AlgoError, makeError } from "./errors";
import { lex } from "./lexer";

type BlockKind =
  | "debut"
  | "si"
  | "selon"
  | "pour"
  | "tantque"
  | "repeter"
  | "procedure"
  | "fonction";

interface OpenBlock {
  kind: BlockKind;
  token: Token; // le mot-clé ouvrant (pour pointer l'erreur dessus)
}

/** Mots-clés ouvrants → genre de bloc et message si non fermé. */
const OPENERS: Record<string, { kind: BlockKind; closer: string }> = {
  debut: { kind: "debut", closer: "Fin" },
  si: { kind: "si", closer: "FinSi" },
  selon: { kind: "selon", closer: "FinSelon" },
  pour: { kind: "pour", closer: "FinPour" },
  "tant que": { kind: "tantque", closer: "FinTantQue" },
  repeter: { kind: "repeter", closer: "Jusqua" },
  procedure: { kind: "procedure", closer: "FinProcedure" },
  fonction: { kind: "fonction", closer: "FinFonction" },
};

/** Mots-clés fermants → genre de bloc qu'ils ferment. */
const CLOSERS: Record<string, BlockKind> = {
  fin: "debut",
  finsi: "si",
  finselon: "selon",
  finpour: "pour",
  fintantque: "tantque",
  jusqua: "repeter",
  finprocedure: "procedure",
  finfonction: "fonction",
};

const CLOSER_LABEL: Record<BlockKind, string> = {
  debut: "Fin",
  si: "FinSi",
  selon: "FinSelon",
  pour: "FinPour",
  tantque: "FinTantQue",
  repeter: "Jusqua",
  procedure: "FinProcedure",
  fonction: "FinFonction",
};

export interface ParseResult {
  tokens: Token[];
  errors: AlgoError[];
}

/** Tokens significatifs uniquement (sans commentaires ni sauts de ligne). */
function meaningful(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== "comment" && t.type !== "newline");
}

export function parse(source: string): ParseResult {
  const { tokens, errors: lexErrors } = lex(source);
  const errors: AlgoError[] = [...lexErrors];

  const code = meaningful(tokens);
  const stack: OpenBlock[] = [];

  // Pour la détection d'affectation : on repère le début d'instruction.
  // Une instruction commence en début de fichier ou après un saut de ligne
  // significatif. On travaille donc sur la liste complète avec les newlines.
  checkProgramStructure(code, errors);
  checkBlocks(code, stack, errors);
  checkBalanced(tokens, errors);
  checkAssignments(tokens, errors);
  checkRequiredKeywords(code, errors);

  return { tokens, errors };
}

/**
 * Vérifie la structure complète d'un algorithme.
 * Dès qu'un mot-clé « Algorithme » est présent, on impose le squelette
 * enseigné :  Algorithme <nom> · Variables · Debut · … · Fin.
 * Les fichiers ne contenant que des procédures / fonctions (sans « Algorithme »)
 * ne sont pas concernés par ces règles.
 */
function checkProgramStructure(code: Token[], errors: AlgoError[]): void {
  const algoIdx = code.findIndex(
    (t) => t.type === "keyword" && t.normalized === "algorithme"
  );
  if (algoIdx === -1) return; // pas un algorithme principal

  const algoTok = code[algoIdx];
  const has = (norm: string): boolean =>
    code.some((t) => t.type === "keyword" && t.normalized === norm);

  // « Algorithme » doit être suivi d'un nom.
  const nameTok = code[algoIdx + 1];
  if (!nameTok || nameTok.type !== "identifier") {
    errors.push(
      makeError(
        "« Algorithme » doit être suivi d'un nom, ex. « Algorithme nombrePair ».",
        algoTok.from,
        algoTok.to,
        algoTok.line,
        algoTok.col
      )
    );
  }

  // Section « Variables » obligatoire.
  if (!has("variables")) {
    errors.push(
      makeError(
        "Section « Variables » manquante : déclarez-la après le nom de l'algorithme (même vide).",
        algoTok.from,
        algoTok.to,
        algoTok.line,
        algoTok.col
      )
    );
  }

  // Bloc « Debut … Fin » obligatoire.
  // (Si « Debut » est présent mais « Fin » absent, l'absence est déjà signalée
  //  par le suivi des blocs ; on évite ainsi les messages en double.)
  if (!has("debut")) {
    errors.push(
      makeError(
        "Bloc « Debut » manquant : le corps de l'algorithme doit être encadré par « Debut » et « Fin ».",
        algoTok.from,
        algoTok.to,
        algoTok.line,
        algoTok.col
      )
    );
  }

  // ----- Ordre canonique : Algorithme → Variables → Debut → Fin -----
  const firstOf = (norm: string): number =>
    code.findIndex((t) => t.type === "keyword" && t.normalized === norm);

  const idxAlgo = algoIdx;
  const idxVars = firstOf("variables");
  const idxDebut = firstOf("debut");

  // « Algorithme » doit être la toute première instruction (les commentaires,
  // déjà retirés, ne comptent pas).
  if (idxAlgo > 0) {
    errors.push(
      makeError(
        "« Algorithme » doit être la toute première instruction du programme.",
        algoTok.from,
        algoTok.to,
        algoTok.line,
        algoTok.col
      )
    );
  }

  // « Variables » doit venir après « Algorithme ».
  if (idxVars !== -1 && idxVars < idxAlgo) {
    const v = code[idxVars];
    errors.push(
      makeError(
        "Ordre incorrect : « Variables » doit être déclaré après « Algorithme ».",
        v.from,
        v.to,
        v.line,
        v.col
      )
    );
  }

  // « Debut » doit venir après « Variables » (ou, à défaut, après « Algorithme »).
  if (idxDebut !== -1) {
    const ref = idxVars !== -1 ? idxVars : idxAlgo;
    if (idxDebut < ref) {
      const d = code[idxDebut];
      const apres = idxVars !== -1 ? "« Variables »" : "« Algorithme »";
      errors.push(
        makeError(
          `Ordre incorrect : « Debut » doit venir après ${apres}.`,
          d.from,
          d.to,
          d.line,
          d.col
        )
      );
    }
  }
}

/** Vérifie l'équilibre des blocs ouvrants / fermants. */
function checkBlocks(code: Token[], stack: OpenBlock[], errors: AlgoError[]): void {
  for (const tok of code) {
    if (tok.type !== "keyword") continue;
    const norm = tok.normalized;

    if (OPENERS[norm]) {
      stack.push({ kind: OPENERS[norm].kind, token: tok });
      continue;
    }

    if (CLOSERS[norm]) {
      const expectedKind = CLOSERS[norm];
      if (stack.length === 0) {
        errors.push(
          makeError(
            `« ${tok.value} » ne ferme aucun bloc ouvert.`,
            tok.from,
            tok.to,
            tok.line,
            tok.col
          )
        );
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.kind === expectedKind) {
        stack.pop();
      } else {
        // Mauvaise fermeture : on signale et on tente de récupérer.
        errors.push(
          makeError(
            `« ${tok.value} » inattendu : le bloc « ${labelOf(top.kind)} » ` +
              `(ligne ${top.token.line}) doit d'abord être fermé par « ${CLOSER_LABEL[top.kind]} ».`,
            tok.from,
            tok.to,
            tok.line,
            tok.col
          )
        );
        // Récupération : si ce fermant correspond à un bloc plus bas, on
        // dépile jusqu'à lui (les blocs intermédiaires seront signalés non fermés).
        const idx = findFromTop(stack, expectedKind);
        if (idx >= 0) stack.length = idx;
      }
    }
  }

  // Blocs restés ouverts.
  for (const block of stack) {
    errors.push(
      makeError(
        `Le bloc « ${labelOf(block.kind)} » (ligne ${block.token.line}) ` +
          `n'est jamais fermé : il manque « ${CLOSER_LABEL[block.kind]} ».`,
        block.token.from,
        block.token.to,
        block.token.line,
        block.token.col
      )
    );
  }
}

function labelOf(kind: BlockKind): string {
  switch (kind) {
    case "debut":
      return "Debut";
    case "si":
      return "Si";
    case "selon":
      return "Selon";
    case "pour":
      return "Pour";
    case "tantque":
      return "Tant que";
    case "repeter":
      return "Repeter";
    case "procedure":
      return "Procedure";
    case "fonction":
      return "Fonction";
  }
}

/** Renvoie l'indice (depuis le bas) du bloc le plus haut de ce genre, ou -1. */
function findFromTop(stack: OpenBlock[], kind: BlockKind): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].kind === kind) return i;
  }
  return -1;
}

/** Vérifie l'équilibre des parenthèses et des crochets sur l'ensemble du code. */
function checkBalanced(tokens: Token[], errors: AlgoError[]): void {
  const parens: Token[] = [];
  const brackets: Token[] = [];

  for (const tok of tokens) {
    if (tok.type === "paren") {
      if (tok.value === "(") parens.push(tok);
      else {
        if (parens.length === 0) {
          errors.push(
            makeError(
              "Parenthèse fermante « ) » sans parenthèse ouvrante correspondante.",
              tok.from,
              tok.to,
              tok.line,
              tok.col
            )
          );
        } else parens.pop();
      }
    } else if (tok.type === "bracket") {
      if (tok.value === "[") brackets.push(tok);
      else {
        if (brackets.length === 0) {
          errors.push(
            makeError(
              "Crochet fermant « ] » sans crochet ouvrant correspondant.",
              tok.from,
              tok.to,
              tok.line,
              tok.col
            )
          );
        } else brackets.pop();
      }
    }
  }

  for (const t of parens) {
    errors.push(
      makeError(
        "Parenthèse ouvrante « ( » jamais fermée.",
        t.from,
        t.to,
        t.line,
        t.col
      )
    );
  }
  for (const t of brackets) {
    errors.push(
      makeError(
        "Crochet ouvrant « [ » jamais fermé.",
        t.from,
        t.to,
        t.line,
        t.col
      )
    );
  }
}

/**
 * Détecte « = » utilisé comme affectation à la place de « <- ».
 * Heuristique : en début d'instruction (après un saut de ligne ou début de
 * fichier), un identifiant — éventuellement suivi d'indices [..] — puis « = »
 * est presque toujours une affectation mal écrite.
 * Les « = » dans les conditions (après Si, Tant que, Jusqua, Selon…) sont, eux,
 * des comparaisons légitimes et ne sont pas signalés.
 */
function checkAssignments(tokens: Token[], errors: AlgoError[]): void {
  let atLineStart = true;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "newline") {
      atLineStart = true;
      continue;
    }
    if (tok.type === "comment") continue;

    if (atLineStart && tok.type === "identifier") {
      // Avance après l'identifiant et ses éventuels indices de tableau.
      let j = i + 1;
      while (
        tokens[j] &&
        (tokens[j].type === "bracket" ||
          tokens[j].type === "identifier" ||
          tokens[j].type === "number" ||
          (tokens[j].type === "operator" && tokens[j].value === ","))
      ) {
        // On ne traverse les crochets que pour un accès tableau simple.
        if (tokens[j].type === "bracket" && tokens[j].value === "(") break;
        j++;
      }
      const next = tokens[j];
      if (next && next.type === "operator" && next.value === "=") {
        errors.push(
          makeError(
            "Pour affecter une valeur, utilisez « <- » (et non « = » qui sert à comparer).",
            next.from,
            next.to,
            next.line,
            next.col
          )
        );
      }
    }

    atLineStart = false;
  }
}

/**
 * Vérifie la présence des mots-clés obligatoires après certaines ouvertures :
 *   - « Alors » après la condition d'un « Si » / « Sinon Si » ;
 *   - « Faire » après « Pour … », « Tant que … » et « Selon … ».
 * On cherche le mot-clé attendu entre l'ouverture et la fin de sa ligne logique.
 */
function checkRequiredKeywords(code: Token[], errors: AlgoError[]): void {
  for (let i = 0; i < code.length; i++) {
    const tok = code[i];
    if (tok.type !== "keyword") continue;
    const norm = tok.normalized;

    if (norm === "si") {
      requireBefore(code, i, "alors", tok, "« Si … » doit se terminer par « Alors ».", errors);
    } else if (norm === "pour") {
      requireBefore(code, i, "faire", tok, "« Pour … » doit se terminer par « Faire ».", errors);
    } else if (norm === "tant que") {
      requireBefore(code, i, "faire", tok, "« Tant que … » doit se terminer par « Faire ».", errors);
    } else if (norm === "selon") {
      requireBefore(code, i, "faire", tok, "« Selon … » doit se terminer par « Faire ».", errors);
    }
  }
}

/**
 * Cherche le mot-clé `expected` après la position `from`, en s'arrêtant au
 * prochain mot-clé structurant (qui marquerait le début du corps du bloc).
 */
function requireBefore(
  code: Token[],
  from: number,
  expected: string,
  opener: Token,
  message: string,
  errors: AlgoError[]
): void {
  const STOPPERS = new Set([
    "si",
    "pour",
    "tant que",
    "selon",
    "afficher",
    "lire",
    "finsi",
    "finpour",
    "fintantque",
    "finselon",
    "sinon",
  ]);

  for (let i = from + 1; i < code.length; i++) {
    const t = code[i];
    if (t.normalized === expected && t.type === "keyword") return; // trouvé
    if (t.type === "keyword" && STOPPERS.has(t.normalized)) break;
    if (t.normalized === "cas" || t.normalized === "autre") break;
    // « à »/« Pas » font partie de l'en-tête d'un Pour : on continue.
  }

  errors.push(makeError(message, opener.from, opener.to, opener.line, opener.col));
}
