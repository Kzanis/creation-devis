# ARCHITECTURE — Assistant vocal de chantier

## Principe directeur

> L'outil assiste. L'artisan décide.

Validation humaine toujours requise. Aucune action automatique, aucune correction silencieuse.

---

## Stack retenue

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15 (PWA mobile-first) |
| Orchestration backend | n8n (self-hosted sur Railway) |
| Base de données | Supabase — PostgreSQL + RLS |
| Authentification | Supabase Auth — email/mot de passe ou magic link |
| Stockage fichiers (photos) | Supabase Storage — buckets par chantier |
| Speech-to-Text | OpenAI Whisper (`whisper-1`) |
| Text-to-Speech | OpenAI TTS (`tts-1`) |
| LLM (V1+) | OpenAI GPT-4o via node n8n natif |
| Génération document (MVP) | HTML structuré + export PDF navigateur |
| Génération document (V1+) | Google Docs API via workflow n8n |

Tous les appels OpenAI partagent la même clé API (Whisper, TTS, GPT-4o).

---

## Architecture globale

```
┌─────────────────────────────────────────────────┐
│  Next.js 15  —  PWA mobile                      │
│      UI uniquement                              │
│      Auth + lecture données : Supabase SDK      │
│      Traitements : appels webhooks vers n8n     │
└──────────┬───────────────────┬─────────────────┘
           │  POST webhooks    │  Reads (direct SDK)
           ▼                   ▼
┌─────────────────┐   ┌─────────────────────────┐
│  n8n            │   │  Supabase               │
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
│  OpenAI APIs                    │
│  • Whisper  (via HTTP Request)  │
│  • TTS      (via HTTP Request)  │
│  • GPT-4o   (via OpenAI node)   │
└─────────────────────────────────┘
```

### Séparation reads / writes

- **Reads** (lister chantiers, pièces, transcriptions) : le frontend lit Supabase directement via le SDK. Zéro latence n8n.
- **Writes / Traitements** (envoyer audio, corriger, structurer) : le frontend appelle un webhook n8n. n8n orchestre les appels API et la persistance.

---

## Workflows n8n

### Workflow 1 — Dictation (MVP)

```
Webhook (POST)
  ├─ Binary Property activé → fichier audio
  └─ Body JSON → { piece_id, chantier_id, user_id }
       │
       ▼
HTTP Request → api.openai.com/v1/audio/transcriptions
  └─ multipart/form-data : file (audio binaire), model ("whisper-1"), language ("fr")
       │
       ▼
Supabase node → Create row
  └─ table: transcriptions — piece_id, chantier_id, user_id, text, created_at
       │
       ▼
Respond to Webhook → { text, piece_id, saved: true }
```

### Workflow 2 — Relecture vocale par pièce (MVP)

```
Webhook (POST)
  └─ Body → { piece_id }
       │
       ▼
Supabase node → Get all rows
  └─ table: transcriptions — filtre: piece_id, tri: created_at ASC
       │
       ▼
HTTP Request → api.openai.com/v1/audio/speech
  └─ { model: "tts-1", input: texte assemblé, voice: "alloy" }
       │
       ▼
Respond to Webhook → binaire audio (First Entry Binary)
```

### Workflow 3 — Correction vocale (MVP)

```
Webhook (POST)
  └─ Body → { piece_id, texte_correction }
       │
       ▼
Supabase node → Create row
  └─ table: corrections — piece_id, texte, created_at
       │
       ▼
Respond to Webhook → { success: true }
```

### Workflow 4 — Upload photo terrain (MVP)

```
Webhook (POST)
  ├─ Binary Property activé → fichier image (JPEG/PNG)
  └─ Body JSON → { piece_id, chantier_id, user_id, description? }
       │
       ▼
Supabase Storage → Upload
  └─ bucket: photos-chantier/{chantier_id}/{piece_id}/
  └─ filename: {timestamp}.jpg
       │
       ▼
Supabase node → Create row
  └─ table: photos — piece_id, chantier_id, user_id, storage_url, description, created_at
       │
       ▼
Respond to Webhook → { url, piece_id, saved: true }
```

### Workflow 5 — Sync CRM Airtable (V1)

