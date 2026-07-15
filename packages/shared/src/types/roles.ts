/**
 * Rôles disponibles au sein d'une organisation.
 * Hiérarchie : owner > admin > manager > member > viewer
 */
export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

/**
 * Permissions granulaires — vérifiées côté Firestore Rules ET côté UI
 * (pour masquer/afficher les actions).
 */
export type Permission =
  | "org:manage" // gérer l'organisation, la facturation
  | "users:invite"
  | "users:remove"
  | "users:manage_roles"
  | "sites:manage"
  | "cameras:add"
  | "cameras:remove"
  | "cameras:view"
  | "events:view"
  | "events:manage" // acquitter, supprimer
  | "reports:generate"
  | "reports:view"
  | "analytics:view"
  | "billing:manage"
  | "marketplace:manage_modules"
  | "settings:manage";

/** Matrice rôle → permissions par défaut. Peut être surchargée par organisation. */
export const DEFAULT_ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: [
    "org:manage",
    "users:invite",
    "users:remove",
    "users:manage_roles",
    "sites:manage",
    "cameras:add",
    "cameras:remove",
    "cameras:view",
    "events:view",
    "events:manage",
    "reports:generate",
    "reports:view",
    "analytics:view",
    "billing:manage",
    "marketplace:manage_modules",
    "settings:manage",
  ],
  admin: [
    "users:invite",
    "users:remove",
    "users:manage_roles",
    "sites:manage",
    "cameras:add",
    "cameras:remove",
    "cameras:view",
    "events:view",
    "events:manage",
    "reports:generate",
    "reports:view",
    "analytics:view",
    "marketplace:manage_modules",
    "settings:manage",
  ],
  manager: [
    "sites:manage",
    "cameras:add",
    "cameras:view",
    "events:view",
    "events:manage",
    "reports:generate",
    "reports:view",
    "analytics:view",
  ],
  member: ["cameras:view", "events:view", "reports:view", "analytics:view"],
  viewer: ["cameras:view", "events:view"],
};

/**
 * User — profil utilisateur global (peut appartenir à plusieurs organisations,
 * ex: un intégrateur qui gère plusieurs clients).
 *
 * Collection Firestore: `users/{uid}` (uid = Firebase Auth UID)
 */
export interface UserDoc {
  id: string; // = Firebase Auth uid
  email: string;
  displayName?: string;
  photoUrl?: string;
  phone?: string;

  /** Organisation actuellement sélectionnée dans l'UI */
  defaultOrganizationId?: string;

  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Membership — lien entre un utilisateur et une organisation, avec son rôle.
 * Sépare l'identité (UserDoc) de l'appartenance (rôle par organisation),
 * ce qui permet à un utilisateur d'avoir des rôles différents selon l'organisation.
 *
 * Collection Firestore: `organizations/{organizationId}/members/{uid}`
 */
export interface MembershipDoc {
  userId: string;
  organizationId: string;
  role: OrgRole;
  /** Permissions additionnelles/retirées par rapport au rôle par défaut (rare) */
  permissionOverrides?: Partial<Record<Permission, boolean>>;
  invitedBy?: string;
  status: "invited" | "active" | "suspended";
  joinedAt?: string;
  createdAt: string;
}
