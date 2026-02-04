# CLAUDE.md — Assistant vocal de chantier

---

## Aperçu de l'objectif du projet

Créer un assistant vocal de chantier destiné aux artisans BTP, capable d'écouter une description orale en conditions réelles (chantier, camion), de la transcrire fidèlement, de permettre une relecture et correction vocale, puis de générer un document structuré par pièce.

Principe directeur : **L'outil assiste. L'artisan décide.** Validation humaine toujours requise, aucune action automatique, aucune correction silencieuse.

Phase actuelle : **MVP** — "Parler → entendre → valider".

---

## Aperçu de l'architecture globale

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
│  Workflow 1     │   │                         │
│  Dictation      │   └─────────────────────────┘
│  Workflow 2     │
│  Relecture TTS  │
│  Workflow 3     │
│  Correction     │
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

- **Reads** (liste chantiers, pièces, transcriptions) : frontend lit Supabase directement via SDK.
- **Writes / Traitements** (audio, corrections) : frontend POST webhook vers n8n, qui orchestre les API et la persistance.

---

## Style visuel

- Interface claire et minimaliste.
- Pas de mode sombre pour le MVP.

---

## Contraintes et Politiques

- NE JAMAIS exposer les clés API au client. Toutes les clés restent côté serveur (n8n / variables d'environnement Railway).

---

## Dépendances

- Préférer les composants existants plutôt que d'ajouter de nouvelles bibliothèques UI.

---

## Tests — Interface graphique

À la fin de chaque développement qui implique l'interface graphique, tester avec `playwright-skill` : l'interface doit être responsive, fonctionnelle et répondre au besoin développé.

---

## Context7

Utiliser automatiquement les outils MCP Context7 (résolution d'identifiant de bibliothèque + récupération de documentation) à chaque fois qu'il s'agit de génération de code, d'étapes de configuration ou d'installation, ou de documentation de bibliothèque/API. Pas besoin de le demander explicitement.

---

## Specs OpenSpec — Langue

Toutes les spécifications doivent être rédigées en français, y compris les specs OpenSpec (sections Purpose et Scenarios). Seuls les titres de Requirements doivent rester en anglais avec les mots-clés SHALL/MUST pour la validation OpenSpec.

---

## Documentation

- Roadmap produit & fonctionnalités : `@PRD.md`
- Architecture technique & stack : `@ARCHITECTURE.md`
