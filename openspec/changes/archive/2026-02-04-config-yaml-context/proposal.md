# Proposal — Contextualiser OpenSpec

## Why

`openspec/config.yaml` est vide : chaque artefact créé par Claude manque du contexte
projet (domaine, stack, langue, phase). Les trois docs existants (ARCHITECTURE.md,
PRD.md, TECH_STACK_REPORT.md) contiennent exactement ces informations, mais elles
ne sont pas accessibles à OpenSpec au moment de la génération.

## What Changes

- Le champ `context` de `config.yaml` est rempli avec un résumé structuré extrait
  des trois docs.
- Aucun autre fichier n'est modifié.

## Capabilities

### New Capabilities
- `openspec-context` : OpenSpec reçoit le contexte projet (stack, domaine, phase,
  conventions) à chaque génération d'artefact.

## Impact

- `openspec/config.yaml` : ajout du bloc `context`
