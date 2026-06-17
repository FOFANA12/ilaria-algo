/**
 * Point d'entrée de l'application ilaria-algo.
 * Monte l'éditeur, branche la coloration + le linter, et pilote la console
 * d'exécution (Analyser / Exécuter / saisie interactive pour Lire).
 */

import { EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, autocompletion, completionKeymap } from "@codemirror/autocomplete";

import { ilariaAlgo } from "./editor/language";
import { algoTheme } from "./editor/theme";
import { algoLinter } from "./editor/linter";
import { algoCompletions } from "./editor/autocomplete";
import { formatSource } from "./editor/format";
import { analyze } from "./core/analyze";
import { parseProgram, ParseError } from "./core/astparser";
import { Interpreter, RuntimeError } from "./core/interpreter";
import { EXAMPLES } from "./examples";

// ---------- Références DOM ----------
const editorParent = document.getElementById("editor")!;
const statusEl = document.getElementById("status")!;
const exampleSelect = document.getElementById("examples") as HTMLSelectElement;
const consoleOut = document.getElementById("console-out")!;
const consoleIn = document.getElementById("console-in") as HTMLInputElement;
const btnNew = document.getElementById("btn-new") as HTMLButtonElement;
const btnFormat = document.getElementById("btn-format") as HTMLButtonElement;
const btnAnalyse = document.getElementById("btn-analyse") as HTMLButtonElement;
const btnRun = document.getElementById("btn-run") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;

const NEW_TEMPLATE = `Algorithme MonAlgorithme
    Variables
        // Declarez vos variables ici
    Debut
        Afficher "Bonjour !"
    Fin
`;

// ---------- Éditeur ----------
function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      lintGutter(),
      autocompletion({ override: [algoCompletions], activateOnTyping: true }),
      ilariaAlgo(),
      algoTheme,
      algoLinter,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) refreshStatus();
      }),
      keymap.of([
        {
          key: "Shift-Alt-f",
          run: (v) => {
            v.dispatch({
              changes: {
                from: 0,
                to: v.state.doc.length,
                insert: formatSource(v.state.doc.toString()),
              },
            });
            return true;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.lineWrapping,
    ],
  });
}

const view = new EditorView({
  state: createState(EXAMPLES[0].code),
  parent: editorParent,
});

// ---------- Bandeau d'état ----------
function refreshStatus(): void {
  const errors = analyze(view.state.doc.toString());
  const errCount = errors.filter((e) => e.severity === "error").length;
  if (errCount === 0) {
    statusEl.textContent = "✓ Aucune erreur détectée";
    statusEl.className = "status status--ok";
  } else {
    statusEl.textContent =
      errCount === 1 ? "1 erreur détectée" : `${errCount} erreurs détectées`;
    statusEl.className = "status status--error";
  }
}

// ---------- Console ----------
type LineKind = "output" | "input" | "error" | "info" | "ok";

function println(text: string, kind: LineKind = "output"): void {
  const div = document.createElement("div");
  div.className = "line-" + kind;
  div.textContent = text === "" ? " " : text;
  consoleOut.appendChild(div);
  consoleOut.scrollTop = consoleOut.scrollHeight;
}

function clearConsole(): void {
  consoleOut.innerHTML = "";
}

// Saisie interactive pour Lire : renvoie une promesse résolue à l'Entrée.
let pendingResolve: ((v: string) => void) | null = null;
let pendingReject: ((e: Error) => void) | null = null;

function requestInput(): Promise<string> {
  consoleIn.disabled = false;
  consoleIn.placeholder = "Entrez une valeur puis Entrée…";
  consoleIn.focus();
  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
}

consoleIn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && pendingResolve) {
    const value = consoleIn.value;
    consoleIn.value = "";
    consoleIn.disabled = true;
    consoleIn.placeholder = "La saisie (Lire) s'activera ici pendant l'exécution…";
    println("» " + value, "input");
    const resolve = pendingResolve;
    pendingResolve = null;
    pendingReject = null;
    resolve(value);
  }
});

// ---------- Actions ----------
let running = false;
let currentInterpreter: Interpreter | null = null;

function setRunning(state: boolean): void {
  running = state;
  btnRun.disabled = state;
  btnStop.disabled = !state;
  btnAnalyse.disabled = state;
  btnNew.disabled = state;
  btnFormat.disabled = state;
  exampleSelect.disabled = state;
}

