# Architecture Vision Guard AI Platform

## Vue d'ensemble

```
VISION GUARD AI PLATFORM
├── Landing Website
├── Mobile Application
├── Web Dashboard          → apps/dashboard
├── AI Engine              → service Python séparé (YOLOv11 + OpenCV)
├── Camera Connector Engine
├── Notification Center
├── Analytics Engine
├── Reporting Engine
├── AI Assistant
├── Marketplace
└── API Platform
```

## Backend flow

```
Firebase
  → Authentication
  → Firestore
  → Storage
  → Cloud Functions
  → FCM
  → Python AI Server
    → YOLOv11
    → OpenCV
  → Camera Connectors
  → Dashboard / User App
```

## Camera Connectors supportés (roadmap)

Ring, Nest, Arlo, Eufy, Reolink, Axis, Hikvision, Dahua, ONVIF, RTSP, USB, Generic IP.

## Modules Marketplace (même moteur, modules différents)

- **Vision Guard Home** — détection de mouvement, surveillance résidentielle, alertes, rapports
- **Vision Guard Retail** — détection produits, self-checkout, ruptures de stock, prévention des pertes
- **Vision Guard Industry** — EPI, détection fumée, zones dangereuses, comptage travailleurs
- **Vision Guard Construction** — suivi engins, détection chutes, zones interdites
- **Vision Guard Smart City** — trafic, stationnement, comptage piétons, intersections

Voir `docs/FIRESTORE_SCHEMA.md` pour le détail des collections.
