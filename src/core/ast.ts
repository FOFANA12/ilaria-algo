/**
 * Définition de l'arbre syntaxique (AST) du pseudo-code ilaria-algo.
 * L'AST est produit par astparser.ts puis parcouru par interpreter.ts
 * pour exécuter réellement l'algorithme.
 */

export interface Pos {
  line: number;
  col: number;
  from: number;
  to: number;
}

// ---------- Expressions ----------

export type Expr =
  | { kind: "num"; value: number; pos: Pos }
  | { kind: "str"; value: string; pos: Pos }
  | { kind: "bool"; value: boolean; pos: Pos }
  | { kind: "var"; name: string; pos: Pos }
  | { kind: "index"; name: string; indices: Expr[]; pos: Pos }
  | { kind: "unary"; op: string; operand: Expr; pos: Pos }
  | { kind: "binary"; op: string; left: Expr; right: Expr; pos: Pos }
  | { kind: "call"; name: string; args: Expr[]; pos: Pos };

// ---------- Instructions ----------

export interface Param {
  name: string;
  type: string;
}

export interface IfBranch {
  cond: Expr;
  body: Stmt[];
}

export interface SelonCase {
  values: Expr[]; // une ou plusieurs valeurs pour ce Cas
  body: Stmt[];
}

export type Stmt =
  | { kind: "declare"; names: string[]; type: string; init?: Expr; pos: Pos }
  | {
      kind: "declareArray";
      name: string;
      sizes: Expr[];
      type?: string;
      init?: Expr[];
      pos: Pos;
    }
  | { kind: "assign"; target: Expr; value: Expr; pos: Pos } // target = var | index
  | { kind: "afficher"; parts: Expr[]; pos: Pos }
  | { kind: "lire"; target: Expr; pos: Pos } // target = var | index
  | { kind: "if"; branches: IfBranch[]; elseBody?: Stmt[]; pos: Pos }
  | { kind: "selon"; expr: Expr; cases: SelonCase[]; autre?: Stmt[]; pos: Pos }
  | {
      kind: "pour";
      varName: string;
      start: Expr;
      end: Expr;
      step?: Expr;
      body: Stmt[];
      pos: Pos;
    }
  | { kind: "tantque"; cond: Expr; body: Stmt[]; pos: Pos }
  | { kind: "repeter"; body: Stmt[]; cond: Expr; pos: Pos }
  | {
      kind: "procedure";
      name: string;
      params: Param[];
      body: Stmt[];
      pos: Pos;
    }
  | {
      kind: "fonction";
      name: string;
      params: Param[];
      returnType: string;
      body: Stmt[];
      pos: Pos;
    }
  | { kind: "retourner"; value?: Expr; pos: Pos }
  | { kind: "call"; name: string; args: Expr[]; pos: Pos };

export interface Program {
  statements: Stmt[];
}
