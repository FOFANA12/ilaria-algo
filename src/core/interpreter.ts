/**
 * Interpréteur (tree-walking) du pseudo-code ilaria-algo.
 *
 * Il parcourt l'AST produit par astparser.ts et exécute l'algorithme :
 *   - sorties via le callback `output` (instruction Afficher) ;
 *   - entrées via le callback asynchrone `input` (instruction Lire) ;
 *   - garde-fou anti-boucle-infinie.
 *
 * L'exécution est asynchrone pour permettre une vraie saisie interactive
 * dans la console sans bloquer le navigateur.
 */

import { Expr, Param, Program, Stmt } from "./ast";
import { isConstantName } from "./tokens";

export type Value = number | string | boolean | AlgoArray;

/** Tableau (1D ou 2D) avec ses dimensions et le type de ses éléments. */
class AlgoArray {
  constructor(
    public data: Value[],
    public sizes: number[],
    public elementType?: string
  ) {}
}

export class RuntimeError extends Error {
  constructor(message: string, public line: number) {
    super(message);
  }
}

class ReturnSignal {
  constructor(public value: Value | undefined) {}
}

/** Levée quand l'utilisateur demande l'arrêt de l'exécution. */
export class StopSignal extends Error {
  constructor() {
    super("__STOP__");
  }
}

/** Nombre d'itérations de boucle entre deux « respirations » de l'event-loop. */
const YIELD_INTERVAL = 2000;

interface Callable {
  params: Param[];
  body: Stmt[];
  isFunction: boolean;
}

/** Portée : variables, leurs types déclarés. */
class Scope {
  vars = new Map<string, Value>();
  types = new Map<string, string>();
}

export interface InterpreterOptions {
  output: (text: string) => void;
  input: () => Promise<string>;
  maxSteps?: number;
}

export class Interpreter {
  private callables = new Map<string, Callable>();
  private steps = 0;
  private yieldCounter = 0;
  private stopped = false;
  private callDepth = 0;
  private readonly maxDepth = 1000;
  private readonly maxSteps: number;

  constructor(private opts: InterpreterOptions) {
    this.maxSteps = opts.maxSteps ?? 2_000_000;
  }

  /** Demande l'arrêt : la prochaine étape (ou itération de boucle) lèvera StopSignal. */
  requestStop(): void {
    this.stopped = true;
  }

  async run(program: Program): Promise<void> {
    const global = new Scope();

    // 1re passe : enregistrer procédures et fonctions (utilisables avant leur définition).
    for (const s of program.statements) {
      if (s.kind === "procedure") {
        this.callables.set(key(s.name), { params: s.params, body: s.body, isFunction: false });
      } else if (s.kind === "fonction") {
        this.callables.set(key(s.name), { params: s.params, body: s.body, isFunction: true });
      }
    }

    // 2e passe : exécuter les instructions de premier niveau (hors définitions).
    for (const s of program.statements) {
      if (s.kind === "procedure" || s.kind === "fonction") continue;
      await this.exec(s, global);
    }
  }

  // ---------- Exécution des instructions ----------

