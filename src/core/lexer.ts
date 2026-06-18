/**
 * Analyseur lexical (lexer) du pseudo-code ilaria-algo.
 * Transforme le texte source en une liste de tokens.
 *
 * Il est volontairement tolérant : il ne « plante » jamais. Les anomalies
 * purement lexicales (chaîne non fermée, commentaire de bloc non fermé,
 * caractère inconnu) sont remontées dans `errors` mais la tokenisation
 * continue, pour que la coloration reste fonctionnelle.
 */

import {
  ASSIGN_TOKENS,
  BOOLEANS,
  KEYWORDS,
  LOGIC,
  normalize,
  SYMBOL_OPERATORS,
  Token,
  TokenType,
  TWO_WORD_STARTS,
  TYPES,
  WORD_OPERATORS,
} from "./tokens";
import { AlgoError, makeError } from "./errors";

export interface LexResult {
  tokens: Token[];
  errors: AlgoError[];
}

const isLetter = (ch: string): boolean =>
  /[A-Za-zÀ-ÖØ-öø-ÿ_]/.test(ch);
const isLetterOrDigit = (ch: string): boolean =>
  /[A-Za-zÀ-ÖØ-öø-ÿ0-9_]/.test(ch);
const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";

export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const errors: AlgoError[] = [];

  let pos = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0): string => source[pos + offset] ?? "";

  const advance = (): string => {
    const ch = source[pos++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  };

  const push = (
    type: TokenType,
    value: string,
    normalized: string,
    startPos: number,
    startLine: number,
    startCol: number
  ): void => {
    tokens.push({
      type,
      value,
      normalized,
      line: startLine,
      col: startCol,
      from: startPos,
      to: pos,
    });
  };

  while (pos < source.length) {
    const ch = peek();
    const startPos = pos;
    const startLine = line;
    const startCol = col;

    // --- Sauts de ligne ---
    if (ch === "\n") {
      advance();
      push("newline", "\n", "\n", startPos, startLine, startCol);
      continue;
    }

    // --- Espaces / tabulations ---
    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    // --- Commentaire ligne  // … ---
    if (ch === "/" && peek(1) === "/") {
      let text = "";
      while (pos < source.length && peek() !== "\n") text += advance();
      push("comment", text, text, startPos, startLine, startCol);
      continue;
    }

    // --- Commentaire bloc  /* … */ ---
    if (ch === "/" && peek(1) === "*") {
      let text = "" + advance() + advance(); // consomme /*
      let closed = false;
      while (pos < source.length) {
        if (peek() === "*" && peek(1) === "/") {
          text += advance() + advance();
          closed = true;
          break;
        }
        text += advance();
      }
      push("comment", text, text, startPos, startLine, startCol);
      if (!closed) {
        errors.push(
          makeError(
            "Commentaire de bloc non fermé : il manque « */ ».",
            startPos,
            pos,
            startLine,
            startCol
          )
        );
      }
      continue;
    }

    // --- Chaîne de caractères  "…" ---
    if (ch === '"') {
      let text = advance(); // consomme le guillemet ouvrant
      let closed = false;
      while (pos < source.length) {
        const c = peek();
        if (c === "\n") break; // une chaîne ne s'étend pas sur plusieurs lignes
        text += advance();
        if (c === '"') {
          closed = true;
          break;
        }
      }
      push("string", text, text, startPos, startLine, startCol);
      if (!closed) {
        errors.push(
          makeError(
            'Chaîne non fermée : il manque le guillemet « " » de fin.',
            startPos,
            pos,
            startLine,
            startCol
          )
        );
      }
      continue;
    }

    // --- Flèche d'affectation  ← ou <- ---
    let matchedAssign = ASSIGN_TOKENS.find((a) => source.startsWith(a, pos));
    if (matchedAssign) {
      for (let i = 0; i < matchedAssign.length; i++) advance();
      push("assign", matchedAssign, "<-", startPos, startLine, startCol);
      continue;
    }

    // --- Nombre  25  ou  14.5 ---
    if (isDigit(ch)) {
      let text = "";
      while (pos < source.length && isDigit(peek())) text += advance();
      if (peek() === "." && isDigit(peek(1))) {
        text += advance(); // le point
        while (pos < source.length && isDigit(peek())) text += advance();
      }
      push("number", text, text, startPos, startLine, startCol);
      continue;
    }

    // --- Parenthèses / crochets ---
    if (ch === "(" || ch === ")") {
      advance();
      push("paren", ch, ch, startPos, startLine, startCol);
      continue;
    }
    if (ch === "[" || ch === "]") {
      advance();
      push("bracket", ch, ch, startPos, startLine, startCol);
      continue;
    }

    // --- Identifiants & mots-clés ---
    if (isLetter(ch)) {
      let text = "";
      while (pos < source.length && isLetterOrDigit(peek())) text += advance();
      // Cas particulier : « jusqu'à » contient une apostrophe (droite ou typographique).
      if ((peek() === "'" || peek() === "’" || peek() === "‘" || peek() === "ʼ") && normalize(text) === "jusqu") {
        text += advance(); // l'apostrophe
        while (pos < source.length && isLetterOrDigit(peek())) text += advance();
      }
      const norm = normalize(text);

      // Tentative de mot-clé à deux mots (Tant que, Sinon Si).
      const seconds = TWO_WORD_STARTS[norm];
      if (seconds) {
        // On regarde le prochain mot sans consommer définitivement.
        const saved = { pos, line, col };
        // sauter les espaces
        while (peek() === " " || peek() === "\t") advance();
        let second = "";
        const secondStartLetter = peek();
        if (isLetter(secondStartLetter)) {
          while (pos < source.length && isLetterOrDigit(peek())) second += advance();
        }
        const secondNorm = normalize(second);
        if (second && seconds.includes(secondNorm)) {
          const combined = norm + " " + secondNorm;
          const canonical = KEYWORDS[combined] ?? text + " " + second;
          push("keyword", text + " " + second, normalize(canonical), startPos, startLine, startCol);
          continue;
        }
        // Pas de second mot attendu : on rembobine.
        pos = saved.pos;
        line = saved.line;
        col = saved.col;
      }

      let type: TokenType = "identifier";
      let normalized = norm;
      // « à » est le mot-clé de la boucle Pour. On le traite à part pour ne
      // pas le confondre avec une variable nommée « a » (sans accent).
      if (text === "à" || text === "À") {
        type = "keyword";
        normalized = "à";
      } else if (KEYWORDS[norm]) {
        type = "keyword";
      } else if (WORD_OPERATORS[norm]) {
        // MOD / DIV : opérateurs-mots. On conserve le texte d'origine dans
        // `value` (affichage) et on place le symbole équivalent dans `normalized`.
        type = "operator";
        normalized = WORD_OPERATORS[norm];
      } else if (TYPES[norm]) {
        type = "type";
      } else if (BOOLEANS.has(norm)) {
        type = "boolean";
      } else if (LOGIC.has(norm)) {
        type = "logic";
      }
      push(type, text, normalized, startPos, startLine, startCol);
      continue;
    }

    // --- Opérateurs symboliques ---
    const sym = SYMBOL_OPERATORS.find((s) => source.startsWith(s, pos));
    if (sym) {
      for (let i = 0; i < sym.length; i++) advance();
      push("operator", sym, sym, startPos, startLine, startCol);
      continue;
    }

    // --- Caractère inconnu ---
    advance();
    errors.push(
      makeError(
        `Caractère inattendu « ${ch} ».`,
        startPos,
        pos,
        startLine,
        startCol
      )
    );
  }

  tokens.push({
    type: "eof",
    value: "",
    normalized: "",
    line,
    col,
    from: pos,
    to: pos,
  });

  return { tokens, errors };
}
