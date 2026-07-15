# Modèles YOLOv11

Ce dossier contient les modèles YOLOv11 utilisés par le AI Engine.
Les fichiers `.pt` ne sont pas commités dans le repo (trop lourds — .gitignore).

## Téléchargement automatique

Le modèle se télécharge automatiquement depuis Ultralytics au premier lancement :

```bash
# Dans le conteneur ou l'environnement Python
python -c "from ultralytics import YOLO; YOLO('yolo11m.pt')"
```

## Modèles disponibles

| Fichier       | Taille | Vitesse | Précision | Usage recommandé       |
|---------------|--------|---------|-----------|------------------------|
| yolo11n.pt    | 2.6 MB | ⚡⚡⚡⚡  | ⭐⭐       | Raspberry Pi, embarqué |
| yolo11s.pt    | 9.4 MB | ⚡⚡⚡    | ⭐⭐⭐      | CPU serveur léger      |
| yolo11m.pt    | 20 MB  | ⚡⚡     | ⭐⭐⭐⭐    | **Recommandé** GPU/CPU |
| yolo11l.pt    | 25 MB  | ⚡       | ⭐⭐⭐⭐⭐   | GPU dédié              |
| yolo11x.pt    | 56 MB  | 🐢       | ⭐⭐⭐⭐⭐   | Précision maximale     |

## Modèles custom (Marketplace — Phase 10)

Pour les modules verticaux (Retail, Construction, Industry...), des modèles
fine-tunés seront placés ici avec leurs propres classes de détection :

- `yolo11m-fire-smoke.pt`    → Vision Guard Home (feu, fumée)
- `yolo11m-retail.pt`        → Vision Guard Retail (produits, rayons)
- `yolo11m-ppe.pt`           → Vision Guard Industry (EPI)
- `yolo11m-construction.pt`  → Vision Guard Construction

Le `DetectionEngine` chargera le bon modèle selon le module activé
dans `organizations/{orgId}/modules`.