  private async exec(stmt: Stmt, scope: Scope): Promise<void> {
    this.tick(stmt.pos.line);

    switch (stmt.kind) {
      case "declare": {
        for (const name of stmt.names) {
          scope.types.set(key(name), stmt.type);
          scope.vars.set(key(name), defaultFor(stmt.type));
        }
        if (stmt.init && stmt.names.length >= 1) {
          const v = this.coerce(await this.eval(stmt.init, scope), stmt.type, stmt.pos.line);
          scope.vars.set(key(stmt.names[0]), v);
        }
        return;
      }

      case "declareArray": {
        const sizes = [];
        for (const s of stmt.sizes) sizes.push(toInt(await this.eval(s, scope), stmt.pos.line));
        const total = sizes.reduce((a, b) => a * b, 1);
        // Une ré-initialisation « Tableau t[…] <- […] » sans « : type » hérite du
        // type d'élément déjà déclaré pour ce tableau dans la section Variables.
        const elemType = stmt.type ?? scope.types.get(key(stmt.name));
        const def: Value = elemType ? defaultFor(elemType) : 0;
        const data: Value[] = new Array(total).fill(def);
        const arr = new AlgoArray(data, sizes, elemType);
        if (stmt.init) {
          for (let k = 0; k < stmt.init.length && k < total; k++) {
            const v = await this.eval(stmt.init[k], scope);
            data[k] = elemType ? this.coerce(v, elemType, stmt.pos.line) : v;
          }
        }
        if (elemType) scope.types.set(key(stmt.name), elemType);
        scope.vars.set(key(stmt.name), arr);
        return;
      }

      case "assign": {
        if (stmt.target.kind === "var" && isConstantName(stmt.target.name))
          throw new RuntimeError(
            `« ${stmt.target.name} » est une constante (nom en MAJUSCULES) : sa valeur ne peut pas être modifiée.`,
            stmt.pos.line
          );
        const value = await this.eval(stmt.value, scope);
        if (stmt.target.kind === "var") {
          const k = key(stmt.target.name);
          const declared = scope.types.get(k);
          scope.vars.set(k, declared ? this.coerce(value, declared, stmt.pos.line) : value);
        } else if (stmt.target.kind === "index") {
          await this.assignIndex(stmt.target.name, stmt.target.indices, value, scope, stmt.pos.line);
        }
        return;
      }

      case "afficher": {
        const parts: string[] = [];
        for (const p of stmt.parts) parts.push(display(await this.eval(p, scope)));
        this.opts.output(parts.join(""));
        return;
      }

      case "lire": {
        if (stmt.target.kind === "var" && isConstantName(stmt.target.name))
          throw new RuntimeError(
            `« ${stmt.target.name} » est une constante (nom en MAJUSCULES) : on ne peut pas y lire une valeur.`,
            stmt.pos.line
          );
        const raw = await this.opts.input();
        let declaredType: string | undefined;
        let name: string;
        if (stmt.target.kind === "var") {
          name = stmt.target.name;
          declaredType = scope.types.get(key(name));
        } else {
          name = (stmt.target as any).name;
          declaredType = scope.types.get(key(name));
        }
        const value = parseInput(raw, declaredType);
        if (stmt.target.kind === "var") {
          const declared = scope.types.get(key(name));
          scope.vars.set(key(name), declared ? this.coerce(value, declared, stmt.pos.line) : value);
        } else if (stmt.target.kind === "index") {
          await this.assignIndex(stmt.target.name, stmt.target.indices, value, scope, stmt.pos.line);
        }
        return;
      }

      case "if": {
        for (const branch of stmt.branches) {
          if (this.truthy(await this.eval(branch.cond, scope), stmt.pos.line)) {
            await this.execBlock(branch.body, scope);
            return;
          }
        }
        if (stmt.elseBody) await this.execBlock(stmt.elseBody, scope);
        return;
      }

      case "selon": {
        const target = await this.eval(stmt.expr, scope);
        for (const c of stmt.cases) {
          for (const v of c.values) {
            if (equals(target, await this.eval(v, scope))) {
              await this.execBlock(c.body, scope);
              return;
            }
          }
        }
        if (stmt.autre) await this.execBlock(stmt.autre, scope);
        return;
      }

      case "pour": {
        const start = toNum(await this.eval(stmt.start, scope), stmt.pos.line);
        const end = toNum(await this.eval(stmt.end, scope), stmt.pos.line);
        const step = stmt.step ? toNum(await this.eval(stmt.step, scope), stmt.pos.line) : 1;
        if (step === 0) throw new RuntimeError("Le pas d'une boucle Pour ne peut pas être 0.", stmt.pos.line);
        const k = key(stmt.varName);
        for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
          this.tick(stmt.pos.line);
          await this.maybeYield();
          scope.vars.set(k, i);
          await this.execBlock(stmt.body, scope);
        }
        return;
      }

      case "tantque": {
        while (this.truthy(await this.eval(stmt.cond, scope), stmt.pos.line)) {
          this.tick(stmt.pos.line);
          await this.maybeYield();
          await this.execBlock(stmt.body, scope);
        }
        return;
      }

      case "repeter": {
        do {
          this.tick(stmt.pos.line);
          await this.maybeYield();
          await this.execBlock(stmt.body, scope);
        } while (!this.truthy(await this.eval(stmt.cond, scope), stmt.pos.line));
        return;
      }

      case "retourner": {
        const value = stmt.value ? await this.eval(stmt.value, scope) : undefined;
        throw new ReturnSignal(value);
      }

      case "call": {
        await this.callCallable(stmt.name, stmt.args, scope, stmt.pos.line);
        return;
      }

      // Les définitions sont déjà enregistrées ; rien à exécuter ici.
      case "procedure":
      case "fonction":
        return;
    }
  }

  private async execBlock(body: Stmt[], scope: Scope): Promise<void> {
    for (const s of body) await this.exec(s, scope);
  }

  // ---------- Évaluation des expressions ----------

  private async eval(expr: Expr, scope: Scope): Promise<Value> {
    switch (expr.kind) {
      case "num":
        return expr.value;
      case "str":
        return expr.value;
      case "bool":
        return expr.value;

      case "var": {
        const k = key(expr.name);
        if (!scope.vars.has(k))
          throw new RuntimeError(`La variable « ${expr.name} » n'a pas été déclarée ni initialisée.`, expr.pos.line);
        return scope.vars.get(k)!;
      }

      case "index": {
        const arr = scope.vars.get(key(expr.name));
        if (!(arr instanceof AlgoArray))
          throw new RuntimeError(`« ${expr.name} » n'est pas un tableau.`, expr.pos.line);
        const idx: number[] = [];
        for (const e of expr.indices) idx.push(toInt(await this.eval(e, scope), expr.pos.line));
        return arr.data[this.flatIndex(arr, idx, expr.name, expr.pos.line)];
      }

      case "unary": {
        const v = await this.eval(expr.operand, scope);
        if (expr.op === "-") {
          if (typeof v !== "number")
            throw new RuntimeError(
              `Le signe « - » s'applique à un nombre, pas à ${describeType(v)}.`,
              expr.pos.line
            );
          return -v;
        }
        if (expr.op === "non") return !this.truthy(v, expr.pos.line);
        throw new RuntimeError(`Opérateur unaire inconnu « ${expr.op} ».`, expr.pos.line);
      }

      case "binary":
        return this.evalBinary(expr, scope);

      case "call":
        return this.callCallable(expr.name, expr.args, scope, expr.pos.line, true);
    }
  }

  private async evalBinary(expr: Extract<Expr, { kind: "binary" }>, scope: Scope): Promise<Value> {
    const op = expr.op;
    const line = expr.pos.line;

    // Court-circuit logique
    if (op === "et") {
      return this.truthy(await this.eval(expr.left, scope), line)
        ? this.truthy(await this.eval(expr.right, scope), line)
        : false;
    }
    if (op === "ou") {
      return this.truthy(await this.eval(expr.left, scope), line)
        ? true
        : this.truthy(await this.eval(expr.right, scope), line);
    }

    const a = await this.eval(expr.left, scope);
    const b = await this.eval(expr.right, scope);

    switch (op) {
      case "+":
        // Seul « + » accepte du texte (concaténation) ; les autres sont
        // strictement numériques.
        if (typeof a === "string" || typeof b === "string") return display(a) + display(b);
        requireNumbers(a, b, op, line);
        return (a as number) + (b as number);
      case "-":
        requireNumbers(a, b, op, line);
        return (a as number) - (b as number);
      case "*":
        requireNumbers(a, b, op, line);
        return (a as number) * (b as number);
      case "/": {
        requireNumbers(a, b, op, line);
        if ((b as number) === 0) throw new RuntimeError("Division par zéro.", line);
        return (a as number) / (b as number);
      }
      case "//": {
        requireNumbers(a, b, op, line);
        if ((b as number) === 0) throw new RuntimeError("Division entière par zéro.", line);
        return Math.floor((a as number) / (b as number));
      }
      case "%": {
        requireNumbers(a, b, op, line);
        if ((b as number) === 0) throw new RuntimeError("Modulo par zéro.", line);
        return (a as number) % (b as number);
      }
      case "=":
        return equals(a, b);
      case "!=":
        return !equals(a, b);
      case "<":
        return compare(a, b, line) < 0;
      case ">":
        return compare(a, b, line) > 0;
      case "<=":
        return compare(a, b, line) <= 0;
      case ">=":
        return compare(a, b, line) >= 0;
      default:
        throw new RuntimeError(`Opérateur « ${op} » inconnu.`, line);
    }
  }

  // ---------- Appels de procédures / fonctions ----------

  private async callCallable(
    name: string,
    args: Expr[],
    scope: Scope,
    line: number,
    expectValue = false
  ): Promise<Value> {
    const fn = this.callables.get(key(name));
    if (!fn)
      throw new RuntimeError(
        `« ${name} » n'est pas une procédure ni une fonction connue.`,
        line
      );
    if (args.length !== fn.params.length)
      throw new RuntimeError(
        `« ${name} » attend ${fn.params.length} paramètre(s), mais ${args.length} ont été fournis.`,
        line
      );
    if (expectValue && !fn.isFunction)
      throw new RuntimeError(
        `« ${name} » est une procédure : elle ne renvoie pas de valeur et ne peut pas ` +
          `être utilisée dans une expression (utilisez une fonction avec Retourner).`,
        line
      );

    if (this.callDepth >= this.maxDepth)
      throw new RuntimeError(
        `Récursion trop profonde (plus de ${this.maxDepth} appels imbriqués) : ` +
          `« ${name} » s'appelle peut-être sans condition d'arrêt.`,
        line
      );

    this.callDepth++;
    try {
      const local = new Scope();
      for (let i = 0; i < fn.params.length; i++) {
        const p = fn.params[i];
        const v = this.coerce(await this.eval(args[i], scope), p.type, line);
        local.vars.set(key(p.name), v);
        local.types.set(key(p.name), p.type);
      }

      try {
        await this.execBlock(fn.body, local);
      } catch (e) {
        if (e instanceof ReturnSignal) {
          return e.value ?? "";
        }
        throw e;
      }

      if (expectValue && fn.isFunction) {
        throw new RuntimeError(`La fonction « ${name} » n'a rien retourné.`, line);
      }
      return "";
    } finally {
      this.callDepth--;
    }
  }

  // ---------- Tableaux ----------

  private async assignIndex(
    name: string,
    indexExprs: Expr[],
    value: Value,
    scope: Scope,
    line: number
  ): Promise<void> {
    const arr = scope.vars.get(key(name));
    if (!(arr instanceof AlgoArray))
      throw new RuntimeError(`« ${name} » n'est pas un tableau.`, line);
    const idx: number[] = [];
    for (const e of indexExprs) idx.push(toInt(await this.eval(e, scope), line));
    const flat = this.flatIndex(arr, idx, name, line);
    arr.data[flat] = arr.elementType ? this.coerce(value, arr.elementType, line) : value;
  }

  private flatIndex(arr: AlgoArray, idx: number[], name: string, line: number): number {
    if (idx.length !== arr.sizes.length)
      throw new RuntimeError(
        `« ${name} » attend ${arr.sizes.length} indice(s), mais ${idx.length} ont été donnés.`,
        line
      );
    let flat = 0;
    for (let d = 0; d < idx.length; d++) {
      if (idx[d] < 0 || idx[d] >= arr.sizes[d])
        throw new RuntimeError(
          `Indice ${idx[d]} hors limites pour « ${name} » (taille ${arr.sizes[d]}, indices valides 0 à ${arr.sizes[d] - 1}).`,
          line
        );
      flat = flat * arr.sizes[d] + idx[d];
    }
    return flat;
  }

  // ---------- Utilitaires ----------

  private truthy(v: Value, line: number): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    throw new RuntimeError("Une condition doit être un booléen (vrai/faux).", line);
  }

  private coerce(v: Value, type: string, line: number): Value {
    switch (type) {
      case "entier":
        return Math.trunc(toNum(v, line));
      case "reel":
        return toNum(v, line);
      case "chaine":
      case "caractere":
        return display(v);
      case "booleen":
        return typeof v === "boolean" ? v : this.truthy(v, line);
      default:
        return v;
    }
  }

  private tick(line: number): void {
    if (this.stopped) throw new StopSignal();
    if (++this.steps > this.maxSteps)
      throw new RuntimeError(
        "Exécution interrompue : trop d'étapes (boucle infinie ?).",
        line
      );
  }

  /**
   * À appeler à chaque tour de boucle : rend périodiquement la main à
   * l'event-loop (l'UI reste réactive, le bouton « Arrêter » est pris en compte)
   * et interrompt l'exécution si l'arrêt a été demandé.
   */
  private async maybeYield(): Promise<void> {
    if (this.stopped) throw new StopSignal();
    if (++this.yieldCounter >= YIELD_INTERVAL) {
      this.yieldCounter = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (this.stopped) throw new StopSignal();
    }
  }
}

