# ARCHITECTURE — Assistant vocal de chantier

## Principe directeur

> L'outil assiste. L'artisan decide.

Validation humaine toujours requise. Aucune action automatique, aucune correction silencieuse.

---

## Stack retenue

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15 (PWA mobile-first) |
| Orchestration backend | n8n (self-hosted sur creatorweb.fr) |
| Base de donnees | Airtable (1 base par client) |
| Stockage fichiers | Google Drive (1 dossier par client) |
| Documents structures | Google Docs (1 doc par dossier) |
| Speech-to-Text | OpenAI Whisper (`whisper-1`) |
| Text-to-Speech | OpenAI TTS (`tts-1`) |
| Feedback temps reel | Web Speech API (navigateur, approximatif) |
| LLM (V1+) | OpenAI GPT-4o via n8n |
| Deploiement frontend | Vercel |

---

## Architecture globale

```
┌─────────────────────────────────────────────────────┐
│  Next.js 15  —  PWA mobile-first                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Config client (client_id)                   │    │
│  │  → couleurs, logo, airtable_base_id,        │    │
│  │    drive_folder_id, api_token                │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Reads : Airtable REST API (via API route Next.js)  │
│  Writes : POST webhooks vers n8n                    │
└──────────┬────────────────────────┬─────────────────┘
           │  POST webhooks         │  GET Airtable API
           ▼                        ▼
┌─────────────────┐       ┌────────────────────────┐
│  n8n             │       │  Airtable              │
│  (creatorweb.fr) │       │  1 base par client     │
│                  │──────►│                        │
│  UN jeu de WF    │       │  Tables :              │
│  pour TOUS les   │       │  - Dossiers            │
│  clients         │       │  - Transcriptions      │
│                  │       │  - Corrections         │
│  Routing par     │       │  - Medias (photos/vid) │
│  client_id       │       │  - Feedback            │
└────────┬─────────┘       └────────────────────────┘
         │
         │  HTTP calls
         ▼
┌─────────────────────────────────────┐
│  APIs externes                      │
│  • OpenAI Whisper  (STT)            │
│  • OpenAI TTS      (relecture)      │
│  • Google Drive    (photos/videos)  │
│  • Google Docs     (transcriptions) │
│  • Email SMTP      (notif patron)   │
└─────────────────────────────────────┘
```

---

## Isolation des donnees — Architecture multi-tenant

### Principe : isolation des DONNEES, pas du CODE

```
UN SEUL frontend (config couleurs par client via client_id)
UN SEUL jeu de workflows n8n (routing par client_id)
UNE base Airtable PAR CLIENT (donnees isolees)
UN dossier Google Drive PAR CLIENT (fichiers isoles)
```

### Table de configuration clients (dans n8n ou Airtable admin)

| client_id | nom | airtable_base_id | drive_folder_id | api_token | couleur_primaire | logo_url | metier | email_patron |
|---|---|---|---|---|---|---|---|---|
| dupont | Dupont Platrerie | appXXXXXX | 1AbC... | tok_xxx | #F59E0B | /logos/dupont.png | platrerie | patron@dupont.fr |
| martin | Martin Couverture | appYYYYYY | 1DeF... | tok_yyy | #2563EB | /logos/martin.png | couverture | boss@martin.fr |

Le client_id est transmis dans chaque requete (header ou URL). Les workflows n8n utilisent ce client_id pour router vers la bonne base Airtable et le bon dossier Drive.

---

## Separation reads / writes

- **Reads** (lister dossiers, transcriptions, medias) : le frontend appelle une API route Next.js qui lit Airtable REST API. Pas de passage par n8n pour les lectures simples.
- **Writes / Traitements** (envoyer audio, photos, videos, corriger) : le frontend appelle un webhook n8n. n8n orchestre les appels API et la persistance dans Airtable.

---

## Workflows n8n

### Workflow 1 — Dictation (MVP)

```
Webhook (POST /v1/dictation)
  ├─ Header: X-API-Token + X-Client-ID
  │
  ├─ IF: verifier token (lookup dans config clients)
  │  └─ Invalid → Respond 401
  │
  ├─ Lookup config client → airtable_base_id, drive_folder_id
  │
  ├─ HTTP Request → api.openai.com/v1/audio/transcriptions
  │  └─ Whisper, language=fr
  │
  ├─ Airtable node → Create record (table Transcriptions)
  │  └─ base: [dynamique selon client_id]
  │  └─ fields: dossier_id, text, created_at
  │
  ├─ Google Docs → Append text au doc du dossier
  │  └─ Creer le doc si inexistant
  │
  ├─ (Optionnel) Email → notification patron
  │
  └─ Respond to Webhook → { text, dossier_id, saved: true }
```

### Workflow 2 — Relecture TTS (MVP)

