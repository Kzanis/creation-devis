---
# Roadmap produit — Assistant vocal de chantier & devis

## Vision produit

Creer un **assistant vocal de chantier** vendu en SaaS/white-label aux entreprises artisanales BTP, capable de :
- ecouter une description orale faite en conditions reelles (chantier, camion, fin de journee),
- capturer photos et videos du terrain,
- structurer automatiquement les informations chantier,
- preparer un pre-devis puis un devis,
- **sans jamais casser le rythme terrain** ni retirer la decision a l'artisan.

L'outil est concu comme un **assistant**, pas comme un logiciel decisionnaire.

### Modele commercial
- Produit SaaS vendu a des entreprises artisanales (platrerie, peinture, couverture, plomberie...)
- Chaque client = sa propre base de donnees Airtable (isolation totale des donnees)
- Frontend personnalisable aux couleurs de l'entreprise cliente (white-label)
- Distribution via LinkedIn (beta 5 entreprises) + Sabrina (commerciale terrain)

---

## Hypotheses d'usage validees

- Utilisation en environnement bruite (chantier, camion)
- Dictee vocale **naturelle**, comme a un collegue
- Pas de lecture de memo structure
- Mesures exprimees en **centimetres**, prises au laser (fiables)
- Pieces **numerotees** (chambre 1, chambre 2...) + pieces standards (cuisine, SDB...)
- L'outil **propose**, ne decide pas
- Validation humaine toujours requise
- **L'artisan a les mains sales et pas le temps** — l'UX doit etre brutalement simple

---

# MVP — *Capturer le terrain en 1 tap*

## Objectif MVP

> Valider que la capture terrain (audio + photo + video) peut etre fidelement transcrite, stockee et exploitee, avec un UX adapte au chantier.

Le MVP doit prouver l'usage reel et generer des retours de 5 entreprises beta-testers.

---

## Fonctionnalites incluses

### Dictee vocale
- **Dictee continue** : l'artisan dicte TOUT d'un coup ("Client Dupont, 24 rue des Tuiles, cuisine 350 par 280, depose carrelage, enduit...")
- Langage naturel, tolerance au bruit, aucun formalisme impose
- **Feedback immediat** : transcript live via Web Speech API du navigateur (approximatif), puis remplacement par le resultat Whisper (precis)
- Transcription fidele — aucune interpretation metier, aucune correction silencieuse

### Capture photo terrain
- Capture de photos depuis l'application (acces camera PWA)
- Photos liees a un **chantier** et a un **dossier**
- **Upload automatique dans Google Drive** (1 dossier Drive par client)
- Lien du dossier Drive stocke automatiquement dans Airtable
- Visualisation des photos prises dans l'interface avec indicateurs d'upload
- Pas de traitement IA sur les photos au MVP (stockage brut uniquement)

### Capture video terrain
- Capture video depuis l'application (acces camera PWA, MediaRecorder API)
- **Duree limitee : 60 secondes max** (pour eviter les fichiers enormes sur reseau terrain)
- Upload dans Google Drive au meme endroit que les photos
- Lien stocke dans Airtable (champ "Medias")
- Cas d'usage : filmer un probleme (fissure, humidite, etat d'un mur) plutot que l'expliquer a l'oral

### Transcriptions dans Google Docs
- **1 Google Doc par dossier** : toutes les dictees s'ajoutent au meme document
- Chaque transcription est horodatee dans le doc
- Lien du Google Doc stocke automatiquement dans Airtable (champ "Description / Releve")
- Creation automatique du doc et du dossier Drive si inexistants
- Mode degrade : sans dossier selectionne, la transcription fonctionne sans Google Docs

### Dossier par chantier
- Ecran principal = **dernier dossier ouvert** (pas de navigation pour revenir ou on etait)
- Creation rapide d'un nouveau dossier (nom client + adresse, dictes vocalement)
- Chaque dossier centralise : transcriptions (Google Docs), photos + videos (Google Drive), corrections
- **Integration Airtable native** : chaque dossier = un enregistrement avec liens Google automatiques
- Le client (entreprise) a acces directement a son Airtable pour voir/editer ses dossiers
- Tout passe par **n8n** : les cles Google et OpenAI restent sur le serveur, jamais cote client

### Relecture vocale par piece (fonction cle MVP)
- Commandes simples : "Relis la chambre 1", "Relis la cuisine"
- Relecture factuelle : ce que l'outil a compris, sans interpretation

### Corrections vocales simples
- Une correction = une phrase
- Exemples : "Non, la hauteur c'est 248", "Ajoute une couche"
- Pas de logique complexe

### Notification patron
- A chaque nouvelle dictee, le patron/la secretaire recoit une notification (email via n8n)
- Message : "Nouveau releve chantier [client] — [N] pieces dictees, en attente de validation"
- Le patron ouvre Airtable, valide, et c'est pret pour le devis

### Feedback qualite (beta)
- Bouton pouce haut / pouce bas sur chaque transcription
- Permet de collecter des donnees de qualite pour ameliorer le produit
- Stocke dans Airtable (table feedback)

---

## UX terrain — Principes non negociables

| Principe | Implementation |
|---|---|
| **1 tap pour enregistrer** | L'ecran d'accueil = un ENORME bouton micro. Pas de navigation avant de dicter. |
| **Dernier dossier en 1 tap** | Le dossier le plus recent est ouvert automatiquement. Switch rapide en haut. |
| **Mode gants** | Zones de tap XXL (min 64px), pas de gestes complexes, pas de double-tap |
| **Feedback immediat** | Transcript live (Web Speech API) pendant l'enregistrement, remplace par Whisper apres |
| **Pas de formulaires** | Tout est dicte — nom client, adresse, dimensions, observations |
| **Indicateurs clairs** | Enregistrement en cours (rouge), upload en cours (spinner), upload OK (check) |

