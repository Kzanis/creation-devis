# Design — Contextualiser OpenSpec

## Context

`config.yaml` a un champ `context` (string libre) lu par Claude avant chaque
génération d'artefact. Il est actuellement vide.

## Goals / Non-Goals

**Goals:**
- Résumé concis (~15-20 lignes) qui couvre stack, domaine, phase, conventions
- Info extraite uniquement des docs existants — pas d'invention

**Non-Goals:**
- Reproduire les docs en entier
- Détailler chaque workflow n8n ou chaque table BDD
- Couvrir les phases V1-V4 en détail (on est en MVP)

## Decisions

### Décision : structure du résumé

Le bloc `context` sera organisé en sections courtes :
- **Domaine** — ce que fait le produit, en une phrase
- **Stack** — tableau minimal (couche → technologie)
- **Phase** — MVP, ce qui est en scope
- **Conventions** — règles d'architecture qui guident les décisions
- **Principe directeur** — la phrase clé du projet

Cette structure correspond directement aux 4 scenarios de la spec.
