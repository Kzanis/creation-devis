---
# 🧭 Roadmap produit — Assistant vocal de chantier & devis

## 🎯 Vision produit

Créer un **assistant vocal de chantier** destiné aux artisans, capable de :
- écouter une description orale faite en conditions réelles (chantier, camion, fin de journée),
- structurer automatiquement les informations chantier,
- préparer un pré-devis puis un devis,
- **sans jamais casser le rythme terrain** ni retirer la décision à l’artisan.

L’outil est conçu comme un **assistant**, pas comme un logiciel décisionnaire.

---

## 🧠 Hypothèses d’usage validées

- Utilisation en environnement bruité (chantier, camion)
- Dictée vocale **naturelle**, comme à un collègue
- Pas de lecture de mémo structuré
- Mesures exprimées en **centimètres**, prises au laser (fiables)
- Pièces **numérotées** (chambre 1, chambre 2…) + pièces standards (cuisine, SDB…)
- L’outil **propose**, ne décide pas
- Validation humaine toujours requise

---

# 🟢 MVP — *Parler → entendre → valider*

## Objectif MVP

> Valider que la dictée vocale terrain peut être **fidèlement comprise, restituée et validée à la voix**, par pièce.

Le MVP doit prouver l’usage réel, pas la performance technique.

---

## Fonctionnalités incluses

### 🎙️ Dictée vocale
- Dictée libre
- Langage naturel
- Tolérance au bruit
- Aucun formalisme imposé

### 📝 Transcription
- Transcription fidèle de ce qui est dit
- Aucune interprétation métier
- Aucune correction silencieuse

### 🧱 Structuration minimale
- Organisation par :
  - chantier
  - pièces (chambre 1, chambre 2, cuisine, SDB…)
- Les pièces sont la brique centrale

### 📐 Données dictables
- Dimensions (en centimètres)
- Opérations à réaliser (ex : dépose, grattage, enduit, peinture…)
- Observations / remarques (état des murs, contraintes, etc.)

### 📄 Restitution automatique
- Génération d’un document (Google Docs ou équivalent)
- Une section par pièce :
  - dimensions listées
  - opérations listées
  - observations visibles
- Statut global : **brouillon non validé**

### 🔊 Relecture vocale par pièce (fonction clé MVP)
- Commandes simples :
  - “Relis la chambre 1”
  - “Relis la cuisine”
- Relecture factuelle :
  - ce que l’outil a compris
  - sans interprétation

### ✍️ Corrections vocales simples
- Une correction = une phrase
- Exemples :
  - "Non, la hauteur c'est 248"
  - "Ajoute une couche"
- Pas de logique complexe

### 📸 Prise de photos terrain
- Capture de photos depuis l'application (acces camera PWA)
- Photos liees a un **chantier** et a un **dossier**
- **Upload automatique dans Google Drive** (1 dossier Drive par dossier chantier)
- Lien du dossier Drive stocke automatiquement dans Airtable (champ "Photo")
- Visualisation des photos prises dans l'interface avec indicateurs d'upload
- Pas de traitement IA sur les photos au MVP (stockage brut uniquement)

### 📄 Transcriptions dans Google Docs
- **1 Google Doc par dossier** : toutes les dictees s'ajoutent au meme document
- Chaque transcription est horodatee dans le doc
- Lien du Google Doc stocke automatiquement dans Airtable (champ "Description / Releve")
- Creation automatique du doc et du dossier Drive si inexistants
- Mode degrade : sans dossier selectionne, la transcription fonctionne sans Google Docs

### 📁 Dossier par chantier
- Ecran de **selection / creation de chantier** au lancement
- Chaque chantier = un dossier qui centralise :
  - les transcriptions vocales (Google Docs)
  - les photos (Google Drive)
  - les corrections
  - les futurs devis
- **Integration Airtable** : chaque dossier = un enregistrement avec liens Google automatiques
- L'artisan **choisit le dossier chantier** avant de commencer a travailler
- Liste des chantiers en cours avec acces rapide
- Tout passe par **n8n** : les cles Google restent sur le serveur, jamais cote client

---

## Hors MVP (exclus volontairement)

- Calculs automatiques avancés
- Vérification de cohérence
- Tarifs
- Pré-devis / devis
- Conseils métier
- Lien avec plans
- Historique
- Mémoire utilisateur

---

## Critère de succès MVP

> **“Je peux dicter, écouter ce que l’outil a compris, corriger à la voix et repartir avec un document exploitable.”**

---

# 🔵 V1 — *Structurer le chantier*

## Objectif V1
Transformer la parole validée en **données chantier structurées**, fiables et cohérentes.

### Inclus
- Calcul automatique des surfaces à partir des cotes
- Découpage logique :
  - pièce → murs → surfaces
- Héritage de contexte
  - ex : "pareil que l'autre mur"
- Marquage des données :
  - confirmé
  - à vérifier
- Détection d'incohérences simples
- Correction vocale élargie
- Restitution enrichie (toujours en brouillon)