// ---------- Fonctions libres ----------

/** Clé insensible à la casse pour les identifiants. */
function key(name: string): string {
  return name.toLowerCase();
}

function defaultFor(type: string): Value {
  switch (type) {
    case "entier":
    case "reel":
      return 0;
    case "chaine":
    case "caractere":
      return "";
    case "booleen":
      return false;
    default:
      return 0;
  }
}

/** Décrit le type d'une valeur pour un message d'erreur lisible. */
function describeType(v: Value): string {
  if (typeof v === "string") return `une chaîne (« ${v} »)`;
  if (typeof v === "boolean") return "un booléen";
  if (v instanceof AlgoArray) return "un tableau";
  return "un nombre";
}

/** Vérifie que les deux opérandes d'une opération arithmétique sont des nombres. */
function requireNumbers(a: Value, b: Value, op: string, line: number): void {
  if (typeof a !== "number" || typeof b !== "number") {
    const bad = typeof a !== "number" ? a : b;
    throw new RuntimeError(
      `L'opérateur « ${op} » s'applique à des nombres, pas à ${describeType(bad)}.`,
      line
    );
  }
}

function toNum(v: Value, line: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(n)) return n;
  throw new RuntimeError(`« ${display(v)} » n'est pas un nombre.`, line);
}

function toInt(v: Value, line: number): number {
  return Math.trunc(toNum(v, line));
}

