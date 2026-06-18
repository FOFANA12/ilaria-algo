/**
 * Parser produisant l'AST exécutable du pseudo-code ilaria-algo.
 *
 * Contrairement au validateur structurel (parser.ts), celui-ci construit un
 * arbre complet destiné à l'interpréteur. Il s'arrête à la première erreur
 * rencontrée (échec rapide) et renvoie un message clair en français.
 */

import { lex } from "./lexer";
import { Token } from "./tokens";
import { Expr, Param, Pos, Program, SelonCase, Stmt, IfBranch } from "./ast";

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
    public from: number,
    public to: number
  ) {
    super(message);
  }
}

export function parseProgram(source: string): Program {
  const { tokens } = lex(source);
  // On garde les sauts de ligne (séparateurs d'instructions), on retire les commentaires.
  const stream = tokens.filter((t) => t.type !== "comment");
  return new Parser(stream).parseProgram();
}

class Parser {
  private i = 0;
  constructor(private toks: Token[]) {}

  // ----- Outils de base -----

  private peek(offset = 0): Token {
    return this.toks[Math.min(this.i + offset, this.toks.length - 1)];
  }
  private at(): Token {
    return this.peek();
  }
  private next(): Token {
    return this.toks[this.i++];
  }
  private isEOF(): boolean {
    return this.at().type === "eof";
  }
  private posOf(t: Token): Pos {
    return { line: t.line, col: t.col, from: t.from, to: t.to };
  }
  private err(message: string, t = this.at()): never {
    throw new ParseError(message, t.line, t.col, t.from, t.to);
  }

  /** Vrai si le token courant est un mot-clé de forme normalisée donnée. */
  private isKw(norm: string): boolean {
    const t = this.at();
    return t.type === "keyword" && t.normalized === norm;
  }
  /** Consomme un mot-clé attendu, sinon erreur. */
  private expectKw(norm: string, label: string): Token {
    if (!this.isKw(norm)) {
      this.err(`« ${label} » attendu ici.`);
    }
    return this.next();
  }
  private isOp(value: string): boolean {
    const t = this.at();
    return t.type === "operator" && t.value === value;
  }
  private expectOp(value: string): Token {
    if (!this.isOp(value)) this.err(`« ${value} » attendu ici.`);
    return this.next();
  }

  private skipNewlines(): void {
    while (this.at().type === "newline") this.i++;
  }
  /** Consomme la fin d'une instruction simple (newline ou EOF). */
  private endStatement(): void {
    if (this.at().type === "newline" || this.isEOF()) return;
    // tolérant : certaines constructions enchaînent sur la même ligne (ex. Cas).
  }

  // ----- Programme -----

  parseProgram(): Program {
    const statements: Stmt[] = [];
    this.skipNewlines();
    while (!this.isEOF()) {
      const s = this.parseStatement();
      if (s) statements.push(s);
      this.skipNewlines();
    }
    return { statements };
  }

  /** Parse une instruction. Renvoie null pour les marqueurs (Algorithme, Variables, Debut, Fin). */
  private parseStatement(): Stmt | null {
    const t = this.at();

    if (t.type === "keyword") {
      switch (t.normalized) {
        case "algorithme":
          this.next();
          if (this.at().type === "identifier") this.next(); // nom de l'algo
          return null;
        case "variables":
        case "debut":
          this.next();
          return null;
        case "fin":
          this.next();
          return null;
        case "si":
          return this.parseIf();
        case "selon":
          return this.parseSelon();
        case "pour":
          return this.parsePour();
        case "tant que":
          return this.parseTantQue();
        case "repeter":
          return this.parseRepeter();
        case "afficher":
          return this.parseAfficher();
        case "lire":
          return this.parseLire();
        case "procedure":
          return this.parseProcedure();
        case "fonction":
          return this.parseFonction();
        case "retourner":
          return this.parseRetourner();
        case "tableau":
          return this.parseTableauDecl();
        default:
          this.err(`Mot-clé « ${t.value} » inattendu à cet endroit.`);
      }
    }

    if (t.type === "identifier") {
      return this.parseIdentifierStatement();
    }

    this.err(`Instruction invalide près de « ${t.value || "fin de fichier"} ».`);
  }

  // ----- Instructions débutant par un identifiant -----

