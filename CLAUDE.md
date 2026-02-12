# CLAUDE.md — Assistant vocal de chantier

---

## Apercu du projet

Creer un assistant vocal de chantier destine aux artisans BTP, vendu en SaaS/white-label. L'artisan dicte sur le terrain (audio), prend des photos et videos, tout est transcrit, stocke dans Airtable et Google Drive, et accessible au patron pour validation.

Principe directeur : **L'outil assiste. L'artisan decide.** Validation humaine toujours requise, aucune action automatique, aucune correction silencieuse.

Phase actuelle : **MVP** — "Capturer le terrain en 1 tap".

---

## Architecture globale

```
Next.js 15 (PWA mobile-first)
  ├─ Reads : Airtable REST API (via API route)
  └─ Writes : POST webhooks → n8n → Airtable + Drive + OpenAI
```

- **Frontend** : Next.js 15, Tailwind CSS 4, PWA. UN seul codebase avec theming par client_id.
- **Backend** : n8n (creatorweb.fr). UN jeu de workflows, routing par client_id.
- **Data** : Airtable (1 base par client). Isolation totale des donnees.
- **Fichiers** : Google Drive (1 dossier par client). Photos + videos.
- **Documents** : Google Docs (1 doc par dossier). Transcriptions.
- **STT** : OpenAI Whisper. Feedback immediat via Web Speech API navigateur.
- **TTS** : OpenAI TTS (relecture vocale).

Pas de Supabase. Pas de base de donnees SQL. Airtable = source de verite.

---

## Style visuel

- Theme sombre par defaut (dark mode)
- Couleurs personnalisables par client (CSS custom properties)
- Zones de tap XXL (min 64px) — usage terrain avec gants
- Interface claire et minimaliste

---

## Contraintes et Politiques

- NE JAMAIS exposer les cles API au client. Toutes les cles restent cote serveur (n8n / variables d'environnement).
- Chaque client = base Airtable separee. Jamais d'acces croise.
- Audio jamais stocke. Seul le texte transcrit est persiste.
- Photos et videos stockees dans Google Drive, lien dans Airtable.

---

## Dependances

- Preferer les composants existants plutot que d'ajouter de nouvelles bibliotheques UI.
- `next` 15, `react` 19, `tailwindcss` 4 — stack minimale.

---

## Tests

A la fin de chaque developpement qui implique l'interface graphique, tester visuellement : l'interface doit etre responsive, fonctionnelle et adaptee au mobile (gros boutons, zones de tap XXL).

---

## Context7

Utiliser automatiquement les outils MCP Context7 (resolution d'identifiant de bibliotheque + recuperation de documentation) a chaque fois qu'il s'agit de generation de code, d'etapes de configuration ou d'installation, ou de documentation de bibliotheque/API.

---

## Commandes de developpement

```bash
# Installer dependances
npm install

# Lancer le dev server
npm run dev

# Build production
npm run build

# Lancer en production
npm run start
```

---

## Structure du projet

```
src/
  app/
    layout.tsx          # Root layout + theming provider
    page.tsx            # Page d'accueil (gros bouton micro)
    dossiers/
      page.tsx          # Liste des dossiers
    api/
      airtable/         # API routes pour lire Airtable
      dictation/        # Proxy webhook dictation
      media-upload/     # Proxy webhook photo/video
  components/
    AudioRecorder.tsx   # Enregistrement audio + Web Speech API
    PhotoCapture.tsx    # Capture photo camera
    VideoCapture.tsx    # Capture video camera (max 60s)
    DossierSelector.tsx # Selection/creation de dossier
    FeedbackButtons.tsx # Pouce haut/bas sur transcription
    ThemeProvider.tsx   # Injection CSS custom properties
  lib/
    webhookClient.ts    # Helper fetch vers n8n (token, client_id)
    clientConfig.ts     # Chargement config client JSON
  config/
    clients/            # 1 JSON par client (couleurs, base_id, etc.)
```

---

## Documentation

- Roadmap produit & fonctionnalites : `PRD.md`
- Architecture technique & stack : `ARCHITECTURE.md`
- Analyse stack technique : `TECH_STACK_REPORT.md`