function equals(a: Value, b: Value): boolean {
  return a === b;
}

function compare(a: Value, b: Value, line: number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string")
    return a < b ? -1 : a > b ? 1 : 0;
  throw new RuntimeError("Comparaison impossible entre ces deux valeurs.", line);
}

/** Représentation textuelle d'une valeur pour Afficher. */
function display(v: Value): string {
  if (typeof v === "boolean") return v ? "vrai" : "faux";
  if (v instanceof AlgoArray) return "[" + v.data.map(display).join(", ") + "]";
  if (typeof v === "number") {
    // Affiche les entiers sans décimale superflue.
    return Number.isInteger(v) ? String(v) : String(v);
  }
  return String(v);
}

/** Convertit une saisie clavier selon le type déclaré de la variable. */
function parseInput(raw: string, declaredType?: string): Value {
  const text = raw.trim();
  if (declaredType === "entier") {
    const n = parseInt(text, 10);
    if (Number.isNaN(n)) throw new RuntimeError(`Entier attendu, mais « ${raw} » a été saisi.`, 0);
    return n;
  }
  if (declaredType === "reel") {
    const n = parseFloat(text.replace(",", "."));
    if (Number.isNaN(n)) throw new RuntimeError(`Nombre attendu, mais « ${raw} » a été saisi.`, 0);
    return n;
  }
  if (declaredType === "booleen") {
    return /^(vrai|true|oui|1)$/i.test(text);
  }
  if (declaredType === "caractere") {
    // Un Caractère contient exactement un caractère.
    if (raw.length !== 1)
      throw new RuntimeError(
        raw.length === 0
          ? "Un caractère est attendu, mais rien n'a été saisi."
          : `Un seul caractère est attendu, mais « ${raw} » a été saisi.`,
        0
      );
    return raw;
  }
  if (declaredType === "chaine") {
    return raw;
  }
  // Type inconnu : on devine.
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return raw;
}