  private parseIdentifierStatement(): Stmt {
    const nameTok = this.next(); // identifiant
    const startPos = this.posOf(nameTok);

    // Déclaration avec plusieurs noms : i, j : Entier
    if (this.isOp(",")) {
      const names = [nameTok.value];
      while (this.isOp(",")) {
        this.next();
        if (this.at().type !== "identifier")
          this.err("Nom de variable attendu après « , ».");
        names.push(this.next().value);
      }
      this.expectOp(":");
      const type = this.expectType();
      let init: Expr | undefined;
      if (this.isAssign()) {
        this.next();
        init = this.parseExpr();
      }
      return { kind: "declare", names, type, init, pos: startPos };
    }

    // Déclaration simple : nom : Type [<- expr]
    if (this.isOp(":")) {
      this.next();
      const type = this.expectType();
      let init: Expr | undefined;
      if (this.isAssign()) {
        this.next();
        init = this.parseExpr();
      }
      return { kind: "declare", names: [nameTok.value], type, init, pos: startPos };
    }

    // Accès indexé : nom[..] ...
    if (this.isBracket("[")) {
      const indices = this.parseIndices();
      // Déclaration de tableau sans le mot Tableau : notes[5] : Entier
      if (this.isOp(":")) {
        this.next();
        const type = this.expectType();
        return { kind: "declareArray", name: nameTok.value, sizes: indices, type, pos: startPos };
      }
      // Affectation indexée : notes[i] <- expr
      if (this.isAssign()) {
        this.next();
        const value = this.parseExpr();
        const target: Expr = { kind: "index", name: nameTok.value, indices, pos: startPos };
        return { kind: "assign", target, value, pos: startPos };
      }
      this.err("« <- » ou « : » attendu après l'accès au tableau.");
    }

    // Appel de procédure avec parenthèses : nom(args)
    if (this.isParen("(")) {
      const args = this.parseArgs();
      return { kind: "call", name: nameTok.value, args, pos: startPos };
    }

    // Affectation simple : nom <- expr
    if (this.isAssign()) {
      this.next();
      const value = this.parseExpr();
      const target: Expr = { kind: "var", name: nameTok.value, pos: startPos };
      return { kind: "assign", target, value, pos: startPos };
    }

    // Sinon : appel de procédure sans parenthèses (ex. AfficherSeparateur)
    return { kind: "call", name: nameTok.value, args: [], pos: startPos };
  }

  // ----- Déclarations -----

  private expectType(): string {
    const t = this.at();
    if (t.type !== "type")
      this.err(
        "Type attendu (Entier, Reel, Chaine, Caractere ou Booleen)."
      );
    this.next();
    return t.normalized;
  }

  private parseTableauDecl(): Stmt {
    const kw = this.next(); // Tableau
    const pos = this.posOf(kw);
    if (this.at().type !== "identifier")
      this.err("Nom du tableau attendu après « Tableau ».");
    const name = this.next().value;
    if (!this.isBracket("["))
      this.err("Taille du tableau attendue, ex. « [5] ».");
    const sizes = this.parseIndices();

    if (this.isOp(":")) {
      this.next();
      const type = this.expectType();
      return { kind: "declareArray", name, sizes, type, pos };
    }
    if (this.isAssign()) {
      this.next();
      const init = this.parseArrayLiteral();
      return { kind: "declareArray", name, sizes, init, pos };
    }
    this.err("« : » ou « <- » attendu dans la déclaration du tableau.");
  }

  private parseArrayLiteral(): Expr[] {
    if (!this.isBracket("[")) this.err("« [ » attendu pour la liste de valeurs.");
    this.next();
    const items: Expr[] = [];
    if (!this.isBracket("]")) {
      items.push(this.parseExpr());
      while (this.isOp(",")) {
        this.next();
        items.push(this.parseExpr());
      }
    }
    if (!this.isBracket("]")) this.err("« ] » attendu pour fermer la liste.");
    this.next();
    return items;
  }

  // ----- E/S -----

