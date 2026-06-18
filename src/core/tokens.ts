/**
 * Vocabulaire du pseudo-code ilaria-algo.
 * Tiré directement du cours « Algorithmique » d'ilaria Digital School.
 *
 * Toutes les comparaisons de mots-clés se font sur la forme NORMALISÉE
 * (minuscules, sans accents) pour rester tolérant — mais l'affichage et la
 * coloration conservent la casse d'origine du cours (ex. « Si », « FinPour »).
 */

export type TokenType =
  | "keyword" // mot-clé de structure (Si, Pour, Debut…)
  | "type" // type de donnée (Entier, Reel…)
  | "boolean" // vrai / faux
  | "logic" // ET, OU, NON
  | "identifier" // nom de variable / fonction
  | "number" // 25, 14.5
  | "string" // "texte"
  | "operator" // + - * / // % = != < > <= >= : ,
  | "assign" // <-
  | "paren" // ( )
  | "bracket" // [ ]
  | "comment" // // …  ou  /* … */
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  /** Texte tel qu'écrit dans le code source. */
  value: string;
  /** Forme normalisée (minuscule, sans accent) pour les mots-clés. */
  normalized: string;
  line: number; // 1-indexé
  col: number; // 1-indexé
  /** Position absolue dans le texte (pour CodeMirror). */
  from: number;
  to: number;
}

/** Retire les accents et les apostrophes, puis passe en minuscules. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // On supprime toute apostrophe (droite ou typographique) pour que
    // « Jusqu'à », « Jusqu’à » et « Jusqua » se ramènent tous à « jusqua ».
    .replace(/['’‘ʼ]/g, "")
    .toLowerCase();
}

/**
 * Mots-clés de structure.
 * Clé = forme normalisée, valeur = libellé canonique tel qu'enseigné.
 * Certains mots-clés sont composés de deux mots (« tant que », « sinon si »,
 * « jusqu'a »). Ils sont gérés par le lexer après assemblage.
 */
export const KEYWORDS: Record<string, string> = {
  algorithme: "Algorithme",
  variables: "Variables",
  debut: "Debut",
  fin: "Fin",
  si: "Si",
  alors: "Alors",
  sinon: "Sinon",
  finsi: "FinSi",
  selon: "Selon",
  faire: "Faire",
  cas: "Cas",
  autre: "Autre",
  finselon: "FinSelon",
  pour: "Pour",
  pas: "Pas",
  finpour: "FinPour",
  "tant que": "Tant que",
  fintantque: "FinTantQue",
  repeter: "Repeter",
  jusqua: "Jusqua",
  afficher: "Afficher",
  lire: "Lire",
  procedure: "Procedure",
  finprocedure: "FinProcedure",
  fonction: "Fonction",
  retourner: "Retourner",
  finfonction: "FinFonction",
  tableau: "Tableau",
};

/** Types de données primitifs du cours. */
export const TYPES: Record<string, string> = {
  entier: "Entier",
  reel: "Reel",
  chaine: "Chaine",
  caractere: "Caractere",
  booleen: "Booleen",
};

/** Littéraux booléens. */
export const BOOLEANS = new Set(["vrai", "faux"]);

/** Opérateurs logiques (mots). */
export const LOGIC = new Set(["et", "ou", "non"]);

/**
 * Mots-clés à deux mots : si on lit le premier, on tente d'assembler le second.
 * Clé = premier mot normalisé, valeur = liste des seconds mots possibles.
 */
export const TWO_WORD_STARTS: Record<string, string[]> = {
  tant: ["que"],
  sinon: ["si"],
};

/**
 * Opérateurs écrits sous forme de mots, tels qu'enseignés dans le cours.
 * Clé = forme normalisée du mot, valeur = symbole canonique équivalent.
 * « MOD » (modulo) ≡ « % » et « DIV » (division entière) ≡ « // ».
 * Le lexer les émet comme des tokens « operator » dont le `value` conserve
 * le texte d'origine (pour l'affichage) et le `normalized` porte le symbole,
 * afin qu'ils héritent automatiquement de la priorité de Multiplication.
 */
export const WORD_OPERATORS: Record<string, string> = {
  mod: "%",
  div: "//",
};

/** Opérateurs symboliques, du plus long au plus court (ordre = priorité de match). */
export const SYMBOL_OPERATORS = [
  "<=",
  ">=",
  "!=",
  "//",
  "<",
  ">",
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  ":",
  ",",
];

/** Flèches d'affectation acceptées : « ← » (présentation) et « <- » (clavier). */
export const ASSIGN_TOKENS = ["←", "<-"];

/**
 * Un identifiant entièrement en MAJUSCULES désigne une CONSTANTE : sa valeur,
 * fixée à la déclaration, ne peut plus être modifiée (convention du cours).
 * Ex. « TVA », « PI », « TAUX_MAX » sont des constantes ; « age », « i » non.
 */
export function isConstantName(name: string): boolean {
  return name === name.toUpperCase() && name !== name.toLowerCase();
}