---

## White-label & personnalisation

Chaque entreprise cliente recoit une instance personnalisee :
- **Couleurs** : primaire, secondaire, accent (CSS custom properties)
- **Logo** : affiche en haut de l'app
- **Nom de l'entreprise** : dans le titre et les documents generes
- **Metier** : champ configurable (platrerie, peinture, couverture...) — utilise par le prompt de structuration en V1

Configuration stockee dans un fichier JSON par client, injecte au deploiement.

---

## Mode demo (pour Sabrina)

- Donnees pre-chargees : 3 dossiers fictifs avec transcriptions, photos, statuts
- Dictee simulee : l'IA genere un exemple de transcription realiste
- Fonctionne sans vrai chantier — lien envoyable par email/WhatsApp
- Le prospect voit le produit en action en 30 secondes

---

## Hors MVP (exclus volontairement)

- Calculs automatiques avances
- Verification de coherence
- Tarifs / chiffrage
- Pre-devis / devis
- Conseils metier
- Lien avec plans
- Historique avance
- Memoire utilisateur
- Auth complexe (roles, permissions)

---

## Critere de succes MVP

> **"Je peux dicter, prendre des photos et videos, ecouter ce que l'outil a compris, corriger a la voix, et tout est range dans mon Airtable."**

### Metriques beta (5 entreprises)
- Taux de transcription correcte > 85% (feedback pouce haut)
- Temps moyen pour creer un dossier complet < 5 min
- Au moins 3/5 entreprises veulent continuer apres la beta

---

# V1 — *Structurer le chantier*

## Objectif V1
Transformer la parole validee en **donnees chantier structurees**, fiables et coherentes.

### Inclus
- Structuration IA (GPT-4o) des transcriptions brutes en donnees metier
- Calcul automatique des surfaces a partir des cotes
- Decoupage logique : piece → murs → surfaces
- Heritage de contexte ("pareil que l'autre mur")
- Marquage des donnees : confirme / a verifier
- Detection d'incoherences simples
- Correction vocale elargie
- Restitution enrichie (toujours en brouillon)
- **Prompt de structuration configurable par metier** (platrerie, peinture, couverture...)

### Exclus
- Tarifs
- Chiffrage
- Devis client
- Conseils metier
- Plan visuel

### Critere de succes V1
> "Je n'ai plus besoin de reprendre mes notes."

---

# V2 — *Pre-devis maitrise*

## Objectif V2
Accelerer le chiffrage **sans automatiser la decision**.

### Inclus
- Bibliotheque d'operations metier
- Port de prix parametrable (par artisan)
- Association operations <-> surfaces
- Calcul automatique des montants (transparent)
- Gestion des exclusions (plafonds, plinthes, zones specifiques)
- Resume financier par piece
- Generation d'un **pre-devis non transmissible**
- Validation humaine obligatoire

### Exclus
- Envoi client
- Facturation
- Conseils techniques
- Normes / DTU

### Critere de succes V2
> "Le devis est fait a 80 %, je le finalise en quelques minutes."

---

# V3 — *Assistant metier contextuel (opt-in)*

## Objectif V3
Aider l'artisan a **reflechir face a un probleme**, sans jamais s'imposer.

### Inclus
- Declenchement uniquement sur demande explicite
- Reformulation du probleme par l'IA
- Proposition de plusieurs options possibles
- Avantages / limites de chaque option
- Mention systematique : "a adapter selon le support et les normes"
- Aucune action automatique

### Critere de succes V3
> "Ca m'aide a reflechir, pas a decider a ma place."

---

# V4 — *Ecosysteme chantier complet*

## Objectif V4
Creer une continuite complete **chantier → devis → facture → memoire metier**.

### Inclus
- Historique des versions
- Memoire des habitudes artisan
- Reutilisation de chantiers types
- Generation devis client final
- Pre-facturation / facturation
- Tracabilite complete
- Multi-utilisateurs avance (roles, permissions, audit)

---

# Hors-perimetre volontaire (verrouille)

- Reconnaissance visuelle chantier (IA sur photos)
- IA decisionnaire
- Envoi de devis sans validation
- Outil "boite noire"
- Corrections silencieuses

---

## Principe directeur a respecter a chaque etape

> **L'outil assiste.
> L'artisan decide.**

---

# Securite & isolation des donnees

## Principes directeurs

- Chaque entreprise cliente = **base Airtable separee** (isolation totale des donnees)
- Le code (frontend + workflows) est partage — seules les donnees sont isolees
- Les cles API (Google, OpenAI) restent cote serveur (n8n), jamais cote client
- La securite ne doit jamais bloquer l'usage terrain

## MVP — Identification par client_id

### Inclus
- Chaque client a une URL unique (ex: app.com/dupont ou dupont.app.com)
- Le client_id dans l'URL determine : base Airtable, dossier Drive, couleurs, logo
- Token API statique par client (header X-API-Token), verifie par n8n
- Pas d'authentification utilisateur individuelle au MVP

### Exclus
- Gestion fine des roles
- Auth email/mot de passe
- Partage avance
- Audit detaille

## V1 — Travail en equipe
- Login simple (email + mot de passe ou magic link)
- Roles : Administrateur, Utilisateur
- Acces partage aux chantiers

## V2+ — Gouvernance avancee
- Droits par role sur validation et generation devis
- Tracabilite complete (qui a dicte, modifie, valide, quand)
- Journal d'audit

---

## Regle intangible

> **Plus l'action est engageante, plus le niveau de validation et de tracabilite est eleve.**
