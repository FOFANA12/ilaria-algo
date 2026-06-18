# Antisèche — ilaria-algo

Aide-mémoire de toute la syntaxe, avec un mini-exemple par notion.

## Squelette d'un programme

```
Algorithme MonAlgo
Variables
    age : Entier
Debut
    Afficher "Bonjour"
Fin
```

Ordre imposé : `Algorithme` → `Variables` → `Debut` → `Fin`.

## Variables, types, constantes

| Notion | Écriture | Exemple |
|---|---|---|
| Déclaration | `nom : Type` | `age : Entier` |
| Plusieurs noms | `a, b : Type` | `x, y : Reel` |
| Avec valeur | `nom : Type <- valeur` | `n : Entier <- 0` |
| Affectation | `nom <- valeur` | `age <- 18` |
| Constante (MAJUSCULES) | `NOM : Type <- valeur` | `PI : Reel <- 3.14159` |

Types : `Entier`, `Reel`, `Chaine`, `Caractere`, `Booleen`.
Affectation : `<-` (ou la flèche `←`). Une constante ne peut plus changer.

## Entrées / Sorties

```
Lire age                          // lit une valeur au clavier
Afficher "Vous avez " + age + " ans"   // assemblage avec +
```

`Afficher` prend **une seule** expression : on relie texte et variables avec `+`.

## Opérateurs

| Catégorie | Opérateurs |
|---|---|
| Arithmétique | `+`  `-`  `*`  `/` |
| Division entière | `DIV`  (ex. `17 DIV 5` → `3`) |
| Modulo (reste) | `MOD`  (ex. `17 MOD 5` → `2`) |
| Comparaison | `=`  `!=`  `<`  `>`  `<=`  `>=` |
| Logique | `ET`  `OU`  `NON` |
| Booléens | `vrai`  `faux` |

> Évitez `//` pour la division : c'est un **commentaire**. Utilisez `DIV`.
> Priorité : `*` `/` `DIV` `MOD` avant `+` `-`, puis comparaisons, puis `NON` `ET` `OU`.

## Conditions

```
Si age >= 18 Alors
    Afficher "Majeur"
Sinon Si age >= 13 Alors
    Afficher "Adolescent"
Sinon
    Afficher "Enfant"
FinSi
```

## Sélection (Selon)

```
Selon choix Faire
    Cas 1 :
        Afficher "Un"
    Cas 2, 3 :
        Afficher "Deux ou trois"
    Autre :
        Afficher "Autre"
FinSelon
```

## Boucles

```
Pour i <- 1 à 10 Faire        // Pas optionnel : Pour i <- 10 à 1 Pas -1 Faire
    Afficher i
FinPour

Tant que n > 0 Faire
    n <- n - 1
FinTantQue

Repeter
    Lire mdp
Jusqua mdp = "1234"
```

## Tableaux

```
Tableau notes[5] : Reel       // ou : notes[5] : Reel
notes[0] <- 12                // indices de 0 à taille-1
Tableau grille[3][3] : Entier // tableau 2D : grille[i][j]
```

## Sous-programmes

```
Fonction Carre(x : Reel) : Reel
    Retourner x * x
FinFonction

Procedure Saluer(nom : Chaine)
    Afficher "Bonjour " + nom
FinProcedure
```

Une **fonction** renvoie une valeur (`Retourner`) et s'utilise dans une expression ;
une **procédure** exécute des actions sans renvoyer de valeur.

> Placement : définissez vos fonctions/procédures **après le `Fin`**
> (`Algorithme` doit rester la toute première instruction). Elles restent
> appelables dans le corps, peu importe l'ordre.

## Commentaires

```
// commentaire sur une ligne
/* commentaire
   sur plusieurs lignes */
```

> Astuce : accents facultatifs (`Debut` = `Début`), et `Jusqua` s'écrit sans apostrophe.
