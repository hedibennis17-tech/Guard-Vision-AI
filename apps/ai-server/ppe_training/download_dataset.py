"""
Téléchargement du dataset PPE depuis Roboflow
À exécuter sur Railway ou localement avec une clé API Roboflow gratuite

Clé API gratuite: https://app.roboflow.com (inscription gratuite)
"""
import os, sys

def download_ppe_dataset(api_key: str, output_dir: str = "ppe_dataset"):
    """
    Télécharge le meilleur dataset PPE public depuis Roboflow
    
    Datasets recommandés:
    - roboflow-universe/ppe-datasets (le plus complet)
    - hardhat-safety-vest-detection (construction)
    - construction-site-safety (chantier)
    """
    try:
        from roboflow import Roboflow
        rf = Roboflow(api_key=api_key)
        
        # Dataset 1: PPE Detection complet (casque + gilet + boots + gloves)
        print("📥 Téléchargement dataset PPE Construction...")
        project = rf.workspace("roboflow-universe-datasets").project("ppe-detection-nf06a")
        dataset  = project.version(4).download("yolov8", location=f"{output_dir}/construction")
        print(f"✅ Construction: {dataset.location}")
        
        # Dataset 2: Safety Equipment Detection (industriel)
        print("📥 Téléchargement dataset Safety Equipment...")
        project2 = rf.workspace("roboflow-universe-datasets").project("safety-equipment-detection-6cnhb")
        dataset2  = project2.version(1).download("yolov8", location=f"{output_dir}/industrial")
        print(f"✅ Industrial: {dataset2.location}")
        
        return dataset.location, dataset2.location
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        print("→ Vérifiez votre clé API sur https://app.roboflow.com")
        return None, None


if __name__ == "__main__":
    api_key = os.environ.get("ROBOFLOW_API_KEY") or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not api_key:
        print("❌ Clé API manquante")
        print("Usage: python download_dataset.py VOTRE_CLE_API")
        print("Clé gratuite sur: https://app.roboflow.com")
        sys.exit(1)
    download_ppe_dataset(api_key)
