/**
 * StorageService — Abstraction multi-provider pour les clips vidéo
 *
 * Providers supportés :
 *   - "firebase"    → Firebase Storage (Google Cloud) — défaut
 *   - "cloudflare"  → Cloudflare R2 (gratuit 10GB, zéro egress fees) ⭐ Recommandé
 *   - "aws"         → AWS S3
 *   - "backblaze"   → Backblaze B2 (le moins cher après R2)
 *
 * Config dans .env.local :
 *   NEXT_PUBLIC_CLIP_STORAGE_PROVIDER=cloudflare
 *   NEXT_PUBLIC_R2_ACCOUNT_ID=your_account_id
 *   NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxx.r2.dev
 *   NEXT_PUBLIC_R2_BUCKET=visionguard-clips
 *   (La clé secrète R2 doit être dans une Cloud Function ou API Route — jamais côté client)
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

export type StorageProvider = "firebase" | "cloudflare" | "aws" | "backblaze";

export interface UploadClipOptions {
  blob:           Blob;
  organizationId: string;
  cameraId:       string;
  eventId:        string;
  mimeType:       string;
}

export interface UploadClipResult {
  url:        string;
  provider:   StorageProvider;
  path:       string;
  sizeKb:     number;
}

/** Provider actif — configurable via env var */
export function getActiveProvider(): StorageProvider {
  const env = process.env.NEXT_PUBLIC_CLIP_STORAGE_PROVIDER as StorageProvider;
  return env ?? "firebase";
}

/**
 * Upload un clip vers le provider configuré.
 * Retourne l'URL publique du clip.
 */
export async function uploadClip(options: UploadClipOptions): Promise<UploadClipResult> {
  const { blob, organizationId, cameraId, eventId, mimeType } = options;
  const ext      = mimeType.includes("mp4") ? "mp4" : "webm";
  const filename = `${eventId}.${ext}`;
  const path     = `organizations/${organizationId}/clips/${cameraId}/${filename}`;
  const provider = getActiveProvider();
  const sizeKb   = Math.round(blob.size / 1024);

  switch (provider) {
    // ── Firebase Storage (défaut) ──────────────────────────────────────
    case "firebase": {
      const sRef = ref(storage, path);
      await uploadBytes(sRef, blob, { contentType: mimeType });
      const url = await getDownloadURL(sRef);
      return { url, provider, path, sizeKb };
    }

    // ── Cloudflare R2 ─────────────────────────────────────────────────
    // Cloudflare R2 supporte l'API S3. Pour uploader depuis le navigateur,
    // on passe par une API Route Next.js (la clé R2 reste côté serveur).
    case "cloudflare": {
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("path", path);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body:   formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`R2 upload failed: ${err.message ?? res.statusText}`);
      }

      const { url } = await res.json();
      return { url, provider, path, sizeKb };
    }

    // ── AWS S3 ────────────────────────────────────────────────────────
    case "aws": {
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("path", path);
      formData.append("provider", "aws");

      const res = await fetch("/api/storage/upload", { method:"POST", body:formData });
      if (!res.ok) throw new Error(`S3 upload failed: ${res.statusText}`);
      const { url } = await res.json();
      return { url, provider, path, sizeKb };
    }

    // ── Backblaze B2 ──────────────────────────────────────────────────
    case "backblaze": {
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("path", path);
      formData.append("provider", "backblaze");

      const res = await fetch("/api/storage/upload", { method:"POST", body:formData });
      if (!res.ok) throw new Error(`B2 upload failed: ${res.statusText}`);
      const { url } = await res.json();
      return { url, provider, path, sizeKb };
    }

    default:
      throw new Error(`Provider non supporté: ${provider}`);
  }
}

/**
 * Coût estimé mensuel selon le provider.
 * (Basé sur 1000 clips/mois de ~5MB chacun = 5GB)
 */
export const PROVIDER_INFO = {
  firebase: {
    name:        "Firebase Storage (Google Cloud)",
    icon:        "🔥",
    storageCost: "$0.026/GB",
    egressCost:  "$0.12/GB",
    freeQuota:   "5GB stockage, 1GB/jour téléchargement",
    estimated:   "~$1.50/mois pour 5GB clips",
    recommended: false,
    setup:       "Déjà configuré — aucune action requise",
  },
  cloudflare: {
    name:        "Cloudflare R2",
    icon:        "☁️",
    storageCost: "$0.015/GB",
    egressCost:  "$0.00 (gratuit!)",
    freeQuota:   "10GB gratuit, 10M requêtes/mois",
    estimated:   "Gratuit jusqu'à 10GB de clips",
    recommended: true,
    setup:       "cloudflare.com → R2 → Create bucket → Générer clé API",
  },
  aws: {
    name:        "AWS S3",
    icon:        "🟡",
    storageCost: "$0.023/GB",
    egressCost:  "$0.09/GB",
    freeQuota:   "5GB gratuit (12 mois)",
    estimated:   "~$1.30/mois pour 5GB clips",
    recommended: false,
    setup:       "aws.amazon.com → S3 → Create bucket → IAM user",
  },
  backblaze: {
    name:        "Backblaze B2",
    icon:        "💾",
    storageCost: "$0.006/GB",
    egressCost:  "$0.01/GB",
    freeQuota:   "10GB gratuit",
    estimated:   "~$0.03/mois pour 5GB clips",
    recommended: false,
    setup:       "backblaze.com → B2 Cloud Storage → Create bucket",
  },
} as const;