```
Trigger: Supabase → Webhook sur insert/update (chantiers, pieces, transcriptions)
       │
       ▼
Airtable node → Create / Update record
  └─ Base: [configurable par artisan]
  └─ Tables mappées :
       - Chantiers → table "Chantiers"
       - Pièces → table "Pièces"
       - Transcriptions → table "Notes vocales"
       - Photos → table "Photos" (avec URL Supabase Storage)
       │
       ▼
Supabase node → Update crm_sync_log
  └─ status: success/error, synced_at
```

### Workflow 6 — Structuration automatique (V1+)

```
Webhook (POST)
  └─ Body → { chantier_id }
       │
       ▼
Supabase node → Get all rows
  └─ table: transcriptions — filtre: chantier_id
       │
       ▼
OpenAI node (Chat) — gpt-4o
  └─ Extraction structurée depuis les transcriptions → JSON (pièces, dimensions, opérations)
       │
       ▼
Supabase node → Create / Update rows (données structurées)
       │
       ▼
Respond to Webhook → données structurées
```

### Workflow 5 — Assistant métier contextuel (V3)

```
Webhook (POST)
  └─ Body → { question, contexte_chantier }
       │
       ▼
OpenAI node (Chat) — gpt-4o
  └─ Propose plusieurs options, ne décide pas
       │
       ▼
Respond to Webhook → { options[], avertissement }
```

---

## Modèle de données

Relationnel : organisation → chantier → pièce → données.

### Tables MVP

| Table | Rôle |
|---|---|
| `organisations` | Isolation du périmètre de données |
| `users` | Utilisateurs, liés à une organisation |
| `chantiers` | Chantiers, liés à une organisation et un utilisateur |
| `pieces` | Pièces d'un chantier (chambre 1, cuisine, SDB…) |
| `transcriptions` | Transcriptions brutes par pièce |
| `corrections` | Corrections vocales par pièce |
| `photos` | Photos terrain liées à un chantier et une pièce (URL Supabase Storage) |

### Tables V1+

| Table | Rôle |
|---|---|
| `surfaces` | Surfaces calculées depuis les dimensions (V1) |
| `operations` | Bibliothèque d'opérations métier (V2) |
| `prix` | Grille de prix paramétrable par artisan (V2) |
| `crm_sync_log` | Journal de synchronisation avec le CRM externe (V1) |

Isolation par organisation via **Row Level Security (RLS)** sur toutes les tables.

---

## Authentification & sécurité

| Phase | Ce qui est en place |
|---|---|
| MVP | Supabase Auth : email + mot de passe ou magic link. Un utilisateur = une organisation. Isolation stricte via RLS. |
| V1 | Invitation d'utilisateurs dans une organisation. Rôles : Administrateur, Utilisateur. Accès partagé aux chantiers. |
| V2 | Droits par rôle sur la validation du pré-devis et la génération du devis. Traçabilité : qui a dicté, modifié, validé, quand. |

Règle : plus l'action est engageante, plus le niveau de validation et de traçabilité est élevé.

### Sécurité des webhooks n8n

Les webhooks sont exposés publiquement. Deux niveaux de protection selon la phase :

**MVP — Token statique**

Le frontend envoie un header `X-API-Token` sur chaque requête. Chaque workflow n8n vérifie la valeur via un noeud IF avant de poursuivre. Le token est géré via les variables d'environnement (Vercel côté frontend, Railway côté n8n).

**V1 — Signature HMAC + anti-replay**

Le frontend signe chaque requête avec un HMAC-SHA256 calculé à partir du timestamp Unix et du corps de la requête. n8n vérifie la signature, rejette les requêtes si le timestamp dépasse 5 minutes (anti-replay), et applique un rate limiting par `user_id`. Le secret partagé est géré uniquement via les variables d'environnement, jamais exposé côté client.

---

## Déploiement

| Service | Plateforme | Coût estimé |
|---|---|---|
| Frontend (Next.js 15) | Vercel | Free tier |
| n8n | Railway (Docker, image officielle n8n) | ~$5–10/mois |
| Supabase | Supabase Cloud | Free tier |
| OpenAI (Whisper + TTS + GPT-4o) | API — faible volume MVP | ~$8/mois |
| **Total MVP** | | **~$13–18/mois** |

---

## Point critique : gestion du binaire audio

C'est le point le plus sensible de l'architecture. Le fichier audio doit traverser ces étapes sans se corrompre :

1. Frontend enregistre via `MediaRecorder` → blob audio
2. Frontend envoie via `fetch()` en `multipart/form-data` vers le webhook n8n
3. Webhook reçoit le binaire (`Binary Property` activé, nom du champ : `audio`)
4. `HTTP Request` renvoie ce binaire à Whisper en `multipart/form-data` (champ `file`)
5. Whisper retourne la transcription en JSON

