# Schéma Firestore & Storage (v0 — à confirmer avec le projet Firebase réel)

## Collections Firestore

- users
- organizations
- subscriptions
- plans
- roles
- permissions
- cameras
- camera_groups
- camera_brands
- camera_models
- camera_streams
- connectors
- detections
- events
- snapshots
- videos
- reports
- notifications
- analytics
- heatmaps
- ai_models
- marketplace
- modules
- licenses
- devices
- logs
- settings
- audit_logs

## Storage (buckets/dossiers)

- /users
- /avatars
- /cameras
- /snapshots
- /videos
- /reports
- /models
- /thumbnails
- /temp

## Notes

Ce schéma est un point de départ basé sur les spécifications initiales. Les types TypeScript
correspondants sont dans `packages/shared/src/types/firestore.ts` et devront être ajustés
une fois les vraies règles de sécurité et index Firestore définis.