  private parseAfficher(): Stmt {
    const kw = this.next();
    const pos = this.posOf(kw);
    // « Afficher » seul (sans argument) : affiche une ligne vide.
    if (this.at().type === "newline" || this.isEOF() || this.isBlockEnd()) {
      return { kind: "afficher", parts: [], pos };
    }
    const value = this.parseExpr();
    if (this.isOp(",")) {
      this.err(
        "Afficher n'accepte qu'une seule expression. Pour assembler du texte et des variables, " +
          "utilisez « + » (ex. : Afficher \"Bonjour \" + nom + \" !\").",
        this.at()
      );
    }
    this.endStatement();
    return { kind: "afficher", parts: [value], pos };
  }

  private parseLire(): Stmt {
    const kw = this.next();
    const pos = this.posOf(kw);
    if (this.at().type !== "identifier")
      this.err("Nom de variable attendu après « Lire ».");
    const nameTok = this.next();
    let target: Expr = { kind: "var", name: nameTok.value, pos: this.posOf(nameTok) };
    if (this.isBracket("[")) {
      const indices = this.parseIndices();
      target = { kind: "index", name: nameTok.value, indices, pos: this.posOf(nameTok) };
    }
    return { kind: "lire", target, pos };
  }

  // ----- Conditions -----

  private parseIf(): Stmt {
    const kw = this.next(); // Si
    const pos = this.posOf(kw);
    const branches: IfBranch[] = [];
    let elseBody: Stmt[] | undefined;

    const cond = this.parseExpr();
    this.expectKw("alors", "Alors");
    const body = this.parseBlock(["sinon", "finsi"]);
    branches.push({ cond, body });

    // Sinon Si ... / Sinon ...
    while (true) {
      if (this.isKw("sinon si")) {
        this.next();
        const c = this.parseExpr();
        this.expectKw("alors", "Alors");
        const b = this.parseBlock(["sinon", "finsi"]);
        branches.push({ cond: c, body: b });
        continue;
      }
      if (this.isKw("sinon")) {
        this.next();
        // « Sinon Si » écrit sur deux tokens séparés (lignes différentes)
        if (this.isKw("si")) {
          this.next();
          const c = this.parseExpr();
          this.expectKw("alors", "Alors");
          const b = this.parseBlock(["sinon", "finsi"]);
          branches.push({ cond: c, body: b });
          continue;
        }
        elseBody = this.parseBlock(["finsi"]);
      }
      break;
    }

    this.expectKw("finsi", "FinSi");
    return { kind: "if", branches, elseBody, pos };
  }

  private parseSelon(): Stmt {
    const kw = this.next(); // Selon
    const pos = this.posOf(kw);
    const expr = this.parseExpr();
    this.expectKw("faire", "Faire");
    this.skipNewlines();

    const cases: SelonCase[] = [];
    let autre: Stmt[] | undefined;

    while (!this.isKw("finselon") && !this.isEOF()) {
      if (this.isKw("cas")) {
        this.next();
        const values: Expr[] = [this.parseExpr()];
        while (this.isOp(",")) {
          this.next();
          values.push(this.parseExpr());
        }
        this.expectOp(":");
        const body = this.parseBlock(["cas", "autre", "finselon"]);
        cases.push({ values, body });
      } else if (this.isKw("autre")) {
        this.next();
        this.expectOp(":");
        autre = this.parseBlock(["cas", "autre", "finselon"]);
      } else {
        this.err("« Cas », « Autre » ou « FinSelon » attendu dans un bloc Selon.");
      }
      this.skipNewlines();
    }

    this.expectKw("finselon", "FinSelon");
    return { kind: "selon", expr, cases, autre, pos };
  }

  // ----- Boucles -----

  private parsePour(): Stmt {
    const kw = this.next(); // Pour
    const pos = this.posOf(kw);
    if (this.at().type !== "identifier")
      this.err("Variable de boucle attendue après « Pour ».");
    const varName = this.next().value;
    if (!this.isAssign()) this.err("« <- » attendu pour initialiser la boucle Pour.");
    this.next();
    const start = this.parseExpr();
    // « à » entre les deux bornes — on tolère aussi « a » sans accent à cet
    // endroit précis (sans risque de confusion avec une variable nommée « a »).
    const sep = this.at();
    const isBornesSep =
      (sep.type === "keyword" && sep.normalized === "à") ||
      (sep.type === "identifier" && sep.normalized === "a");
    if (!isBornesSep) this.err("« à » attendu ici.");
    this.next();
    const end = this.parseExpr();
    let step: Expr | undefined;
    if (this.isKw("pas")) {
      this.next();
      step = this.parseExpr();
    }
    this.expectKw("faire", "Faire");
    const body = this.parseBlock(["finpour"]);
    this.expectKw("finpour", "FinPour");
    return { kind: "pour", varName, start, end, step, body, pos };
  }

