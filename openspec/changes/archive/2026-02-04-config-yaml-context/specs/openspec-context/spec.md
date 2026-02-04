# Spec — openspec-context

## ADDED Requirements

### Requirement: Contexte projet dans config.yaml

Le bloc `context` de `openspec/config.yaml` doit contenir un résumé
structuré du projet, extrait des docs existants.

#### Scenario: Résumé couvre la stack

- WHEN un artefact OpenSpec est créé
- THEN le contexte inclut la stack complète (Frontend, Backend, BDD, APIs)

#### Scenario: Résumé couvre le domaine

- WHEN un artefact OpenSpec est créé
- THEN le contexte précise le domaine (assistant vocal chantier BTP, français)

#### Scenario: Résumé couvre la phase actuelle

- WHEN un artefact OpenSpec est créé
- THEN le contexte indique la phase en cours (MVP)

#### Scenario: Résumé couvre les conventions clés

- WHEN un artefact OpenSpec est créé
- THEN le contexte mentionne les conventions (reads via SDK direct,
  writes via webhooks n8n, validation humaine toujours requise)