```
Webhook (POST /v1/tts)
  ├─ Verifier token + lookup config
  │
  ├─ Airtable → Get records (table Transcriptions, filtre dossier_id)
  │
  ├─ Code node → Assembler le texte
  │
  ├─ HTTP Request → api.openai.com/v1/audio/speech
  │  └─ TTS model: tts-1, voice: alloy
  │
  └─ Respond to Webhook → binaire audio (audio/mpeg)
```

### Workflow 3 — Correction vocale (MVP)

```
Webhook (POST /v1/correction)
  ├─ Verifier token + lookup config
  │
  ├─ Airtable → Create record (table Corrections)
  │
  └─ Respond to Webhook → { success: true }
```

### Workflow 4 — Upload media (photo/video) (MVP)

```
Webhook (POST /v1/media-upload)
  ├─ Verifier token + lookup config
  │
  ├─ Recevoir binaire (photo ou video)
  │
  ├─ Google Drive → Upload dans le dossier client
  │  └─ Sous-dossier: {dossier_id}/
  │  └─ Filename: {timestamp}.{ext}
  │
  ├─ Airtable → Create record (table Medias)
  │  └─ fields: dossier_id, type (photo/video), drive_url, created_at
  │
  └─ Respond to Webhook → { url, type, saved: true }
```

### Workflow 5 — Notification patron (MVP)

```
Trigger: apres chaque dictation ou upload media
  │
  ├─ Lookup email_patron dans config client
  │
  ├─ Airtable → Count records du dossier (transcriptions + medias)
  │
  ├─ Email node → Envoyer notification
  │  └─ "Nouveau releve chantier [client] — [N] elements, en attente de validation"
  │
  └─ (Pas de reponse, trigger interne)
```

### Workflow 6 — Structuration IA (V1+)

```
Webhook (POST /v1/structuration)
  ├─ Verifier token + lookup config
  │
  ├─ Airtable → Get all transcriptions du dossier
  │
  ├─ OpenAI GPT-4o → Extraction structuree
  │  └─ Prompt configurable par metier (lookup dans config client)
  │  └─ JSON output: pieces, dimensions, operations
  │
  ├─ Airtable → Update dossier avec donnees structurees
  │
  └─ Respond to Webhook → donnees structurees
```

---

## Modele de donnees Airtable

### Base template (dupliquee pour chaque nouveau client)

| Table | Champs | Role |
|---|---|---|
| **Dossiers** | id, nom_client, adresse, statut (Brouillon/En cours/Valide), google_doc_url, drive_folder_url, created_at, updated_at | Dossiers chantier |
| **Transcriptions** | id, dossier_id (link), text, feedback (pouce haut/bas), created_at | Dictees brutes |
| **Corrections** | id, dossier_id (link), transcription_id (link), text, created_at | Corrections vocales |
| **Medias** | id, dossier_id (link), type (photo/video), drive_url, description, created_at | Photos et videos |
| **Feedback** | id, transcription_id (link), rating (up/down), comment, created_at | Retours qualite beta |

### Tables V1+ (ajoutees dans la base existante)

| Table | Role |
|---|---|
| **Donnees_structurees** | Pieces, dimensions, operations extraites par GPT-4o |
| **Operations_metier** | Bibliotheque d'operations par metier (V2) |
| **Prix** | Grille de prix parametrable par artisan (V2) |

---

## Frontend — Theming white-label

### Systeme de configuration

```json
// config/clients/dupont.json
{
  "client_id": "dupont",
  "name": "Dupont Platrerie",
  "logo": "/logos/dupont.png",
  "colors": {
    "primary": "#F59E0B",
    "secondary": "#1F2937",
    "accent": "#F97316",
    "background": "#0F172A",
    "surface": "#1E293B",
    "text": "#F8FAFC"
  },
  "metier": "platrerie",
  "airtable_base_id": "appXXXXXX",
  "api_token": "tok_xxx",
  "n8n_base_url": "https://creatorweb.fr/webhook"
}
```

### Injection CSS

```css
:root {
  --color-primary: var(--client-primary, #F59E0B);
  --color-secondary: var(--client-secondary, #1F2937);
  --color-accent: var(--client-accent, #F97316);
  --color-bg: var(--client-bg, #0F172A);
  --color-surface: var(--client-surface, #1E293B);
  --color-text: var(--client-text, #F8FAFC);
}
```

Changer les couleurs d'un client = modifier 6 valeurs dans un fichier JSON.

---

## Securite

### MVP

| Mesure | Implementation |
|---|---|
| Token API par client | Header X-API-Token verifie par n8n a chaque requete |
| Isolation donnees | Bases Airtable separees, pas d'acces croise possible |
| Cles cote serveur | OpenAI, Google, Airtable admin = variables n8n, jamais exposees au frontend |
| HTTPS obligatoire | Vercel + creatorweb.fr = TLS par defaut |
| Pas de secrets dans le frontend | Le frontend connait uniquement client_id et api_token (non sensible) |

