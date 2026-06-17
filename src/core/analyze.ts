/**
 * Analyse complète d'un programme ilaria-algo :
 *   1. lexicale + structurelle + ordre (parser.ts) ;
 *   2. sémantique : toute variable utilisée doit être déclarée.
 *
 * C'est le point d'entrée unique utilisé par le linter (soulignement en direct)
 * et par le bouton « Exécuter ». La sémantique n'est analysée que si la
 * structure est valide (sinon l'arbre ne serait pas fiable).
 */

import { parse } from "./parser";
import { parseProgram, ParseError } from "./astparser";
import { lex } from "./lexer";
import { isConstantName, TYPES } from "./tokens";
import { AlgoError, makeError } from "./errors";
import { Expr, Pos, Program, Stmt } from "./ast";

export function analyze(source: string): AlgoError[] {
  const structural = parse(source).errors;
  const blocking = structural.filter((e) => e.severity === "error");
  if (blocking.length > 0) return structural; // structure cassée : on s'arrête là

  let program: Program;
  try {
    program = parseProgram(source);
  } catch (e) {
    if (e instanceof ParseError) {
      return [...structural, makeError(e.message, e.from, e.to, e.line, e.col)];
    }
    return structural;
  }

  return [...structural, ...checkVariables(source, program)];
}

// ---------- Vérification des déclarations de variables ----------

function checkVariables(source: string, program: Program): AlgoError[] {
  const errors: AlgoError[] = [];
  const toks = lex(source).tokens;

  // Sous-programmes connus (globaux) : pour vérifier les appels partout.
  const subprograms = collectSubprograms(program.statements, errors);

  const varsTok = toks.find((t) => t.type === "keyword" && t.normalized === "variables");
  const debutTok = toks.find((t) => t.type === "keyword" && t.normalized === "debut");

  // Séparer le corps principal des définitions de procédures / fonctions.
  const topLevel: Stmt[] = [];
  const defs: Extract<Stmt, { kind: "procedure" | "fonction" }>[] = [];
  for (const s of program.statements) {
    if (s.kind === "procedure" || s.kind === "fonction") defs.push(s);
    else topLevel.push(s);
  }

  // --- Portée principale (uniquement si un bloc Debut existe) ---
  if (debutTok) {
    const varsFrom = varsTok ? varsTok.from : -1;
    const debutFrom = debutTok.from;
    const isInVariables = (decl: Decl): boolean =>
      decl.pos.from >= varsFrom && decl.pos.from < debutFrom;

    const declarations = collectDeclarations(topLevel);

    // Noms déclarés officiellement dans la section Variables.
    // Un même nom déclaré deux fois ici est un doublon (erreur).
    const declaredInVars = new Set<string>();
    for (const decl of declarations) {
      if (!isInVariables(decl)) continue;
      for (const n of namesOf(decl)) {
        const k = n.toLowerCase();
        if (declaredInVars.has(k)) {
          errors.push(
            err(`« ${n} » est déclaré plusieurs fois dans la section « Variables ».`, decl.pos)
          );
        } else {
          declaredInVars.add(k);
        }
      }
    }

    // Toutes les variables connues (Variables + corps) pour le contrôle d'usage.
    const declared = new Set<string>(declaredInVars);

    // Une déclaration dans le corps n'est tolérée que si la variable a déjà été
    // déclarée dans Variables (cas d'une simple initialisation, ex. Tableau t[5] <- […]).
    for (const decl of declarations) {
      if (isInVariables(decl)) continue;
      const names = namesOf(decl);
      const nouvelles = names.filter((n) => !declaredInVars.has(n.toLowerCase()));
      for (const n of names) declared.add(n.toLowerCase());
      if (nouvelles.length > 0) {
        const what =
          decl.kind === "declare"
            ? `La variable « ${nouvelles.join(", ")} »`
            : `Le tableau « ${nouvelles[0]} »`;
        errors.push(
          err(
            `${what} doit être déclaré dans la section « Variables », et non dans le corps de l'algorithme.`,
            decl.pos
          )
        );
      }
    }

    const checker = new UseChecker(declared, typesOf(declarations), subprograms, errors, " dans la section « Variables »");
    for (const s of topLevel) checker.stmt(s);
  }

  // --- Portées des procédures / fonctions (déclarations en ligne + paramètres) ---
  for (const def of defs) {
    const declared = new Set<string>();
    const types = new Map<string, string>();
    for (const p of def.params) {
      const k = p.name.toLowerCase();
      if (declared.has(k)) {
        errors.push(
          err(`Le paramètre « ${p.name} » de « ${def.name} » est déclaré plusieurs fois.`, def.pos)
        );
      }
      declared.add(k);
      types.set(k, p.type);
    }
    const bodyDecls = collectDeclarations(def.body);
    for (const decl of bodyDecls) {
      for (const n of namesOf(decl)) declared.add(n.toLowerCase());
    }
    for (const [k, v] of typesOf(bodyDecls)) types.set(k, v);
    const checker = new UseChecker(declared, types, subprograms, errors, ` dans « ${def.name} »`);
    for (const s of def.body) checker.stmt(s);
  }

  return errors;
}

