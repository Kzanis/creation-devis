# Plan de construction — MVP Assistant vocal de chantier

## Objectif

Livrer un MVP fonctionnel pour :
1. Post LinkedIn → 5 entreprises beta-testers
2. Outil de demo pour Sabrina (commerciale)

---

## Sprint 1 — Template frontend + Workflow dictation

### Frontend
- [ ] **ThemeProvider** : chargement config client JSON → injection CSS custom properties
- [ ] **Page d'accueil** : gros bouton micro central (XXL), indicateur dossier en cours, switch dossier rapide
- [ ] **AudioRecorder** : MediaRecorder API + Web Speech API (feedback live) + envoi webhook n8n
- [ ] **DossierSelector** : creation rapide (nom client + adresse dictes), liste dossiers depuis Airtable
- [ ] **Page dossiers** : liste avec statuts (Brouillon/En cours/Valide), actions (Ouvrir/Reprendre)
- [ ] **API route /api/airtable** : lecture Airtable REST API (dossiers, transcriptions)
- [ ] **API route /api/dictation** : proxy vers webhook n8n dictation
- [ ] **Config client JSON** : creer un client "demo" avec couleurs par defaut
- [ ] **webhookClient.ts** : helper fetch avec X-API-Token et X-Client-ID

### Backend (n8n)
- [ ] **Table config clients** : creer dans Airtable admin (ou en dur dans n8n pour MVP)
- [ ] **Workflow 1 — Dictation** : Webhook → auth token → lookup client → Whisper → Airtable → Google Docs → respond
- [ ] **Base Airtable template** : creer les 5 tables (Dossiers, Transcriptions, Corrections, Medias, Feedback)

### Livrable Sprint 1
> L'artisan peut ouvrir l'app, creer un dossier, dicter, et retrouver la transcription dans Airtable.

---

## Sprint 2 — Capture media + relecture

### Frontend
- [ ] **PhotoCapture** : acces camera (getUserMedia), preview, upload via webhook
- [ ] **VideoCapture** : acces camera, enregistrement video (max 60s), preview, upload
- [ ] **Galerie medias** : affichage photos/videos du dossier (liens Google Drive)
- [ ] **Relecture audio** : bouton "Relis" → appel TTS → lecture audio dans le navigateur

### Backend (n8n)
- [ ] **Workflow 4 — Upload media** : Webhook → auth → Google Drive upload → Airtable record → respond
- [ ] **Workflow 2 — Relecture TTS** : Webhook → auth → get transcriptions Airtable → assembler texte → OpenAI TTS → respond audio

### Livrable Sprint 2
> L'artisan peut prendre des photos et videos, et ecouter la relecture de ses dictees.

---

## Sprint 3 — Corrections + notifications + feedback + demo

### Frontend
- [ ] **Correction vocale** : bouton "Corriger" → enregistrement → envoi correction
- [ ] **FeedbackButtons** : pouce haut/bas sur chaque transcription
- [ ] **Mode demo** : donnees pre-chargees, dictee simulee, lien partageable

### Backend (n8n)
- [ ] **Workflow 3 — Correction** : Webhook → auth → Airtable create correction
- [ ] **Workflow 5 — Notification patron** : Email apres chaque dictation/upload
- [ ] **Feedback** : stocker les votes dans la table Feedback Airtable

### Livrable Sprint 3
> Le patron recoit des notifications. Sabrina a un lien de demo fonctionnel.

---

## Sprint 4 — Offline + polish + deploiement beta

### Frontend
- [ ] **PWA manifest** : icones, splash screen, installable
- [ ] **Service Worker** : cache statique, indicateur offline
- [ ] **Queue IndexedDB** : stocker enregistrements hors connexion, sync au retour reseau
- [ ] **Indicateurs** : nombre d'elements en attente, statut upload
- [ ] **Polish UX** : animations, transitions, gestion erreurs gracieuse

### Deploiement
- [ ] **Deployer sur Vercel** : config env, domaine
- [ ] **Tester en conditions reelles** : enregistrements sur chantier (bruit)
- [ ] **Onboarding 5 clients** : dupliquer Airtable, creer Drive, config client
- [ ] **Post LinkedIn** : rediger + publier
- [ ] **Former Sabrina** : demo mode + discours commercial

### Livrable Sprint 4
> 5 entreprises beta utilisent le produit. Sabrina fait des demos.

---

## Definition of Done par sprint

Chaque sprint est "done" quand :
1. Les fonctionnalites listees fonctionnent sur mobile (iPhone + Android)
2. Le theming white-label s'applique correctement
3. Les donnees arrivent dans Airtable
4. Les fichiers arrivent dans Google Drive
5. Aucune cle API n'est exposee cote client

---

## Risques et points d'attention

| Risque | Sprint | Mitigation |
|---|---|---|
| Web Speech API pas supporte sur iOS Safari | 1 | Fallback : pas de feedback live, attendre Whisper. Tester iOS en priorite. |
| Binaire audio corrompu dans n8n | 1 | Tester le flux audio en premier. Si echec : proxy via API route Next.js. |
| Latence Google Drive upload (videos) | 2 | Compresser cote client, limiter a 60s, indicateur upload clair. |
| Airtable rate limit (5 req/sec) | 3+ | Batch les requetes, mettre en queue si necessaire. |
| Bruit chantier → mauvaise transcription | 4 | Tester avec vrais enregistrements AVANT le beta. Avoir Google Cloud STT en backup. |