  private parseTantQue(): Stmt {
    const kw = this.next(); // Tant que
    const pos = this.posOf(kw);
    const cond = this.parseExpr();
    this.expectKw("faire", "Faire");
    const body = this.parseBlock(["fintantque"]);
    this.expectKw("fintantque", "FinTantQue");
    return { kind: "tantque", cond, body, pos };
  }

  private parseRepeter(): Stmt {
    const kw = this.next(); // Repeter
    const pos = this.posOf(kw);
    const body = this.parseBlock(["jusqua"]);
    this.expectKw("jusqua", "Jusqua");
    const cond = this.parseExpr();
    return { kind: "repeter", body, cond, pos };
  }

  // ----- Sous-programmes -----

  private parseParams(): Param[] {
    const params: Param[] = [];
    this.expectParen("(");
    if (!this.isParen(")")) {
      do {
        if (this.at().type !== "identifier")
          this.err("Nom de paramètre attendu.");
        const name = this.next().value;
        this.expectOp(":");
        const type = this.expectType();
        params.push({ name, type });
      } while (this.acceptOp(","));
    }
    this.expectParen(")");
    return params;
  }

  private parseProcedure(): Stmt {
    const kw = this.next();
    const pos = this.posOf(kw);
    if (this.at().type !== "identifier")
      this.err("Nom de la procédure attendu.");
    const name = this.next().value;
    const params = this.isParen("(") ? this.parseParams() : [];
    const body = this.parseBlock(["finprocedure"]);
    this.expectKw("finprocedure", "FinProcedure");
    return { kind: "procedure", name, params, body, pos };
  }

  private parseFonction(): Stmt {
    const kw = this.next();
    const pos = this.posOf(kw);
    if (this.at().type !== "identifier")
      this.err("Nom de la fonction attendu.");
    const name = this.next().value;
    const params = this.isParen("(") ? this.parseParams() : [];
    this.expectOp(":");
    const returnType = this.expectType();
    const body = this.parseBlock(["finfonction"]);
    this.expectKw("finfonction", "FinFonction");
    return { kind: "fonction", name, params, returnType, body, pos };
  }

  private parseRetourner(): Stmt {
    const kw = this.next();
    const pos = this.posOf(kw);
    let value: Expr | undefined;
    if (this.at().type !== "newline" && !this.isEOF() && !this.isBlockEnd()) {
      value = this.parseExpr();
      if (this.isOp(",")) {
        this.err(
          "Retourner n'accepte qu'une seule expression. Pour assembler du texte, " +
            "utilisez « + » (ex. : Retourner \"Bonjour \" + nom + \" !\").",
          this.at()
        );
      }
    }
    return { kind: "retourner", value, pos };
  }

  // ----- Blocs -----

  /** Parse une suite d'instructions jusqu'à l'un des mots-clés de fin donnés. */
  private parseBlock(stopKeywords: string[]): Stmt[] {
    const stmts: Stmt[] = [];
    this.skipNewlines();
    while (!this.isEOF() && !this.atStop(stopKeywords)) {
      const s = this.parseStatement();
      if (s) stmts.push(s);
      this.skipNewlines();
    }
    return stmts;
  }

  private atStop(stopKeywords: string[]): boolean {
    const t = this.at();
    if (t.type !== "keyword") return false;
    // « sinon si » s'arrête aussi sur « sinon »
    if (stopKeywords.includes("sinon") && t.normalized === "sinon si") return true;
    return stopKeywords.includes(t.normalized);
  }

  private isBlockEnd(): boolean {
    const t = this.at();
    return (
      t.type === "keyword" &&
      [
        "finsi",
        "finpour",
        "fintantque",
        "finselon",
        "finprocedure",
        "finfonction",
        "jusqua",
        "sinon",
        "cas",
        "autre",
      ].includes(t.normalized)
    );
  }

  // ----- Helpers tokens -----

