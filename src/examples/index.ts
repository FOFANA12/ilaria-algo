/**
 * Scaffolds (squelettes) prêts à l'emploi, un par structure du cours.
 * Chacun est un programme minimal, valide et exécutable, à compléter ou
 * adapter. Convention : sans caractères spéciaux (Debut, Repeter, Jusqua,
 * « Pour i <- 1 a 10 »), concaténation avec « + ».
 */

export interface Example {
  id: string;
  label: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "base",
    label: "① Squelette de base",
    code: `Algorithme MonAlgorithme
    Variables
        message : Chaine <- "Bonjour"
    Debut
        // Vos instructions ici
        Afficher message
    Fin
`,
  },
  {
    id: "condition",
    label: "② Condition (Si)",
    code: `Algorithme Condition
    Variables
        age : Entier <- 18
    Debut
        Si age >= 18 Alors
            Afficher "Majeur"
        Sinon
            Afficher "Mineur"
        FinSi
    Fin
`,
  },
  {
    id: "selon",
    label: "③ Selon (au choix)",
    code: `Algorithme AuChoix
    Variables
        choix : Entier <- 1
    Debut
        Selon choix Faire
            Cas 1 : Afficher "Un"
            Cas 2 : Afficher "Deux"
            Autre : Afficher "Autre"
        FinSelon
    Fin
`,
  },
  {
    id: "pour",
    label: "④ Boucle Pour",
    code: `Algorithme BouclePour
    Variables
        i : Entier
    Debut
        Pour i <- 1 a 5 Faire
            Afficher "Tour numero " + i
        FinPour
    Fin
`,
  },
  {
    id: "tantque",
    label: "⑤ Boucle Tant que",
    code: `Algorithme BoucleTantQue
    Variables
        i : Entier <- 1
    Debut
        Tant que i <= 5 Faire
            Afficher i
            i <- i + 1
        FinTantQue
    Fin
`,
  },
  {
    id: "repeter",
    label: "⑥ Boucle Repeter … Jusqua",
    code: `Algorithme BoucleRepeter
    Variables
        mdp : Chaine
    Debut
        Repeter
            Afficher "Mot de passe ?"
            Lire mdp
        Jusqua mdp = "1234"
        Afficher "Acces autorise"
    Fin
`,
  },
  {
    id: "tableau",
    label: "⑦ Tableau",
    code: `Algorithme ListeNotes
    Variables
        Tableau notes[5] <- [10, 15, 13, 20, 15]
        i : Entier
    Debut
        Pour i <- 0 a 4 Faire
            Afficher notes[i]
        FinPour
    Fin
`,
  },
  {
    id: "procedure",
    label: "⑧ Procedure",
    code: `Algorithme UtiliserProcedure
    Variables
        prenom : Chaine <- "Jean"
    Debut
        // Appel de la procedure
        Saluer(prenom)
    Fin

// Definition de la procedure (apres le Fin)
Procedure Saluer(nom : Chaine)
    Afficher "Bonjour " + nom
FinProcedure
`,
  },
  {
    id: "fonction",
    label: "⑨ Fonction",
    code: `Algorithme UtiliserFonction
    Variables
        nombre : Entier <- 5
    Debut
        // Appel de la fonction (renvoie une valeur)
        Afficher Carre(nombre)
    Fin

// Definition de la fonction (apres le Fin)
Fonction Carre(x : Entier) : Entier
    Retourner x * x
FinFonction
`,
  },
  {
    id: "tri-insertion",
    label: "⑩ Tri par insertion",
    code: `Algorithme TriInsertion
    Variables
        Tableau t[6] <- [5, 2, 8, 1, 9, 3]
        i : Entier
        j : Entier
        cle : Entier
    Debut
        Pour i <- 1 a 5 Faire
            cle <- t[i]
            j <- i - 1
            // On décale vers la droite les éléments plus grands que la cle
            Tant que j >= 0 ET t[j] > cle Faire
                t[j + 1] <- t[j]
                j <- j - 1
            FinTantQue
            t[j + 1] <- cle
        FinPour
        // Affichage du tableau trie
        Pour i <- 0 a 5 Faire
            Afficher t[i]
        FinPour
    Fin
`,
  },
  {
    id: "factorielle",
    label: "⑪ Factorielle (récursive)",
    code: `Algorithme Factorielle
    Variables
        n : Entier <- 5
        r : Entier
    Debut
        r <- Fact(n)
        Afficher "Factorielle de " + n + " = " + r
    Fin

// Fonction recursive : Fact(n) = n * Fact(n - 1)
Fonction Fact(n : Entier) : Entier
    Si n <= 1 Alors
        Retourner 1
    FinSi
    Retourner n * Fact(n - 1)
FinFonction
`,
  },
  {
    id: "tri-bulles",
    label: "⑫ Tri à bulles",
    code: `Algorithme TriBulles
    Variables
        Tableau t[5] <- [5, 2, 8, 1, 9]
        i : Entier
        j : Entier
        temp : Entier
    Debut
        Pour i <- 0 a 3 Faire
            Pour j <- 0 a 3 - i Faire
                Si t[j] > t[j + 1] Alors
                    temp <- t[j]
                    t[j] <- t[j + 1]
                    t[j + 1] <- temp
                FinSi
            FinPour
        FinPour
        Pour i <- 0 a 4 Faire
            Afficher t[i]
        FinPour
    Fin
`,
  },
  {
    id: "tri-selection",
    label: "⑬ Tri par sélection",
    code: `Algorithme TriSelection
    Variables
        Tableau t[5] <- [5, 2, 8, 1, 9]
        i : Entier
        j : Entier
        min : Entier
        temp : Entier
    Debut
        Pour i <- 0 a 3 Faire
            // Indice du plus petit element restant
            min <- i
            Pour j <- i + 1 a 4 Faire
                Si t[j] < t[min] Alors
                    min <- j
                FinSi
            FinPour
            // Echange avec la position i
            temp <- t[i]
            t[i] <- t[min]
            t[min] <- temp
        FinPour
        Pour i <- 0 a 4 Faire
            Afficher t[i]
        FinPour
    Fin
`,
  },
  {
    id: "min-tableau",
    label: "⑭ Recherche du minimum",
    code: `Algorithme MinTableau
    Variables
        Tableau t[5] <- [5, 2, 8, 1, 9]
        i : Entier
        min : Entier
    Debut
        min <- t[0]
        Pour i <- 1 a 4 Faire
            Si t[i] < min Alors
                min <- t[i]
            FinSi
        FinPour
        Afficher "Min = " + min
    Fin
`,
  },
];
