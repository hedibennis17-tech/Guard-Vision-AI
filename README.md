# Vision Guard AI Platform

Plateforme AI Vision modulaire (type "Tesla" : un seul moteur IA, plusieurs modules verticaux).

Modules prévus : Home → Retail → Industry → Construction → Smart City.
Tous partagent le même moteur de détection (YOLOv11 + OpenCV) et le même backend Firebase.

## Structure du monorepo

```
visionguard/
├── apps/
│   ├── dashboard/     → Web Dashboard (Admin / Organisations)
│   └── user-app/      → Application Web Utilisateur (grand public)
├── packages/
│   └── shared/        → Types, config Firebase, composants partagés
└── docs/              → Architecture, schéma Firestore, roadmap modules
```

## Stack

- **Frontend** : Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend** : Firebase (Auth, Firestore, Storage, Cloud Functions, FCM)
- **AI Engine** : Python + YOLOv11 + OpenCV (service séparé, non inclus dans ce monorepo web)
- **Déploiement** : Vercel (dashboard + user-app), Firebase (backend)

## Démarrage rapide

```bash
npm install
npm run dev:dashboard   # http://localhost:3000
npm run dev:user        # http://localhost:3001
```

## Variables d'environnement

Chaque app a besoin d'un `.env.local` (voir `.env.example` dans chaque app) avec la config Firebase du projet.
Ces valeurs seront ajoutées dès que le projet Firebase (Firestore + Storage) sera fourni.

## Roadmap modules (Marketplace)

| Ordre | Module | Statut |
|---|---|---|
| 1 | Vision Guard Home | 🚧 En cours |
| 2 | Vision Guard Retail | Planifié |
| 3 | Vision Guard Industry | Planifié |
| 4 | Vision Guard Construction | Planifié |
| 5 | Vision Guard Smart City | Planifié |

Voir `docs/ARCHITECTURE.md` pour le détail complet.