function formatDoc(): void {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: formatSource(view.state.doc.toString()),
    },
  });
  view.focus();
}

function analyse(): void {
  clearConsole();
  const errors = analyze(view.state.doc.toString());
  const errs = errors.filter((e) => e.severity === "error");
  if (errs.length === 0) {
    println("✓ Analyse réussie : aucune erreur détectée.", "ok");
    return;
  }
  println(
    errs.length === 1 ? "1 erreur détectée :" : `${errs.length} erreurs détectées :`,
    "error"
  );
  for (const e of errs) {
    println(`  • Ligne ${e.line}, colonne ${e.col} — ${e.message}`, "error");
  }
}

async function run(): Promise<void> {
  if (running) return;
  clearConsole();
  const source = view.state.doc.toString();

  // 1) Vérification stricte (structure + variables déclarées) avant exécution.
  const blocking = analyze(source).filter((e) => e.severity === "error");
  if (blocking.length > 0) {
    println(
      blocking.length === 1
        ? "Impossible d'exécuter : 1 erreur à corriger."
        : `Impossible d'exécuter : ${blocking.length} erreurs à corriger.`,
      "error"
    );
    for (const e of blocking) {
      println(`  • Ligne ${e.line}, colonne ${e.col} — ${e.message}`, "error");
    }
    return;
  }

  // 2) Construction de l'arbre exécutable.
  let program;
  try {
    program = parseProgram(source);
  } catch (e) {
    if (e instanceof ParseError) {
      println(`Erreur de syntaxe — ligne ${e.line}, colonne ${e.col} :`, "error");
      println("  " + e.message, "error");
    } else {
      println("Erreur d'analyse : " + (e as Error).message, "error");
    }
    return;
  }

  // 3) Exécution.
  setRunning(true);
  println("▶ Exécution…", "info");
  const interpreter = new Interpreter({
    output: (t) => println(t, "output"),
    input: () => requestInput(),
  });
  currentInterpreter = interpreter;

  try {
    await interpreter.run(program);
    println("✓ Exécution terminée.", "ok");
  } catch (e) {
    if (e instanceof RuntimeError) {
      const where = e.line ? ` (ligne ${e.line})` : "";
      println(`Erreur d'exécution${where} : ${e.message}`, "error");
    } else if ((e as Error).message === "__STOP__") {
      println("■ Exécution arrêtée.", "info");
    } else {
      println("Erreur : " + (e as Error).message, "error");
    }
  } finally {
    setRunning(false);
    consoleIn.disabled = true;
    currentInterpreter = null;
  }
}

function stop(): void {
  // Interrompt les boucles de calcul (sans Lire)…
  currentInterpreter?.requestStop();
  // …et débloque une éventuelle saisie Lire en attente.
  if (pendingReject) {
    const reject = pendingReject;
    pendingResolve = null;
    pendingReject = null;
    consoleIn.disabled = true;
    reject(new Error("__STOP__"));
  }
}

// ---------- Liste d'exemples ----------
const NEW_OPTION = "__new__";
function fillExamples(): void {
  const blank = document.createElement("option");
  blank.value = NEW_OPTION;
  blank.textContent = "— Nouveau (vide) —";
  exampleSelect.appendChild(blank);
  for (const ex of EXAMPLES) {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.label;
    exampleSelect.appendChild(opt);
  }
}

function loadDoc(doc: string): void {
  view.setState(createState(doc));
  clearConsole();
  refreshStatus();
  view.focus();
}

// ---------- Branchements ----------
exampleSelect.addEventListener("change", () => {
  if (exampleSelect.value === NEW_OPTION) {
    loadDoc(NEW_TEMPLATE);
    return;
  }
  const ex = EXAMPLES.find((e) => e.id === exampleSelect.value);
  if (ex) loadDoc(ex.code);
});

btnNew.addEventListener("click", () => {
  loadDoc(NEW_TEMPLATE);
  exampleSelect.value = NEW_OPTION;
});
btnFormat.addEventListener("click", formatDoc);
btnAnalyse.addEventListener("click", analyse);
btnRun.addEventListener("click", run);
btnStop.addEventListener("click", stop);
btnClear.addEventListener("click", clearConsole);

// ---------- Démarrage ----------
fillExamples();
exampleSelect.value = EXAMPLES[0].id;
refreshStatus();