  private isAssign(): boolean {
    return this.at().type === "assign";
  }
  private isParen(v: string): boolean {
    return this.at().type === "paren" && this.at().value === v;
  }
  private expectParen(v: string): Token {
    if (!this.isParen(v)) this.err(`« ${v} » attendu.`);
    return this.next();
  }
  private isBracket(v: string): boolean {
    return this.at().type === "bracket" && this.at().value === v;
  }
  private acceptOp(v: string): boolean {
    if (this.isOp(v)) {
      this.next();
      return true;
    }
    return false;
  }

  private parseIndices(): Expr[] {
    const indices: Expr[] = [];
    while (this.isBracket("[")) {
      this.next();
      indices.push(this.parseExpr());
      if (!this.isBracket("]")) this.err("« ] » attendu après l'indice.");
      this.next();
    }
    return indices;
  }

  private parseArgs(): Expr[] {
    this.expectParen("(");
    const args: Expr[] = [];
    if (!this.isParen(")")) {
      args.push(this.parseExpr());
      while (this.isOp(",")) {
        this.next();
        args.push(this.parseExpr());
      }
    }
    this.expectParen(")");
    return args;
  }

  // ----- Expressions (par priorité décroissante) -----

  private parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.at().type === "logic" && this.at().normalized === "ou") {
      const op = this.next();
      const right = this.parseAnd();
      left = { kind: "binary", op: "ou", left, right, pos: this.posOf(op) };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.at().type === "logic" && this.at().normalized === "et") {
      const op = this.next();
      const right = this.parseNot();
      left = { kind: "binary", op: "et", left, right, pos: this.posOf(op) };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.at().type === "logic" && this.at().normalized === "non") {
      const op = this.next();
      const operand = this.parseNot();
      return { kind: "unary", op: "non", operand, pos: this.posOf(op) };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdd();
    while (
      this.at().type === "operator" &&
      ["=", "!=", "<", ">", "<=", ">="].includes(this.at().value)
    ) {
      const op = this.next();
      const right = this.parseAdd();
      left = { kind: "binary", op: op.value, left, right, pos: this.posOf(op) };
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (
      this.at().type === "operator" &&
      ["+", "-"].includes(this.at().value)
    ) {
      const op = this.next();
      const right = this.parseMul();
      left = { kind: "binary", op: op.value, left, right, pos: this.posOf(op) };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    // On compare sur `normalized` : pour les symboles il vaut le symbole
    // lui-même, et pour les opérateurs-mots « MOD » / « DIV » il vaut « % » /
    // « // ». Les deux écritures partagent ainsi la priorité de Multiplication.
    while (
      this.at().type === "operator" &&
      ["*", "/", "//", "%"].includes(this.at().normalized)
    ) {
      const op = this.next();
      const right = this.parseUnary();
      left = { kind: "binary", op: op.normalized, left, right, pos: this.posOf(op) };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.at().type === "operator" && this.at().value === "-") {
      const op = this.next();
      const operand = this.parseUnary();
      return { kind: "unary", op: "-", operand, pos: this.posOf(op) };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.at();

    if (t.type === "number") {
      this.next();
      return { kind: "num", value: parseFloat(t.value), pos: this.posOf(t) };
    }
    if (t.type === "string") {
      this.next();
      return { kind: "str", value: unquote(t.value), pos: this.posOf(t) };
    }
    if (t.type === "boolean") {
      this.next();
      return { kind: "bool", value: t.normalized === "vrai", pos: this.posOf(t) };
    }
    if (this.isParen("(")) {
      this.next();
      const e = this.parseExpr();
      this.expectParen(")");
      return e;
    }
    if (t.type === "identifier") {
      this.next();
      if (this.isParen("(")) {
        const args = this.parseArgs();
        return { kind: "call", name: t.value, args, pos: this.posOf(t) };
      }
      if (this.isBracket("[")) {
        const indices = this.parseIndices();
        return { kind: "index", name: t.value, indices, pos: this.posOf(t) };
      }
      return { kind: "var", name: t.value, pos: this.posOf(t) };
    }

    this.err(`Expression attendue, mais « ${t.value || "fin de ligne"} » trouvé.`);
  }
}

/** Retire les guillemets entourant une chaîne et gère \" et \\. */
function unquote(raw: string): string {
  let s = raw;
  if (s.startsWith('"')) s = s.slice(1);
  if (s.endsWith('"')) s = s.slice(0, -1);
  return s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}
