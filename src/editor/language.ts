/**
 * Définition du langage ilaria-algo pour CodeMirror 6 (coloration syntaxique).
 *
 * On utilise un StreamParser : il lit le code caractère par caractère et
 * attribue à chaque morceau une étiquette de coloration (« tag ») standard,
 * que le thème (theme.ts) traduit ensuite en couleurs ilaria.
 */

import { StreamLanguage, LanguageSupport, StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  BOOLEANS,
  KEYWORDS,
  LOGIC,
  normalize,
  TYPES,
} from "../core/tokens";

interface State {
  inBlockComment: boolean;
  // Suivi de l'en-tête « Pour … a … Faire » pour distinguer le « a » séparateur
  // d'une variable nommée « a ». Le séparateur est le « a » qui suit la borne de
  // départ : après la flèche « <- », une fois une borne lue, et une seule fois.
  inPourHeader: boolean; // entre « Pour » et « Faire »
  pourSeenArrow: boolean; // flèche « <- » franchie
  pourStartDone: boolean; // au moins un opérande de la borne de départ lu
  pourSepDone: boolean; // le séparateur « a » / « à » a déjà été vu
}

/** En-tête de Pour, après la flèche et avant le séparateur : on note qu'un
 *  opérande de la borne de départ vient d'être lu. */
function markPourOperand(state: State): void {
  if (state.inPourHeader && state.pourSeenArrow && !state.pourSepDone) {
    state.pourStartDone = true;
  }
}

/** Mots-clés à deux mots, testés en priorité (insensibles aux accents/casse). */
const TWO_WORD = [
  { re: /^tant\s+que\b/i, norm: "tant que" },
  { re: /^sinon\s+si\b/i, norm: "sinon si" },
];

/** Spécification du tokeniseur (exportée pour permettre des tests unitaires). */
export const algoStreamSpec = {
  name: "ilaria-algo",

  startState: () => ({
    inBlockComment: false,
    inPourHeader: false,
    pourSeenArrow: false,
    pourStartDone: false,
    pourSepDone: false,
  }),

  token(stream: StringStream, state: State): string | null {
    // --- Suite d'un commentaire de bloc ---
    if (state.inBlockComment) {
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // --- Espaces ---
    if (stream.eatSpace()) return null;

    // --- Commentaire ligne ---
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // --- Commentaire bloc ---
    if (stream.match("/*")) {
      if (!stream.match(/.*?\*\//)) {
        state.inBlockComment = true;
        stream.skipToEnd();
      }
      return "comment";
    }

    // --- Chaîne ---
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) {
      return "string";
    }

    // --- Flèche d'affectation ---
    if (stream.match("<-") || stream.match("←")) {
      if (state.inPourHeader) state.pourSeenArrow = true;
      return "operator";
    }

    // --- Nombre ---
    if (stream.match(/\d+(\.\d+)?/)) {
      markPourOperand(state);
      return "number";
    }

    // --- Mots-clés à deux mots ---
    for (const { re } of TWO_WORD) {
      if (stream.match(re)) return "keyword";
    }

    // --- Jusqua / Jusqu'à (apostrophe droite ou typographique, facultative) ---
    if (stream.match(/jusqu['’‘ʼ]?[aà]\b/i)) {
      return "keyword";
    }

    // --- Identifiants / mots-clés / types ---
    const word = stream.match(/[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/);
    if (Array.isArray(word)) {
      const raw = word[0];
      const norm = normalize(raw);
      // Séparateur de bornes du Pour : « à » toujours ; « a » seulement après la
      // flèche, une fois la borne de départ lue, et une seule fois — sinon « a »
      // reste un nom de variable (variable de boucle, borne, ou ailleurs).
      const isSeparator =
        raw === "à" ||
        raw === "À" ||
        (norm === "a" &&
          state.inPourHeader &&
          state.pourSeenArrow &&
          state.pourStartDone &&
          !state.pourSepDone);
      if (isSeparator) {
        if (state.inPourHeader) state.pourSepDone = true;
        return "keyword";
      }
      if (KEYWORDS[norm]) {
        if (norm === "pour") {
          state.inPourHeader = true;
          state.pourSeenArrow = false;
          state.pourStartDone = false;
          state.pourSepDone = false;
        } else if (norm === "faire") {
          state.inPourHeader = false;
        }
        return "keyword";
      }
      if (TYPES[norm]) return "typeName";
      if (BOOLEANS.has(norm)) return "bool";
      if (LOGIC.has(norm)) return "operatorKeyword";
      // Identifiant ordinaire : compte comme opérande de la borne de départ.
      markPourOperand(state);
      return "variableName";
    }

    // --- Opérateurs symboliques ---
    if (stream.match(/<=|>=|!=|\/\/|[+\-*/%<>=:,]/)) {
      return "operator";
    }

    // --- Parenthèses / crochets ---
    if (stream.match(/[()]/)) return "paren";
    if (stream.match(/[\[\]]/)) return "bracket";

    // --- Le reste : on avance d'un cran ---
    stream.next();
    return null;
  },

  tokenTable: {
    keyword: t.keyword,
    typeName: t.typeName,
    bool: t.bool,
    operatorKeyword: t.operatorKeyword,
    variableName: t.variableName,
    number: t.number,
    string: t.string,
    operator: t.operator,
    comment: t.comment,
    paren: t.paren,
    bracket: t.squareBracket,
  },
};

const algoParser = StreamLanguage.define<State>(algoStreamSpec);

/** Palette ilaria appliquée aux tags de coloration. */
export const algoHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#FF5A5F", fontWeight: "bold" },
  { tag: t.typeName, color: "#2D9CDB", fontWeight: "bold" },
  { tag: t.bool, color: "#9B51E0" },
  { tag: t.operatorKeyword, color: "#FF5A5F" },
  { tag: t.variableName, color: "#E6E6E6" },
  { tag: t.number, color: "#2D9CDB" },
  { tag: t.string, color: "#27AE60" },
  { tag: t.operator, color: "#FF8A8D" },
  { tag: t.comment, color: "#7A879B", fontStyle: "italic" },
  { tag: t.paren, color: "#C9D1D9" },
  { tag: t.squareBracket, color: "#F2C94C" },
]);

export function ilariaAlgo(): LanguageSupport {
  return new LanguageSupport(algoParser, [syntaxHighlighting(algoHighlightStyle)]);
}
