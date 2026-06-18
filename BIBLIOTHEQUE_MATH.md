# Bibliothèque math — ilaria-algo

Comme le langage ne fournit **aucune fonction mathématique intégrée**
(`sqrt`, `abs`, `puissance`…), ce dépôt propose une petite bibliothèque
écrite entièrement en pseudo-code, prête à copier dans vos algorithmes.

Trois façons d'obtenir le code des fonctions :

- **Télécharger le fichier :** [`bibliotheque_math.algo`](bibliotheque_math.algo)
  (dans l'éditeur web, ce lien télécharge le `.algo` pour l'ouvrir et copier son
  contenu).
- **Charger dans l'éditeur :** ouvrez la liste **« Exemple »** et choisissez
  **📚 Bibliothèque math** : toutes les fonctions s'affichent, prêtes à lire et
  à copier.
- **Sur le dépôt :** consultez directement le fichier
  [`bibliotheque_math.algo`](bibliotheque_math.algo).

## Comment l'utiliser

Une fonction n'est utilisable que si sa définition se trouve **dans le même
fichier**. Placez-la **après le `Fin`** de votre algorithme : l'éditeur exige
que `Algorithme` soit la **toute première instruction**, donc une fonction
placée *avant* `Algorithme` serait refusée. L'ordre des appels n'a pas
d'importance : une fonction définie après `Fin` reste utilisable dans le corps.

```
// 1) L'algorithme principal d'abord (Algorithme doit etre en premier)
Algorithme ExempleRacine
Variables
    n : Reel
Debut
    Afficher "Entrez un nombre :"
    Lire n
    Afficher "Sa racine carree est : " + RacineCarree(n)
Fin

// 2) …puis la (ou les) fonction(s) utile(s), APRES le Fin
Fonction RacineCarree(x : Reel) : Reel
    r : Reel
    i : Entier
    Si x <= 0 Alors
        Retourner 0
    FinSi
    r <- x
    Pour i <- 1 à 50 Faire
        r <- (r + x / r) / 2
    FinPour
    Retourner r
FinFonction
```

> Rappel : division entière = `DIV`, modulo = `MOD` (le symbole `//` est
> interprété comme un commentaire, et `%` reste possible mais on enseigne `MOD`).

## Fonctions disponibles

| Fonction | Signature | Rôle | Exemple |
|---|---|---|---|
| Valeur absolue | `ValeurAbsolue(x : Reel) : Reel` | \|x\| | `ValeurAbsolue(-7.5)` → `7.5` |
| Racine carrée | `RacineCarree(x : Reel) : Reel` | √x (méthode de Héron) | `RacineCarree(144)` → `12` |
| Puissance | `Puissance(base : Reel, exposant : Entier) : Reel` | base^exposant (± entier) | `Puissance(2, 10)` → `1024` |
| Minimum | `Min(a : Reel, b : Reel) : Reel` | le plus petit | `Min(3, 8)` → `3` |
| Maximum | `Max(a : Reel, b : Reel) : Reel` | le plus grand | `Max(3, 8)` → `8` |
| Partie entière | `PartieEntiere(x : Reel) : Entier` | plancher (floor) | `PartieEntiere(-2.3)` → `-3` |
| Arrondi | `Arrondi(x : Reel) : Entier` | entier le plus proche | `Arrondi(2.6)` → `3` |
| Parité | `EstPair(n : Entier) : Booleen` | vrai si pair | `EstPair(7)` → `faux` |
| Primalité | `EstPremier(n : Entier) : Booleen` | vrai si premier | `EstPremier(13)` → `vrai` |
| Factorielle | `Factorielle(n : Entier) : Entier` | n! | `Factorielle(6)` → `720` |
| PGCD | `PGCD(a : Entier, b : Entier) : Entier` | Euclide | `PGCD(48, 36)` → `12` |
| PPCM | `PPCM(a : Entier, b : Entier) : Entier` | plus petit commun multiple | `PPCM(4, 6)` → `12` |

## Somme et moyenne sur un `Tableau`

⚠️ **Ce ne sont pas des fonctions, mais des patrons de code à recopier.**
Dans ce langage, on **ne peut pas passer un `Tableau` en paramètre** d'une
fonction (seuls les types `Entier`, `Reel`, `Chaine`, `Caractere`, `Booleen`
sont acceptés), et une fonction ne voit pas les variables globales. On calcule
donc la somme et la moyenne **directement dans le programme principal**, avec
une boucle `Pour`.

### Patron « Somme »

```
somme <- 0
Pour i <- 0 à taille - 1 Faire
    somme <- somme + notes[i]
FinPour
```

### Patron « Moyenne »

```
somme <- 0
Pour i <- 0 à taille - 1 Faire
    somme <- somme + notes[i]
FinPour
moyenne <- somme / taille
```

> Les indices d'un tableau vont de `0` à `taille - 1`. Comme il n'existe pas de
> fonction donnant la longueur d'un tableau, gardez la taille dans une variable
> (ici `taille`) que vous fixez vous-même.

### Exemple complet (exécutable)

```
Algorithme StatsTableau
Variables
    notes[5] : Reel
    taille, i : Entier
    somme, moyenne : Reel
Debut
    taille <- 5
    notes[0] <- 12
    notes[1] <- 15
    notes[2] <- 8
    notes[3] <- 17
    notes[4] <- 10

    somme <- 0
    Pour i <- 0 à taille - 1 Faire
        somme <- somme + notes[i]
    FinPour
    moyenne <- somme / taille

    Afficher "Somme   = " + somme       // 62
    Afficher "Moyenne = " + moyenne     // 12.4
Fin
```