### V1

| Mesure | Implementation |
|---|---|
| HMAC-SHA256 | Signature de chaque requete (timestamp + body) |
| Anti-replay | Rejet si timestamp > 5 min |
| Rate limiting | Par client_id dans n8n |
| Auth utilisateur | Login email/mdp ou magic link |

---

## Cycle de vie des fichiers

### Audio (ephemere)

```
Frontend          n8n               OpenAI
   │                   │                   │
   │  blob (RAM)       │                   │
   ├──────────────────►│                   │
   │                   │  blob (RAM)       │
   │                   ├──────────────────►│  Whisper
   │                   │◄── texte ─────────┤
   │                   │                   │
   │                   │  Save texte       │
   │◄── texte ─────────┤  dans Airtable   │
   │                   │                   │
   │  blob = null (GC) │  blob = null (GC) │
```

Seul le texte transcrit est persiste. Aucun fichier audio stocke.

### Photos / Videos (permanent)

```
Frontend          n8n               Google Drive
   │                   │                   │
   │  blob             │                   │
   ├──────────────────►│                   │
   │                   │  Upload           │
   │                   ├──────────────────►│  Stockage permanent
   │                   │◄── drive_url ─────┤
   │                   │                   │
   │                   │  Save URL dans    │
   │◄── saved ─────────┤  Airtable         │
```

---

## Mode offline (PWA) — V1

| Phase | Comportement |
|---|---|
| MVP | Indicateur visuel si connexion perdue. Les enregistrements sont mis en file d'attente dans IndexedDB. Upload automatique au retour du reseau. |
| V1 | Service Worker complet. Queue locale avec retry. Indicateur du nombre d'elements en attente. Background Sync API. |

---

## Deploiement

| Service | Plateforme | Cout estime |
|---|---|---|
| Frontend (Next.js 15) | Vercel | Free tier |
| n8n | creatorweb.fr (self-hosted) | Inclus |
| Airtable | Airtable Cloud | Free tier (1000 records/base) → Team ($20/mois pour plus) |
| Google Drive + Docs | Google Workspace | Free tier (15 Go) |
| OpenAI (Whisper + TTS) | API | ~$8/mois (faible volume MVP) |
| **Total MVP** | | **~$8/mois** (hors Airtable si depasse free tier) |

---

## Onboarding d'un nouveau client

1. **Dupliquer la base Airtable template** → nouvelle base avec tables vides
2. **Creer un dossier Google Drive** pour le client
3. **Ajouter une entree** dans la table de config clients (client_id, base_id, drive_folder_id, token, couleurs, logo)
4. **Deployer le frontend** avec la config client (ou mettre a jour la config si deploiement unique)
5. **Envoyer le lien** au client

Temps estime : 15 minutes par nouveau client.

---

## Risques & mitigation

| Risque | Severite | Solution MVP | Solution V1+ |
|---|---|---|---|
| Whisper peu fiable en bruit chantier | Critique | Tester avec enregistrements reels. Si < 75% : tester Google Cloud STT. | Fallback automatique |
| Airtable free tier depasse (1000 records) | Moyen | Suffisant pour 5 beta. Monitorer. | Upgrade Airtable Team ou migration Supabase |
| Latence Whisper (2-5s) | Moyen | Web Speech API pour feedback immediat | Optimisation audio format |
| Pas de reseau sur le chantier | Eleve | Indicateur + queue locale basique | PWA offline complete |
| Google Drive quota (15 Go gratuit) | Moyen | Suffisant pour le beta (photos compressees) | Google Workspace ou S3 |
| Duplication manuelle pour chaque client | Moyen | Acceptable pour 5 clients | Script d'onboarding automatise |

---

## Priorites par phase

### Sprint 1 — Template frontend + Workflow dictation
- Frontend : accueil, gros bouton micro, dossiers, theming
- Workflow 1 : dictation (audio → Whisper → Airtable)
- Base Airtable template
- Config client JSON

### Sprint 2 — Capture media + relecture
- Workflow 4 : upload photo/video → Drive
- Workflow 2 : relecture TTS
- Frontend : capture photo, capture video, relecture audio

### Sprint 3 — Corrections + notifications + feedback
- Workflow 3 : correction vocale
- Workflow 5 : notification patron par email
- Frontend : boutons feedback (pouce haut/bas)
- Mode demo pour Sabrina

### Sprint 4 — Offline + polish + deploiement beta
- PWA : queue IndexedDB, indicateurs, sync
- Tests terrain reels (bruit chantier)
- Deploiement Vercel
- Onboarding des 5 premiers clients
- Post LinkedIn