### 🔗 Intégration CRM (Airtable ou équivalent)
- Synchronisation bidirectionnelle des dossiers chantier avec un CRM externe (Airtable recommandé)
- Chaque chantier créé dans l'app → automatiquement créé dans Airtable
- Les données structurées (pièces, dimensions, opérations) remontent dans Airtable
- Les photos prises sont référencées dans le CRM
- L'artisan peut gérer ses clients / chantiers depuis Airtable ou depuis l'app
- Workflow n8n dédié pour la synchronisation (n8n a un connecteur Airtable natif)

### Exclus
- Tarifs
- Chiffrage
- Devis client
- Conseils métier
- Plan visuel

### Critère de succès V1
> “Je n’ai plus besoin de reprendre mes notes.”

---

# 🟠 V2 — *Pré-devis maîtrisé*

## Objectif V2
Accélérer le chiffrage **sans automatiser la décision**.

### Inclus
- Bibliothèque d’opérations métier
- Port de prix paramétrable (par artisan)
- Association opérations ↔ surfaces
- Calcul automatique des montants (transparent)
- Gestion des exclusions :
  - plafonds
  - plinthes
  - zones spécifiques
- Résumé financier par pièce
- Génération d’un **pré-devis non transmissible**
- Validation humaine obligatoire

### Exclus
- Envoi client
- Facturation
- Conseils techniques
- Normes / DTU

### Critère de succès V2
> “Le devis est fait à 80 %, je le finalise en quelques minutes.”

---

# 🟣 V3 — *Assistant métier contextuel (opt-in)*

## Objectif V3
Aider l’artisan à **réfléchir face à un problème**, sans jamais s’imposer.

### Inclus
- Déclenchement uniquement sur demande explicite :
  - “Tu ferais comment ?”
  - “Je sais pas quoi faire là”
- Reformulation du problème par l’IA
- Proposition de plusieurs options possibles
- Avantages / limites de chaque option
- Mention systématique :
  - “à adapter selon le support et les normes”
- Aucune action automatique

### Exclus
- Instructions impératives
- Décisions techniques imposées
- Engagement de responsabilité

### Critère de succès V3
> “Ça m’aide à réfléchir, pas à décider à ma place.”

---

# 🔴 V4 — *Écosystème chantier complet*

## Objectif V4
Créer une continuité complète **chantier → devis → facture → mémoire métier**.

### Inclus
- Lien voix ↔ plan (pièces numérotées)
- Historique des versions
- Mémoire des habitudes artisan
- Réutilisation de chantiers types
- Génération devis client final
- Pré-facturation / facturation
- Traçabilité complète

---

# ⚫ Hors-périmètre volontaire (verrouillé)

- Multimétier dès le départ
- Reconnaissance visuelle chantier
- Lecture automatique complexe de plans
- IA décisionnaire
- Envoi de devis sans validation
- Outil “boîte noire”
- Corrections silencieuses

---

## 🧩 Principe directeur à respecter à chaque étape

> **L’outil assiste.  
> L’artisan décide.**

---

# 🔐 Sécurité, identification & multi-utilisateurs

## Principes directeurs

- L’application peut être utilisée par :
  - un artisan seul
  - une entreprise avec plusieurs collaborateurs
- Les données doivent être :
  - isolées par organisation
  - traçables
- La sécurité ne doit jamais bloquer l’usage terrain

---

## 🟢 MVP — Identification minimale

### Objectif
Identifier clairement **qui parle** et **à quelle organisation appartiennent les données**.

### Inclus
- Authentification simple :
  - email + mot de passe  
  ou  
  - lien magique
- Un utilisateur = une organisation par défaut
- Isolation stricte des données par organisation
- Chaque chantier / document est rattaché :
  - à un utilisateur
  - à une organisation

### Exclus
- Gestion fine des rôles
- Partage avancé
- Permissions personnalisées
- Audit détaillé

---

## 🔵 V1 — Travail en équipe

### Objectif
Permettre à plusieurs personnes de travailler sur les mêmes chantiers.

### Inclus
- Invitation d’utilisateurs dans une organisation
- Rôles simples :
  - Administrateur
  - Utilisateur
- Accès partagé aux chantiers
- Attribution des chantiers à un ou plusieurs utilisateurs

---

## 🟠 V2 — Responsabilité & validation

### Objectif
Sécuriser les étapes critiques (chiffrage, devis).

### Inclus
- Droits par rôle sur :
  - validation du pré-devis
  - génération du devis
- Historique des validations
- Traçabilité :
  - qui a dicté
  - qui a modifié
  - qui a validé
  - quand

---

## 🟣 V3 / 🔴 V4 — Gouvernance avancée (hors MVP)

- Permissions personnalisées
- Séparation des rôles métier (conducteur, dirigeant, etc.)
- Journal d’audit complet
- Archivage et conformité réglementaire
- Gestion multi-entreprises pour groupes

---

## Règle intangible

> **Plus l’action est engageante, plus le niveau de validation et de traçabilité est élevé.**