type Decl = Extract<Stmt, { kind: "declare" | "declareArray" }>;

/** Opérateurs strictement numériques (« + » exclu : concaténation autorisée). */
const ARITH_OPS = new Set(["-", "*", "/", "//", "%"]);

/** Types non numériques, avec leur libellé pour les messages. */
const NON_NUMERIC_LABEL: Record<string, string> = {
  chaine: "Chaine",
  caractere: "Caractere",
  booleen: "Booleen",
};

/** Grande famille d'un type, pour la compatibilité d'affectation. */
const TYPE_CATEGORY: Record<string, string> = {
  entier: "nombre",
  reel: "nombre",
  chaine: "texte",
  caractere: "texte",
  booleen: "booleen",
};

/** Description d'une catégorie pour les messages d'erreur. */
const CATEGORY_DESC: Record<string, string> = {
  nombre: "un nombre",
  texte: "du texte",
  booleen: "un booléen",
};

/** Noms déclarés par une instruction de déclaration. */
function namesOf(decl: Decl): string[] {
  return decl.kind === "declare" ? decl.names : [decl.name];
}

/** Informations sur un sous-programme défini (pour vérifier les appels). */
interface SubInfo {
  name: string; // nom tel qu'écrit, pour les messages
  arity: number; // nombre de paramètres attendus
  isFunction: boolean; // true = fonction (renvoie une valeur), false = procédure
}

/**
 * Recense toutes les procédures / fonctions définies (clé = nom minuscule).
 * Signale aussi les redéfinitions (même nom défini plusieurs fois).
 */
function collectSubprograms(stmts: Stmt[], errors: AlgoError[]): Map<string, SubInfo> {
  const m = new Map<string, SubInfo>();
  for (const s of stmts) {
    if (s.kind !== "procedure" && s.kind !== "fonction") continue;
    const k = s.name.toLowerCase();
    if (m.has(k)) {
      const what = s.kind === "fonction" ? "La fonction" : "La procédure";
      errors.push(err(`${what} « ${s.name} » est définie plusieurs fois.`, s.pos));
    } else {
      m.set(k, { name: s.name, arity: s.params.length, isFunction: s.kind === "fonction" });
    }
  }
  return m;
}

/** Associe chaque nom déclaré à son type (normalisé : entier, chaine, …). */
function typesOf(decls: Decl[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of decls) {
    if (d.kind === "declare") {
      for (const n of d.names) m.set(n.toLowerCase(), d.type);
    } else if (d.type) {
      m.set(d.name.toLowerCase(), d.type); // type des éléments du tableau
    }
  }
  return m;
}

