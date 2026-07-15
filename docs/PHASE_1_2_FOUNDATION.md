# Phase 1 & 2 — Fondation (complété)

Ce document trace ce qui a été posé comme fondation avant tout développement de nouvelles pages,
conformément à la décision : **architecture d'abord, fonctionnalités ensuite.**

## Décisions actées

- **Base de données : Firestore** (pas PostgreSQL/Prisma) — déjà scaffoldé, cohérent avec Next.js + Firebase Auth/Storage/FCM déjà en place. Décision prise le 15 juillet 2026.
- **Exécution : dans cet environnement**, pas Replit.

## Phase 1 — Architecture des données

Hiérarchie implémentée dans `packages/shared/src/types/` :

```
Organization (organizations/{orgId})
  ├── Members / Roles         → roles.ts (RBAC: owner/admin/manager/member/viewer)
  ├── Sites                   → organization.ts
  ├── Cameras                 → camera.ts (indépendant du connecteur ET de YOLO)
  ├── Camera Credentials      → camera.ts (jamais exposé côté client)
  ├── Detections               → event.ts (sortie brute YOLO)
  ├── Events                   → event.ts (agrégation de détections)
  ├── Notifications             → event.ts
  ├── Reports                   → event.ts
  ├── Modules (marketplace)     → marketplace.ts
  └── Subscription               → subscription.ts (1:1 avec l'organisation)
```

Fichiers créés :
- `packages/shared/src/types/organization.ts`
- `packages/shared/src/types/roles.ts` — RBAC + matrice de permissions par défaut
- `packages/shared/src/types/subscription.ts` — plans + fonctions `canAddCamera/Site/User`
- `packages/shared/src/types/camera.ts`
- `packages/shared/src/types/event.ts` — Detection, Event, Notification, Report
- `packages/shared/src/types/marketplace.ts`

Sécurité :
- `firestore.rules` — RBAC appliqué au niveau base de données, pas seulement UI
- `storage.rules` — accès fichiers scoppé par organisation
- `firestore.indexes.json` — index composites de base (events/detections/notifications)
- `firebase.json` — relie rules, indexes, functions, émulateurs

## Phase 2 — Abonnements

Plans définis dans `subscription.ts` : **Free (1 caméra) / Home (5) / Pro (10) / Business (20) / Enterprise (illimité)**.

Application automatique des limites :
- `functions/src/http/addCamera.ts` — Cloud Function callable, seul point d'entrée pour ajouter une caméra. Vérifie le rôle ET le quota du plan dans une transaction Firestore avant de créer le document.
- `functions/src/triggers/onOrganizationCreated.ts` — crée automatiquement l'abonnement "free" et le membership "owner" dès qu'une organisation est créée. Garantit qu'aucune organisation n'existe sans abonnement.

## Ce qui n'est PAS encore fait (volontairement)

- Camera Connector Engine réel (Phase 3) — `addCamera` crée le document avec `status: "connecting"` mais ne se connecte à aucun flux pour l'instant.
- Live Stream Manager (Phase 4)
- Intégration YOLO (Phase 5)
- Event Engine d'agrégation automatique (Phase 6) — le modèle de données existe, la logique d'agrégation non
- Notifications push/email (Phase 7)
- Génération de rapports (Phase 8)
- Dashboards analytics connectés (Phase 9)
- Activation réelle des modules Marketplace (Phase 10)

## Prochaine étape proposée

**Phase 3 — Camera Connector Engine**, comme identifié dans le plan : c'est le module dont dépend tout le reste (Live Streaming, YOLO, Events).
