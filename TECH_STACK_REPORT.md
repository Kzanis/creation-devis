# Tech Stack — Assistant vocal de chantier

## Rapport de comparaison & recommandation

*Mis à jour pour intégrer n8n comme couche orchestration backend.*

---

## 1. Contraintes techniques extraites du PRD

| # | Contrainte | Priorité | Ce qu'elle contraint |
|---|---|---|---|
| 1 | STT fiable en français, en milieu bruité | Critique | Moteur STT — choix n°1 |
| 2 | Usage mobile (chantier, camion) | Critique | Frontend mobile-first |
| 3 | Relecture vocale par pièce (TTS) | Critique | Moteur TTS |
| 4 | Auth email+mdp **ou** lien magique | Haute | Système d'authentification |
| 5 | Isolation stricte des données par organisation | Haute | Architecture multi-tenant |
| 6 | Génération de document par pièce | Haute | Couche génération document |
| 7 | Données relationnelles : org → chantier → pièce → ops | Moyenne | Modèle de données / BDD |
| 8 | Structuration par IA à partir de V1 | Moyenne | LLM + structured output |
| 9 | Progression MVP → V4 sans rewriting | Moyenne | Choix architecturaux |
| 10 | Coût raisonnable à l'amorçage | Basse | Free tiers, pricing |

**Observation critique sur iOS** :
Safari iOS ne supporte pas l'API `SpeechRecognition`. Le microphone via `getUserMedia()` fonctionne (Safari 16.4+, HTTPS),
mais la transcription **doit** être faite server-side via une API externe.
Le Web Speech API natif du navigateur est donc **éliminé**.

---

## 2. Analyse par couche technologique

### 2.1 Speech-to-Text — Couche critique

C'est le choix qui fait ou casse le produit. Un STT qui échoue en bruit = produit qui échoue.

| Critère | OpenAI Whisper | Google Cloud STT | Deepgram Nova | AWS Transcribe |
|---|---|---|---|---|
| Qualité français | 5/5 | 5/5 | 4/5 | 3/5 |
| Tolérance au bruit | 5/5 | 4/5 | 4/5 | 3/5 |
| Streaming temps réel | Non (batch) | Oui | Oui | Oui |
| Latence par chunk | ~2s | ~500ms | ~300ms | ~800ms |
| Prix / minute | $0.006 | $0.004 | ~$0.002 | $0.014 |
| Free tier | Non | 60 min/mois | 100h/mois | 60 min/mois |
| Node n8n natif | Non → HTTP Request | Non → HTTP Request | Non → HTTP Request | Oui (AWS Transcribe) |

**Analyse** :
- **Whisper** domine sur la qualité brute et la robustesse au bruit pour du français.
  Le manque de streaming est un compromis acceptable (voir section 5).
- **Google Cloud STT** est le meilleur si on veut du streaming (mots en temps réel).
- Aucun des deux n'a de node n8n natif pour l'audio — tous deux passent par HTTP Request.
  C'est un niveau de complexité identique dans n8n.

---

### 2.2 Text-to-Speech

| Critère | OpenAI TTS | Google Cloud TTS | ElevenLabs |
|---|---|---|---|
| Naturalité (français) | 4/5 | 4/5 | 5/5 |
| Latence génération | ~500ms | ~400ms | ~800ms |
| Prix / 1M caractères | $15 | $4 | $300 |
| Node n8n natif | Non → HTTP Request | Non → HTTP Request | Non → HTTP Request |

**Analyse** : OpenAI TTS et Google Cloud TTS sont suffisants. Aucun n'a de node n8n natif —
tous deux se font via HTTP Request. OpenAI reste cohérent avec Whisper (même clé API).

---

### 2.3 Frontend / Plateforme mobile