/** Récupère toutes les déclarations, y compris imbriquées dans des blocs. */
function collectDeclarations(stmts: Stmt[]): Decl[] {
  const out: Decl[] = [];
  const visit = (list: Stmt[]): void => {
    for (const s of list) {
      if (s.kind === "declare" || s.kind === "declareArray") out.push(s);
      else if (s.kind === "if") {
        for (const b of s.branches) visit(b.body);
        if (s.elseBody) visit(s.elseBody);
      } else if (s.kind === "selon") {
        for (const c of s.cases) visit(c.body);
        if (s.autre) visit(s.autre);
      } else if (s.kind === "pour" || s.kind === "tantque" || s.kind === "repeter") {
        visit(s.body);
      }
    }
  };
  visit(stmts);
  return out;
}

/** Parcourt l'arbre et signale toute variable utilisée sans déclaration. */
class UseChecker {
  constructor(
    private declared: Set<string>,
    private types: Map<string, string>,
    private subprograms: Map<string, SubInfo>,
    private errors: AlgoError[],
    private scopeLabel: string
  ) {}

  stmt(s: Stmt): void {
    switch (s.kind) {
      case "declare":
        if (s.init) {
          this.checkTypeCompat(s.type, s.init);
          this.expr(s.init);
        }
        break;
      case "declareArray":
        s.sizes.forEach((e) => this.expr(e));
        if (s.init) s.init.forEach((e) => this.expr(e));
        break;
      case "assign": {
        this.checkNotConst(s.target);
        const targetType =
          s.target.kind === "var" || s.target.kind === "index"
            ? this.types.get(s.target.name.toLowerCase())
            : undefined;
        this.checkTypeCompat(targetType, s.value);
        this.lvalue(s.target);
        this.expr(s.value);
        break;
      }
      case "afficher":
        s.parts.forEach((p) => this.expr(p));
        break;
      case "lire":
        this.checkNotConst(s.target);
        this.lvalue(s.target);
        break;
      case "if":
        for (const b of s.branches) {
          this.expr(b.cond);
          b.body.forEach((x) => this.stmt(x));
        }
        if (s.elseBody) s.elseBody.forEach((x) => this.stmt(x));
        break;
      case "selon":
        this.expr(s.expr);
        for (const c of s.cases) {
          c.values.forEach((v) => this.expr(v));
          c.body.forEach((x) => this.stmt(x));
        }
        if (s.autre) s.autre.forEach((x) => this.stmt(x));
        break;
      case "pour":
        // La variable de boucle est implicitement déclarée par le « Pour ».
        this.declared.add(s.varName.toLowerCase());
        this.expr(s.start);
        this.expr(s.end);
        if (s.step) this.expr(s.step);
        s.body.forEach((x) => this.stmt(x));
        break;
      case "tantque":
        this.expr(s.cond);
        s.body.forEach((x) => this.stmt(x));
        break;
      case "repeter":
        s.body.forEach((x) => this.stmt(x));
        this.expr(s.cond);
        break;
      case "retourner":
        if (s.value) this.expr(s.value);
        break;
      case "call":
        this.checkCall(s.name, s.args.length, s.pos, false); // appel-instruction
        s.args.forEach((a) => this.expr(a));
        break;
    }
  }

  private lvalue(target: Expr): void {
    if (target.kind === "var") this.useVar(target.name, target.pos);
    else if (target.kind === "index") {
      this.useVar(target.name, target.pos);
      target.indices.forEach((e) => this.expr(e));
    }
  }

  private expr(e: Expr): void {
    switch (e.kind) {
      case "num":
      case "str":
      case "bool":
        return;
      case "var":
        this.useVar(e.name, e.pos);
        return;
      case "index":
        this.useVar(e.name, e.pos);
        e.indices.forEach((x) => this.expr(x));
        return;
      case "unary":
        if (e.op === "-") this.checkNumeric(e.operand, "-");
        this.expr(e.operand);
        return;
      case "binary":
        if (ARITH_OPS.has(e.op)) {
          this.checkNumeric(e.left, e.op);
          this.checkNumeric(e.right, e.op);
        }
        this.expr(e.left);
        this.expr(e.right);
        return;
      case "call":
        // « name » désigne une fonction, pas une variable.
        this.checkCall(e.name, e.args.length, e.pos, true); // appel en expression
        e.args.forEach((a) => this.expr(a));
        return;
    }
  }

