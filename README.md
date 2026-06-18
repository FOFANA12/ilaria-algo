# ilaria-algo

Éditeur web de **pseudo-code algorithmique** pour les apprenants d'ilaria Digital School.
Il respecte la syntaxe enseignée dans le cours « Algorithmique » : coloration
syntaxique et détection d'erreurs en français, en temps réel.

## Démarrer

```bash
npm install
npm run dev      # ouvre http://localhost:5173
```

Pour générer la version statique déployable (Netlify, Vercel, GitHub Pages…) :

```bash
npm run build    # produit le dossier dist/
npm run preview  # prévisualise le build
```

## Fonctionnalités

**Coloration syntaxique** aux couleurs ilaria (mots-clés, types, chaînes,
nombres, opérateurs, commentaires).

**Détection d'erreurs** soulignées sous le code, avec message au survol :
- bloc non fermé (`FinSi`, `FinPour`, `FinTantQue`, `FinSelon`, `Fin`…) ;
- mot-clé obligatoire manquant (`Alors` après `Si`, `Faire` après `Pour`…) ;
- fermeture qui ne correspond pas au bloc ouvert ;
- `=` utilisé à la place de `<-` dans une affectation ;
- parenthèses / crochets non équilibrés ; chaîne / commentaire non fermé.

**Vérifications strictes de structure** :
- squelette obligatoire `Algorithme <nom>` · `Variables` · `Debut` · `Fin` ;
- ordre imposé `Algorithme → Variables → Debut → Fin` ;
- toute variable utilisée doit être déclarée dans `Variables`
  (la variable de boucle `Pour` est implicitement déclarée).

**Exécution** (interpréteur intégré) :
- bouton `▶ Exécuter` : lance l'algorithme, sorties dans la console ;
- saisie interactive pour `Lire` ; bouton `■ Arrêter` ;
- gère variables, conditions, `Selon`, boucles, tableaux 1D/2D,
  procédures et fonctions, tous les opérateurs, garde-fou anti-boucle-infinie.

**Aides à l'écriture** :
- auto-complétion (mots-clés, types, variables, sous-programmes) ;
- squelettes de structures (`Si … FinSi`, `Pour … FinPour`, etc.) ;
- formatage automatique de l'indentation (bouton `⤷ Formater` ou `Maj+Alt+F`).

**Exemples du cours** préchargés et bouton `＋ Nouveau`.

## Architecture

```
src/
  core/        cœur réutilisable (indépendant de l'interface)
    tokens.ts       vocabulaire du langage (mots-clés, types, opérateurs)
    lexer.ts        texte source -> tokens
    parser.ts       tokens -> erreurs structurelles + règles strictes
    ast.ts          types de l'arbre syntaxique
    astparser.ts    tokens -> arbre exécutable
    analyze.ts      analyse complète (structure + variables déclarées)
    interpreter.ts  exécution de l'arbre (Afficher / Lire / boucles / …)
    errors.ts       modèle d'erreur (message + position)
  editor/      intégration CodeMirror
    language.ts      coloration syntaxique
    linter.ts        branche les erreurs de l'analyse
    autocomplete.ts  auto-complétion + squelettes
    format.ts        formatage automatique de l'indentation
    theme.ts         thème visuel ilaria
  examples/    algorithmes d'exemple du cours
  main.ts      assemblage de l'application
```

Le dossier `core/` ne dépend pas de l'éditeur : il pourrait être réutilisé tel
quel pour une extension VS Code ou des tests automatisés.

## Syntaxe reconnue

La convention recommandée écrit les mots-clés **sans caractères spéciaux**
(ni accent, ni apostrophe). Les formes accentuées restent acceptées
(voir « Accents et apostrophe » plus bas).