À ne pas rater :
- Le webhook doit avoir `Binary Property` activé avec le nom exact du champ multipart
- Le `HTTP Request` vers Whisper doit être en `multipart/form-data`, pas JSON
- Le frontend envoie l'audio comme champ de formulaire, pas comme corps de requête

### Cycle de vie des fichiers audio

Les fichiers audio ne sont **jamais stockés** de manière permanente. Le flux est entièrement ephémère :

```
Frontend          n8n / Backend          OpenAI
   │                   │                   │
   │  blob (RAM)       │                   │
   ├──────────────────►│                   │
   │                   │  blob (RAM)       │
   │                   ├──────────────────►│  Whisper
   │                   │◄── texte ─────────┤
   │                   │                   │
   │                   │  Sauvegarde texte  │
   │◄── texte ─────────┤  dans Supabase    │
   │                   │                   │
   │  blob = null (GC) │  blob = null (GC) │
```

Seul le texte transcrit est persévéré. Aucune colonne audio dans les tables de la base de données.

---

## Détection de commandes (MVP — côté frontend)

Le frontend analyse les transcriptions pour détecter des commandes par mots-clés :

| Mot-clé | Action déclenchée |
|---|---|
| "relis" | Appel Workflow 2 (relecture TTS de la pièce) |
| "corrige" | Mode correction — prochaine dictée traitée comme correction |
| "ajoute" | Ajout d'une nouvelle transcription sur la pièce en cours |

---

## Risques & mitigation

| Risque | Sévérité | Solution MVP | Solution V1+ |
|---|---|---|---|
| Binaire audio corrompu dans n8n | Critique | Tester en premier. Si échec : proxy via une API Route Next.js qui appelle Whisper puis transmet le texte à n8n. | — |
| SPOF sur n8n (orchestration backend centralisée) | Élevé | Toast d'erreur si n8n indisponible (timeout 10s). | Queue locale IndexedDB + replay automatique. Health check n8n toutes les 30s. |
| Couplage fort avec OpenAI (Whisper, TTS, GPT-4o) | Élevé | Un workflow unique par service. | Workflows alternatifs (Google Cloud STT, Anthropic) activables via une table `app_config` dans Supabase. Fallback automatique sur erreur 5xx. |
| Webhooks exposés sans authentification | Moyen | Token statique dans les headers, vérifié par un noeud IF. | HMAC-SHA256 + timestamp anti-replay + rate limiting par `user_id`. |
| Whisper peu fiable en bruit chantier | Moyen | Tester avec des enregistrements réels chantier. | Si précision < 75% : activer le workflow Google Cloud STT. |
| Latence cumulée (~3s par dictée) | Moyen | Acceptable MVP. | Externaliser le flow STT vers une API route rapide. Tests de charge avant V1 (min. 10 utilisateurs simultanés). |
| PWA pas fluide sur iOS | Moyen | Tester sur iPhone avant de valider le MVP. | Si bloquant : migrer vers React Native — les workflows n8n et Supabase ne changent pas. |

---

## Observabilité & logging

| Phase | Ce qui est en place |
|---|---|
| MVP | Logs JSON via `console.log` dans les noeuds Code n8n. Accessibles depuis Railway Dashboard > Logs. |
| V1 | Table `app_logs` dans Supabase (niveau, workflow, message, métadonnées, user_id). Noeud de logging réutilisable dans chaque workflow. Dashboard admin dans Next.js. Alertes par email via un workflow n8n planifié (scan toutes les 5 min). Retention automatique à 30 jours via `pg_cron`. |

---

## Stratégie de tests

| Niveau | MVP | V1+ |
|---|---|---|
| Unitaires | — | Vitest sur les fonctions frontend (signature webhooks, gestion audio). |
| Intégration | Test manuel du flux binaire audio vers n8n (voir "Premier pas concret"). | Tests HTTP automatisés contre les webhooks n8n avec des fichiers audio par condition : calme, bruit léger, bruit chantier. |
| E2E | Checklist manuelle documentée (flux dictation, relecture TTS, bruit chantier). | Playwright : simulation du flux complet sur mobile. |
| Performance | — | Tests de charge avant V1 (min. 10 utilisateurs simultanés). Seuils : latence < 5s, précision STT > 75% en bruit chantier. |
| CI/CD | — | GitHub Actions : unitaires → intégration → E2E. |