Avec n8n comme backend, le frontend devient **UI uniquement** : pas de logique serveur, pas d'API routes.
Il fait deux choses : appeler les webhooks n8n (pour les traitements) et lire Supabase directement (pour l'affichage).

| Critère | Next.js (PWA) | React Native (Expo) | Flutter |
|---|---|---|---|
| Vitesse dev MVP | 5/5 | 3.5/5 | 3/5 |
| Expérience mobile | 3/5 | 5/5 | 5/5 |
| Accès microphone iOS | Oui (HTTPS) | Natif | Natif |
| App Store requis | Non | Oui (V1+) | Oui (V1+) |
| Appel webhooks n8n | Fetch standard | Fetch standard | HTTP package |
| SDK Supabase disponible | Oui | Oui | Limité |

**Analyse** : Next.js PWA reste le meilleur choix pour un MVP rapide.
Le rôle du frontend a simplifié : plus besoin d'API routes puisque n8n gère l'orchestration.

---

### 2.4 n8n — Couche orchestration

C'est la couche qui remplace le backend custom. Voici ce qu'on a vérifié concrètement sur les nodes disponibles :

| Besoin du projet | Node disponible | Limitation réelle |
|---|---|---|
| Recevoir un fichier audio | `Webhook` + option Binary Property | Max 16 MB — largement suffisant |
| Envoyer audio à Whisper | `HTTP Request` (multipart-form-data) | Pas de node Whisper natif. Fonctionne via HTTP Request avec binary |
| Appeler GPT-4o | `OpenAI` node (ressource Chat) | Natif. Bon pour la structuration V1+ |
| Générer du TTS | `HTTP Request` | Pas de node TTS natif. Retourne du binaire audio |
| Sauvegarder en Supabase | `Supabase` node | CRUD uniquement : create, get, get all, update, delete. Pas de SQL raw ni de JOINs |
| Lire des données Supabase | `Supabase` node (Get all rows) | Filtres simples par colonne. Pour des requêtes complexes → HTTP Request vers l'API REST Supabase |
| Retourner du texte au frontend | `Respond to Webhook` | Oui, synchrone |
| Retourner du fichier audio au frontend | `Respond to Webhook` (First Entry Binary) | Oui, retourne du binaire |
| Convertir binary ↔ JSON | `Convert to/from binary data` | Oui, utile pour manipuler l'audio dans le workflow |

**Ce que n8n fait bien pour ce projet :**
- Zéro code backend — les workflows sont visuels et modifiables sans déploiement.
- Débogage visuel : on voit exactement où dans le pipeline quelque chose a échoué.
- V1+ : les flows complexes (structuration, calcul prix, génération pré-devis) sont naturels en n8n.
- Ajout d'intégrations futures (Google Docs, notifications) sans toucher au code.

**Ce que n8n ne fait pas bien pour ce projet :**
- Pas de node Whisper ni TTS natif. Il faut configurer des HTTP Request avec du binaire — plus de configuration qu'un simple appel API en code.
- Le node Supabase est limité à du CRUD. Les requêtes avec filtres multiples ou JOINs nécessitent des HTTP Request vers l'API REST Supabase.
- Chaque noeud du workflow ajoute ~100–200ms de latence. Le flow complet dictation (webhook → Whisper → Supabase → réponse) prend ~3s au total.
- Une instance n8n à déployer et maintenir en plus du frontend.

---

### 2.5 Base de données

Le modèle de données est **relationnel** : organisation → chantier → pièce → dimensions / opérations / observations.
Puis en V2 : bibliothèque d'opérations, prix, calculs.

| Critère | Supabase | Firebase (Firestore) |
|---|---|---|
| Type de données | PostgreSQL (relationnel) | NoSQL (document) |
| Données relationnelles | Natif | Maladroit |
| Multi-tenant (isolation org) | Row Level Security | Règles de sécurité |
| Node n8n | Oui (CRUD) | Oui (Firestore) |
| SDK frontend disponible | Oui (supabase-js) | Oui (firebase) |
| Auth intégrée | Oui (magic link + email) | Oui (magic link + email) |
| Free tier | Très bon | Très bon |
| Vendor lock-in | Faible (PostgreSQL standard) | Élevé (Firestore propriétaire) |

**Analyse** : Supabase est le choix dominant. PostgreSQL pour les données relationnelles,
Row Level Security pour l'isolation par organisation, et l'auth magic link inclus.
Le node n8n Supabase est limité à du CRUD mais c'est suffisant pour le MVP.

---

### 2.6 IA / LLM — Structuration et assistant

Utilisé à partir de V1 pour extraire des données structurées depuis les transcriptions.
Puis en V3 pour l'assistant métier.

| Critère | OpenAI GPT-4o | Anthropic Claude | Google Gemini |
|---|---|---|---|
| Français | 5/5 | 5/5 | 4/5 |
| Structured output (JSON) | JSON mode | Tool use | JSON mode |
| Prix input / 1M tokens | $2.50 | $3.00 | $1.25 |
| Prix output / 1M tokens | $10.00 | $15.00 | $5.00 |
| Node n8n natif | Oui (OpenAI Chat) | Oui (Anthropic) | Oui (Gemini) |
| Cohérence avec Whisper/TTS | Même fournisseur | Non | Non |

**Analyse** : GPT-4o avec le node OpenAI natif de n8n est le choix le plus simple.
C'est le seul moteur qui a à la fois un node n8n natif **et** la cohérence avec Whisper + TTS
(même clé API, même fournisseur). Le prix pour le volume attendu est négligeable.

---

### 2.7 Génération de documents

| Option | Complexité | Format | Où ça se passe |
|---|---|---|---|
| HTML bien formaté + print PDF | Très basse | HTML / PDF via navigateur | Frontend (Next.js) |
| PDF via react-pdf / jsPDF | Basse | PDF | Frontend |
| Google Docs API | Haute (OAuth) | Google Doc | n8n workflow (V1+) |

**Analyse** : Pour le MVP, un rendu HTML structuré par pièce exportable en PDF via le navigateur.
Simple, rapide, pas de dépendance externe. Google Docs API peut être ajouté comme workflow n8n en V1+.

---

### 2.8 Déploiement

Deux services à déployer : le frontend et l'instance n8n.

| Service | Plateforme recommandée | Coût |
|---|---|---|
| Frontend (Next.js) | Vercel | Free tier |
| n8n | Railway (Docker) | ~$5–10/mois |
| Supabase | Supabase Cloud | Free tier |

---

## 3. Architecture recommandée

### 3.1 Vue globale

```
┌─────────────────────────────────────────────────┐
│  📱  Next.js 15  —  PWA mobile                  │
│      UI uniquement                              │
│      Auth + lecture données : Supabase SDK      │
│      Traitements : appels webhooks vers n8n     │
└──────────┬───────────────────┬─────────────────┘
           │  POST webhooks    │  Reads (direct SDK)
           ▼                   ▼
┌─────────────────┐   ┌─────────────────────────┐
│  🔄  n8n        │   │  🗄️  Supabase           │
│  (Railway)      │   │  Auth (magic link)      │
│                 │   │  PostgreSQL + RLS       │
│  Workflow 1 ────┼──▶│                         │
│  Dictation      │   └─────────────────────────┘
│                 │
│  Workflow 2     │
│  Relecture TTS  │
│                 │
│  Workflow 3     │
│  Correction     │
│                 │
│  Workflow 4+    │
│  Structuration  │
└────────┬────────┘
         │  HTTP calls
         ▼
┌─────────────────────────────────┐
│  🤖  OpenAI APIs                │
│  • Whisper  (via HTTP Request)  │
│  • TTS      (via HTTP Request)  │
│  • GPT-4o   (via OpenAI node)   │
└─────────────────────────────────┘
```

**Principe de séparation :**
- **Reads** (lister les chantiers, les pièces, les transcriptions) : le frontend lit Supabase directement via le SDK. Rapide, pas de latence n8n.
- **Writes / Traitements** (envoyer de l'audio, corriger, structurer) : le frontend appelle un webhook n8n. n8n orchestre les appels API et la persistance.

---

### 3.2 Les workflows n8n en détail

#### Workflow 1 : Dictation (MVP — couche critique)

```
Webhook (POST)
  ├─ Binary Property activé → reçoit le fichier audio
  ├─ Body JSON → reçoit { piece_id, chantier_id, user_id }
  └─ Respond : via 'Respond to Webhook' node

    ↓

HTTP Request → api.openai.com/v1/audio/transcriptions
  ├─ Method : POST
  ├─ Content-Type : multipart/form-data
  ├─ Champs :
  │     file  = binary audio du webhook
  │     model = "whisper-1"
  │     language = "fr"
  └─ Auth : Bearer (clé OpenAI)

    ↓  retourne { text: "..." }

Supabase node → Create row
  ├─ Table : transcriptions
  └─ Champs : piece_id, chantier_id, user_id, text, created_at

    ↓

Respond to Webhook
  └─ Retourne : { text, piece_id, saved: true }
```

#### Workflow 2 : Relecture vocale par pièce (MVP)

```
Webhook (POST)
  └─ Body : { piece_id }

    ↓

Supabase node → Get all rows
  ├─ Table : transcriptions
  └─ Filtre : piece_id = valeur reçue
       (triées par created_at ASC)

    ↓

HTTP Request → api.openai.com/v1/audio/speech
  ├─ Method : POST
  ├─ Body JSON : { model: "tts-1", input: texte assemblé, voice: "alloy" }
  ├─ Auth : Bearer (clé OpenAI)
  └─ Réponse attendue : binaire (audio/mpeg)

    ↓

Respond to Webhook
  └─ Response Data : First Entry Binary
       (retourne le fichier audio directement au navigateur)
```

#### Workflow 3 : Correction vocale (MVP)

```
Webhook (POST)
  └─ Body : { piece_id, texte_correction }

    ↓

Supabase node → Create row
  ├─ Table : corrections
  └─ Champs : piece_id, texte, created_at

    ↓

Respond to Webhook
  └─ Retourne : { success: true }
```

#### Workflow 4 : Structuration automatique (V1+)

```
Webhook (POST)
  └─ Body : { chantier_id }

    ↓

Supabase node → Get all rows
  ├─ Table : transcriptions
  └─ Filtre : chantier_id = valeur reçue

    ↓

OpenAI node (Chat)
  ├─ Modèle : gpt-4o
  ├─ Système : prompt d'extraction structurée (pièces, dimensions, opérations → JSON)
  └─ Utilisateur : toutes les transcriptions concaténées

    ↓  retourne JSON structuré

Supabase node → Create / Update rows
  └─ Sauvegarde les données structurées

    ↓

Respond to Webhook
  └─ Retourne : données structurées
```

#### Workflow 5 : Assistant métier contextuel (V3)

```
Webhook (POST)
  └─ Body : { question, contexte_chantier }

    ↓

OpenAI node (Chat)
  ├─ Modèle : gpt-4o
  ├─ Système : prompt assistant métier (propose des options, ne décide pas)
  └─ Utilisateur : question + contexte

    ↓

Respond to Webhook
  └─ Retourne : { options[], avertissement }
```

---

### 3.3 Configuration critique du Workflow 1 (audio binaire)

C'est le point le plus sensible de toute l'architecture.
Le fichier audio doit traverser trois étapes sans se corrompre :

```
1. Frontend enregistre l'audio via MediaRecorder  →  blob WebM ou MP3
2. Frontend envoie via fetch() en multipart/form-data vers le webhook n8n
3. Webhook reçoit le binaire (option "Binary Property" activée, nom : "audio")
4. HTTP Request renvoie ce binaire à Whisper en multipart/form-data
5. Whisper retourne la transcription en JSON
```

Points de configuration à ne pas rater :
- Le Webhook doit avoir **Binary Property activé** avec le nom du champ du formulaire multipart.
- Le HTTP Request vers Whisper doit être en **multipart/form-data** avec le champ `file` qui référence le binaire du webhook.
- Le frontend doit envoyer l'audio comme un champ de formulaire multipart, pas comme un corps JSON.

---

## 4. Coût estimé

### MVP (faible volume, quelques artisans en test)

| Service | Tier / usage | Coût/mois |
|---|---|---|
| Supabase | Free tier | $0 |
| Vercel (frontend) | Free tier | $0 |
| n8n | Self-hosted sur Railway (Starter) | ~$5–10 |
| OpenAI Whisper | ~30 min/mois de dictée | ~$0.20 |
| OpenAI TTS | ~500k caractères/mois | ~$7.50 |
| OpenAI GPT-4o | ~100 requêtes/mois (V1+) | ~$0.50 |
| **Total estimé** | | **~$13–18/mois** |

À noter : si vous hébergez n8n sur un serveur que vous possédez déjà (Docker local ou VPS),
le coût n8n tombe à $0 et le total reste < $10/mois.

---

## 5. Le compromis accepté

### Pas de streaming STT

Les mots n'apparaissent pas en temps réel — il y a un délai de ~3 secondes après chaque phrase
(~2s Whisper + ~1s overhead n8n). Ce compromis est justifié parce que :

- L'artisan dicte une phrase, fait une pause naturelle, puis continue.
  Le rythme "phrase → pause → phrase" est cohérent avec un traitement par chunks.
- Le PRD dit explicitement : *"Le MVP doit prouver l'usage réel, pas la performance technique."*
- Si les tests montrent que le délai gêne, on remplace Whisper par Google Cloud STT streaming
  dans le même workflow n8n (même HTTP Request, autre URL, autre format de requête).
  Le reste de l'architecture n'est pas touché.

### n8n vs code direct

Pour les flows du MVP (record → STT → afficher, et TTS playback), un simple backend en code
(quelques dizaines de lignes) serait plus rapide à écrire et plus réactif (moins de latence).
n8n ajoute une couche de configuration sur ces flows simples.

**Pourquoi accepter ce trade-off :** à partir de V1, les flows deviennent complexes
(structuration multi-étapes, calculs, génération de documents). n8n vaut vraiment son prix là.
Et les workflows MVP restent tels quels — on n'a rien à reécrire.

---

## 6. Feuille de route technique

### MVP

- Next.js 15 + Supabase (auth magic link + PostgreSQL)
- n8n self-hosted sur Railway
- **Workflow 1** : dictation audio → Whisper → Supabase → réponse
- **Workflow 2** : relecture TTS par pièce
- **Workflow 3** : correction vocale simple
- Frontend : enregistrement audio, affichage par pièce, export HTML/PDF
- Détection de commandes par mots-clés côté frontend : "relis", "corrige", "ajoute"

### V1 — Ajouts sur la même architecture

- **Workflow 4** : structuration automatique via GPT-4o
- Calcul des surfaces : logique métier dans un noeud Code n8n ou côté frontend
- Héritage de contexte ("pareil que l'autre mur") : géré dans le prompt GPT-4o
- Marquage confirmé / à vérifier : champ en PostgreSQL

### V2

- Bibliothèque d'opérations + prix : tables PostgreSQL
- Nouveau workflow n8n : calcul des montants (récupère surfaces + prix → calcule → retourne résumé)
- Pré-devis exportable : même couche HTML/PDF côté frontend
- Pas de changement d'architecture

### V3

- **Workflow 5** : assistant métier contextuel via GPT-4o
- Déclenchement par mots-clés détectés dans la transcription Whisper

### V4

- Workflow n8n pour la génération de devis via Google Docs API
- Historique des versions : déjà supporté par PostgreSQL
- Migration vers React Native possible sans toucher aux workflows n8n ni à Supabase

---

## 7. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Le flow audio binaire ne marche pas dans n8n (webhook → Whisper) | Moyenne | Critique | **C'est le premier truc à tester**, avant tout le reste. Si ça échoue après tests, on ajoute un thin proxy Node.js en entre pour gérer uniquement le binaire audio, et n8n récupère la transcription texte après. |
| Whisper ne marche pas bien en bruit chantier réel | Moyenne | Critique | Tester avec des enregistrements réels. Si ça échoue, switcher vers Google Cloud STT dans le même workflow n8n. |
| Latence n8n trop élevée (~3s par dictée) | Basse | Moyenne | Pour le MVP c'est acceptable. Si ça devient bloquant en V1+, on peut externaliser le flow STT vers une API route rapide et garder n8n pour le reste. |
| Supabase node trop limité pour V1+ | Basse | Moyenne | Pour les requêtes complexes, on passe par HTTP Request vers l'API REST Supabase avec les bons query params. Le node Supabase reste pour le CRUD simple. |
| n8n outage (Railway down) | Très basse | Haute | Railway a une bonne SLA. En V1+, on peut ajouter un fallback. Pour le MVP, c'est un risque acceptable. |
| PWA pas fluide sur iOS | Basse | Haute | Tester sur un iPhone avant de valider le MVP. Si bloquant : migrer vers React Native — les workflows n8n et Supabase ne changent pas. |

---

## 8. Premier pas concret

```
1. Créer un compte Supabase (free tier)
2. Déployer une instance n8n sur Railway (Docker, image officielle n8n)
3. Créer un projet Next.js 15 sur Vercel

4. *** AVANT DE CODER AUTRE CHOSE *** :
   Construire le Workflow 1 (dictation) dans n8n :
       Webhook (binary) → HTTP Request (Whisper) → Respond to Webhook
   Tester avec un fichier audio réel depuis le navigateur.
       → Si ça marche : on continue.
       → Si le binaire se corrompt : on teste avec un petit proxy Node.js en entre.
       → Si Whisper échoue en bruit : on teste Google Cloud STT à la même place.

5. Une fois le Workflow 1 validé, connecter Supabase (auth + première table)
6. Construire le frontend : enregistrement audio → appel webhook → affichage
7. Construire le Workflow 2 (TTS) et tester la relecture
8. Déployer
```

**Le point 4 est le seul qui compte vraiment au début.**
Deux risques en un : la gestion du binaire dans n8n, et la qualité de Whisper en bruit.
On les teste tous les deux en même temps, avec un seul workflow, avant de toucher à quoi que ce soit d'autre.
