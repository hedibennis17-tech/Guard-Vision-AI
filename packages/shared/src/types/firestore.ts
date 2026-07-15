// Types partagés entre apps/dashboard et apps/user-app
// À affiner une fois le projet Firebase (Firestore) confirmé.

export interface UserDoc {
  id: string;
  email: string;
  displayName?: string;
  organizationId?: string;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
}

export interface OrganizationDoc {
  id: string;
  name: string;
  ownerId: string;
  planId: string;
  createdAt: string;
}

export interface CameraDoc {
  id: string;
  organizationId: string;
  name: string;
  brand: string;
  model?: string;
  connectorType:
    | "ring"
    | "nest"
    | "arlo"
    | "eufy"
    | "reolink"
    | "axis"
    | "hikvision"
    | "dahua"
    | "onvif"
    | "rtsp"
    | "usb"
    | "generic_ip";
  streamUrl?: string;
  status: "online" | "offline" | "error";
  batteryLevel?: number;
  groupId?: string;
  createdAt: string;
}

export interface DetectionDoc {
  id: string;
  cameraId: string;
  organizationId: string;
  type: "person" | "vehicle" | "animal" | "object" | "fire" | "smoke" | "license_plate";
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  snapshotUrl?: string;
  videoUrl?: string;
  timestamp: string;
}

export interface EventDoc {
  id: string;
  organizationId: string;
  cameraId: string;
  detectionIds: string[];
  severity: "info" | "warning" | "critical";
  acknowledged: boolean;
  createdAt: string;
}

export interface ReportDoc {
  id: string;
  organizationId: string;
  format: "pdf" | "excel" | "csv";
  periodStart: string;
  periodEnd: string;
  fileUrl: string;
  createdAt: string;
}

export interface MarketplaceModuleDoc {
  id: string;
  slug: "home" | "retail" | "industry" | "construction" | "smart_city";
  name: string;
  description: string;
  isActiveForOrg?: boolean;
}

export interface NotificationDoc {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