  /** Type statique « sûr » d'une expression, ou undefined si inconnu. */
  private staticType(e: Expr): string | undefined {
    switch (e.kind) {
      case "num":
        return "entier"; // valeur numérique
      case "str":
        return "chaine";
      case "bool":
        return "booleen";
      case "var":
      case "index":
        return this.types.get(e.name.toLowerCase()); // élément, pour un index
      default:
        return undefined; // appel de fonction, expression composée : on ne tranche pas
    }
  }

  /** Signale une opération arithmétique sur un opérande non numérique connu. */
  private checkNumeric(operand: Expr, op: string): void {
    const ty = this.staticType(operand);
    if (ty && NON_NUMERIC_LABEL[ty]) {
      this.errors.push(
        err(
          `L'opérateur « ${op} » s'applique à des nombres, pas à une valeur de type ${NON_NUMERIC_LABEL[ty]}.`,
          operand.pos
        )
      );
    }
  }

  /**
   * Vérifie qu'un appel cible un sous-programme connu, avec la bonne arité.
   * En contexte d'expression (`inExpression`), interdit l'usage d'une procédure
   * (qui ne renvoie pas de valeur).
   */
  private checkCall(name: string, argCount: number, pos: Pos, inExpression: boolean): void {
    const sub = this.subprograms.get(name.toLowerCase());
    if (!sub) {
      this.errors.push(
        err(`« ${name} » n'est pas une procédure ni une fonction connue.`, pos)
      );
      return;
    }
    if (argCount !== sub.arity) {
      this.errors.push(
        err(
          `« ${sub.name} » attend ${sub.arity} paramètre(s), mais ${argCount} ont été fournis.`,
          pos
        )
      );
    }
    if (inExpression && !sub.isFunction) {
      this.errors.push(
        err(
          `« ${sub.name} » est une procédure : elle ne renvoie pas de valeur ` +
            `(utilisez une fonction avec Retourner).`,
          pos
        )
      );
    }
  }

  /** Catégorie (nombre / texte / booléen) d'une expression, si connue. */
  private exprCategory(e: Expr): string | undefined {
    let t: string | undefined;
    switch (e.kind) {
      case "num":
        return "nombre";
      case "str":
        return "texte";
      case "bool":
        return "booleen";
      case "var":
      case "index":
        t = this.types.get(e.name.toLowerCase());
        break;
      default:
        return undefined; // appel, calcul… : type non tranché, on ne signale rien
    }
    return t ? TYPE_CATEGORY[t] : undefined;
  }

  /** Vérifie qu'une valeur affectée est compatible avec le type déclaré. */
  private checkTypeCompat(declaredType: string | undefined, value: Expr): void {
    if (!declaredType) return;
    const tCat = TYPE_CATEGORY[declaredType];
    const vCat = this.exprCategory(value);
    if (tCat && vCat && tCat !== vCat) {
      this.errors.push(
        err(
          `Type incompatible : ${CATEGORY_DESC[vCat]} ne peut pas être affecté à une variable de type ${TYPES[declaredType] ?? declaredType}.`,
          value.pos
        )
      );
    }
  }

  /** Interdit de modifier une constante (variable au nom tout en MAJUSCULES). */
  private checkNotConst(target: Expr): void {
    if (target.kind === "var" && isConstantName(target.name)) {
      this.errors.push(
        err(
          `« ${target.name} » est une constante (nom en MAJUSCULES) : sa valeur ne peut pas être modifiée après sa création.`,
          target.pos
        )
      );
    }
  }

  private useVar(name: string, pos: Pos): void {
    const k = name.toLowerCase();
    if (!this.declared.has(k)) {
      this.errors.push(
        err(
          `La variable « ${name} » est utilisée mais n'a pas été déclarée${this.scopeLabel}.`,
          pos
        )
      );
      // On la mémorise pour ne pas répéter l'erreur à chaque utilisation.
      this.declared.add(k);
    }
  }
}

function err(message: string, pos: Pos): AlgoError {
  return makeError(message, pos.from, pos.to, pos.line, pos.col);
}