---

## Backup & récupération

| Élément | MVP | V1+ |
|---|---|---|
| Workflows n8n | Export manuel via l'API n8n (`GET /api/v1/workflows`). Stocker dans le dépôt git. | GitHub Actions quotidien : export automatique vers les artefacts GitHub (retention 30 jours). |
| Base de données | Backups automatiques inclus (Supabase Pro). Free tier : export `pg_dump` manuel hebdomadaire. | Automatisation quotidienne via GitHub Actions. |
| RTO / RPO | RPO : 1 semaine. RTO : non défini. | RPO : 24h. RTO : 4h. Procédure de restauration documentée. |

---

## RGPD & conformité

### Sous-traitants

| Service | Finalité | Localisation |
|---|---|---|
| Supabase | Base de données | AWS Europe (Frankfurt) |
| OpenAI | Transcription (Whisper), synthèse vocale (TTS), structuration (GPT-4o) | USA |
| Railway | Orchestration (n8n) | USA |
| Vercel | Hébergement frontend | Edge global |

Les transferts vers les USA sont encadrés par les Clauses Contractuelles Types de la Commission Européenne.

### Retention & suppression

- **Audio** : jamais stocké. Voir "Cycle de vie des fichiers audio".
- **Transcriptions & corrections** : conservées tant que le chantier est actif + 2 ans après archivage. Suppression automatique via `pg_cron`.
- **Logs** : anonymisation du `user_id` après 90 jours. Suppression complète après 30 jours.
- **Droit à l'oubli** : fonction de suppression complète des données d'un utilisateur (chantiers, pièces, transcriptions, corrections, logs). Accessible depuis l'interface utilisateur (espace compte).

---

## Mode hors-ligne

| Phase | Comportement |
|---|---|
| MVP | Indicateur visuel (bandeau) si la connexion est perdue. Les enregistrements ne sont pas sauvegardés en mode hors-ligne. |
| V1 | PWA avec Service Worker. Les dictées sont stockées dans une queue IndexedDB. Sync automatique en arrière-plan dès que la connexion est retablie (`Background Sync API`). Indicateur du nombre d'enregistrements en attente. |

---

## Versionning des webhooks

Tous les webhooks sont préfixés par leur version dès le départ :

```
/webhook/v1/dictation
/webhook/v1/tts
/webhook/v1/correction
/webhook/v1/structuration
```

Le frontend centralise les endpoints dans un fichier de configuration. En cas d'évolution incompatible, l'ancien endpoint reste actif en parallèle jusqu'à migration complète.

---

## Priorités par phase

### Avant le MVP
- Tester le flux binaire audio direct vers n8n (blocker du projet)
- Ne jamais stocker les fichiers audio
- Token statique sur les webhooks
- Logs basiques via Railway

### Au niveau du MVP
- Toast d'erreur si n8n est indisponible
- Indicateur hors-ligne
- Checklist de tests manuels documentée
- Export manuel hebdomadaire des workflows n8n

### Pour la V1
- HMAC + rate limiting sur les webhooks
- Queue locale + replay automatique (mode hors-ligne complet)
- Workflows alternatifs (fallback STT, TTS, LLM)
- Table `app_logs` + dashboard + alertes
- Tests automatisés (Vitest + Playwright + CI/CD)
- Backup automatisé quotidien
- RGPD complet (retention, droit à l'oubli, page de gestion)
- Versionning `/v1/` sur tous les webhooks

---

## Premier pas concret

```
1. Créer un compte Supabase (free tier)
2. Déployer une instance n8n sur Railway (Docker, image officielle)
3. Créer un projet Next.js 15 sur Vercel

4. *** AVANT DE CODER AUTRE CHOSE ***
   Construire le Workflow 1 dans n8n :
       Webhook (binary) → HTTP Request (Whisper) → Respond to Webhook
   Tester avec un fichier audio réel depuis le navigateur.
       → Ça marche : on continue.
       → Le binaire se corrompt : on teste avec un petit proxy Node.js en entre.
       → Whisper échoue en bruit : on teste Google Cloud STT à la même place.

5. Une fois le Workflow 1 validé : connecter Supabase (auth + première table)
6. Construire le frontend : enregistrement audio → appel webhook → affichage
7. Construire le Workflow 2 (TTS) et tester la relecture
8. Déployer
```