| Catégorie | Éléments |
|---|---|
| Programme | `Algorithme`, `Variables`, `Debut`, `Fin` |
| Conditions | `Si … Alors`, `Sinon Si … Alors`, `Sinon`, `FinSi` |
| Sélection | `Selon … Faire`, `Cas`, `Autre`, `FinSelon` |
| Boucles | `Pour … <- … a … Faire` (`Pas`), `FinPour`, `Tant que … Faire`, `FinTantQue`, `Repeter … Jusqua` |
| Entrées/Sorties | `Afficher`, `Lire` |
| Sous-programmes | `Procedure … FinProcedure`, `Fonction … : type … Retourner … FinFonction` |
| Tableaux | `Tableau nom[n] : type`, `nom[i]`, `grille[i][j]` |
| Types | `Entier`, `Reel`, `Chaine`, `Caractere`, `Booleen` |
| Littéraux | `vrai`, `faux`, `"texte"`, nombres |
| Opérateurs | `+ - * /`, `MOD` (≡ `%`), `DIV` (≡ `//`), `= != < > <= >=`, `ET OU NON`, `<-` |
| Commentaires | `// …`, `/* … */` |

> Astuce : l'affectation s'écrit `←` (comme dans le cours) **ou** `<-` (plus
> facile à taper) — les deux sont acceptés et équivalents.
>
> Constantes : une variable dont le nom est **entièrement en MAJUSCULES**
> (ex. `TVA : Reel ← 0.2`) est verrouillée : toute modification ultérieure est
> refusée.
>
> Division entière et modulo : on enseigne les mots **`DIV`** et **`MOD`**
> (ex. `17 DIV 5` → `3`, `17 MOD 5` → `2`). Les symboles `//` et `%` existent,
> mais attention : `//` démarre un **commentaire**, donc pour la division
> entière préférez toujours `DIV`.

## Bibliothèque math

Le langage ne fournit aucune fonction mathématique intégrée. Une petite
bibliothèque réutilisable (racine carrée, puissance, PGCD, factorielle…) ainsi
que les patrons « somme / moyenne sur un `Tableau` » sont fournis et documentés :

- **Mode d'emploi et référence :** [`BIBLIOTHEQUE_MATH.md`](BIBLIOTHEQUE_MATH.md)
- **Fichier à copier :** [`bibliotheque_math.algo`](bibliotheque_math.algo)

## Accents et apostrophe

Pour ne pas bloquer les apprenants sur des détails de saisie, l'éditeur
applique deux règles de tolérance. **La forme sans caractères spéciaux est la
convention retenue pour le cours** ; les autres formes ne servent qu'à éviter
qu'une faute de frappe ou un copier-coller ne casse l'analyse.

**1. Accents — facultatifs.** Les mots-clés et types s'écrivent indifféremment
avec ou sans accent. La forme **sans accent est la référence** ; la forme
accentuée est simplement acceptée.

| Référence (sans accent) | Aussi accepté |
|---|---|
| `Debut` | `Début` |
| `Repeter` | `Répéter` |
| `Procedure` / `FinProcedure` | `Procédure` / `FinProcédure` |
| `Reel`, `Chaine`, `Caractere`, `Booleen` | `Réel`, `Chaîne`, `Caractère`, `Booléen` |
| `Pour i <- 1 a 10` | `Pour i <- 1 à 10` |

Le `a` (sans accent) n'est interprété comme mot-clé qu'**entre les deux bornes
d'un `Pour`** : ailleurs, `a` reste un nom de variable parfaitement valide.

**2. Apostrophe — supprimée.** Le mot-clé de fin de boucle `Répéter` s'écrit
**`Jusqua`** (sans apostrophe). C'est la forme à enseigner : elle évite le
piège classique de l'apostrophe typographique `’` (insérée automatiquement par
Word, les éditeurs ou un copier-coller depuis les slides), invisible à l'œil
mais distincte de l'apostrophe droite `'`. Les écritures `Jusqu'à` et `Jusqu’à`
restent acceptées pour ne pas casser les anciens supports.

```
Répéter
    Lire motDePasse
Jusqua motDePasse = "1234"
```
