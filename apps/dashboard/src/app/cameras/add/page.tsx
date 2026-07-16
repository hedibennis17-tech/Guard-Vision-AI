"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

type ConnectorType =
  | "onvif" | "rtsp" | "hikvision" | "dahua"
  | "axis" | "reolink" | "ring" | "nest" | "generic_ip"
  | "phone_webcam";

type Step = "choose_connector" | "credentials" | "test" | "done";

interface ConnectorOption {
  type: ConnectorType;
  name: string;
  logo: string;
  description: string;
  requiresOAuth?: boolean;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
  required?: boolean;
}

const CONNECTORS: ConnectorOption[] = [
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "onvif",
    name: "ONVIF",
    logo: "📡",
    description: "Recherche automatique — standard pour caméras IP professionnelles",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "port",     label: "Port",           type: "number",   placeholder: "80" },
      { key: "username", label: "Utilisateur",    type: "text",     placeholder: "admin" },
      { key: "password", label: "Mot de passe",   type: "password", required: true },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "rtsp",
    name: "RTSP / IP",
    logo: "🎥",
    description: "Flux RTSP direct — compatible toutes caméras IP",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "port",     label: "Port RTSP",      type: "number",   placeholder: "554" },
      { key: "path",     label: "Chemin stream",  type: "text",     placeholder: "/stream1" },
      { key: "username", label: "Utilisateur",    type: "text" },
      { key: "password", label: "Mot de passe",   type: "password" },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "hikvision",
    name: "Hikvision",
    logo: "🔴",
    description: "Caméras Hikvision via ISAPI (API officielle)",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "port",     label: "Port HTTP",      type: "number",   placeholder: "80" },
      { key: "channel",  label: "Canal",          type: "number",   placeholder: "1" },
      { key: "username", label: "Utilisateur",    type: "text",     placeholder: "admin" },
      { key: "password", label: "Mot de passe",   type: "password", required: true },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "dahua",
    name: "Dahua",
    logo: "🔵",
    description: "Caméras Dahua via HTTP SDK",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "port",     label: "Port HTTP",      type: "number",   placeholder: "80" },
      { key: "channel",  label: "Canal",          type: "number",   placeholder: "1" },
      { key: "username", label: "Utilisateur",    type: "text",     placeholder: "admin" },
      { key: "password", label: "Mot de passe",   type: "password", required: true },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "axis",
    name: "Axis",
    logo: "🟠",
    description: "Caméras Axis Communications via VAPIX",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "username", label: "Utilisateur",    type: "text",     placeholder: "root" },
      { key: "password", label: "Mot de passe",   type: "password", required: true },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "reolink",
    name: "Reolink",
    logo: "🟢",
    description: "Caméras Reolink via API JSON propriétaire",
    fields: [
      { key: "host",     label: "Adresse IP",    type: "text",     placeholder: "192.168.1.100", required: true },
      { key: "username", label: "Utilisateur",    type: "text",     placeholder: "admin" },
      { key: "password", label: "Mot de passe",   type: "password", required: true },
    ],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "ring",
    name: "Ring",
    logo: "💍",
    description: "Sonnettes et caméras Ring via OAuth2",
    requiresOAuth: true,
    fields: [],
  },
  {
    type: "phone_webcam",
    name: "Téléphone / Webcam",
    logo: "📱",
    description: "Caméra de votre téléphone ou webcam — parfait pour tester Vision Guard sans matériel",
    fields: [],
    isPhoneCamera: true,
  } as any,
  {
    type: "nest",
    name: "Google Nest",
    logo: "🏡",
    description: "Caméras Nest via Google Smart Device Management",
    requiresOAuth: true,
    fields: [],
  },
];

const STEP_LABELS: Record<Step, string> = {
  choose_connector: "1. Choisir le connecteur",
  credentials: "2. Configurer la connexion",
  test: "3. Tester la connexion",
  done: "4. Caméra ajoutée",
};

export default function AddCameraPage() {
  const [step, setStep] = useState<Step>("choose_connector");
  const [selected, setSelected] = useState<ConnectorOption | null>(null);
  const [cameraName, setCameraName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  // Découverte ONVIF automatique
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{ name: string; host: string; manufacturer?: string }[]>([]);

  const router = useRouter();

  function handleSelectConnector(connector: ConnectorOption) {
    // Caméra téléphone → page dédiée avec WebRTC
    if ((connector as any).type === "phone_webcam") {
      router.push("/cameras/phone");
      return;
    }
    setSelected(connector);
    setCredentials({});
    setStep("credentials");
  }

  async function handleDiscover() {
    setDiscovering(true);
    setDiscovered([]);
    // En production : appeler la Cloud Function discoverCameras()
    await new Promise((r) => setTimeout(r, 1500));
    setDiscovered([
      { name: "IPCamera_Demo_01", host: "192.168.1.101", manufacturer: "Hikvision" },
      { name: "IPCamera_Demo_02", host: "192.168.1.102", manufacturer: "Dahua" },
    ]);
    setDiscovering(false);
  }

  async function handleTest() {
    if (!selected) return;
    setTestStatus("testing");
    setTestMessage("Connexion en cours...");

    // En production : appeler la Cloud Function connectCamera()
    await new Promise((r) => setTimeout(r, 2000));

    const success = credentials.host || selected.requiresOAuth;
    if (success) {
      setTestStatus("success");
      setStreamUrl(`rtsp://${credentials.username || "admin"}:***@${credentials.host || "cloud"}:554/stream1`);
      setTestMessage("Connexion réussie — flux détecté.");
    } else {
      setTestStatus("error");
      setTestMessage("Adresse IP introuvable ou identifiants incorrects.");
    }
  }

  function handleSave() {
    // En production : appeler addCamera() puis connectCamera() via Firebase
    setStep("done");
  }

  return (
    <div>
      <PageHeader
        title="Ajouter une caméra"
        description="Connecteur universel — RTSP, ONVIF, Hikvision, Dahua, Ring, Nest et plus."
      />

      {/* Stepper */}
      <div className="mb-8 flex gap-0">
        {(Object.keys(STEP_LABELS) as Step[]).map((s, i, arr) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                step === s
                  ? "bg-brand text-white"
                  : i < arr.indexOf(step)
                  ? "text-emerald-400"
                  : "text-slate-600"
              }`}
            >
              <span className="h-4 w-4 rounded-full border text-center leading-4
                {step === s ? 'border-white' : 'border-current'}">
                {i + 1}
              </span>
              {STEP_LABELS[s]}
            </div>
            {i < arr.length - 1 && <div className="h-px w-4 bg-slate-800" />}
          </div>
        ))}
      </div>

      {/* Étape 1 — Choisir le connecteur */}
      {step === "choose_connector" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">Choisissez le type de caméra à connecter.</p>
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {discovering ? "Recherche..." : "🔍 Recherche automatique ONVIF"}
            </button>
          </div>

          {discovered.length > 0 && (
            <div className="mb-6 rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-4">
              <p className="mb-3 text-xs font-medium text-emerald-400">{discovered.length} caméra(s) détectée(s) sur le réseau :</p>
              <div className="space-y-2">
                {discovered.map((d) => (
                  <button
                    key={d.host}
                    onClick={() => {
                      const onvif = CONNECTORS.find((c) => c.type === "onvif")!;
                      setSelected(onvif);
                      setCredentials({ host: d.host });
                      setStep("credentials");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg bg-slate-900 px-3 py-2 text-left text-sm hover:border-brand border border-slate-800"
                  >
                    <span>📡</span>
                    <span className="font-medium text-white">{d.name}</span>
                    <span className="text-slate-400">{d.host}</span>
                    {d.manufacturer && <span className="ml-auto text-xs text-slate-500">{d.manufacturer}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.type}
                onClick={() => handleSelectConnector(connector)}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-brand"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{connector.logo}</span>
                  <span className="font-medium text-white">{connector.name}</span>
                  {(connector as any).type === "phone_webcam" && (
                    <span className="ml-auto rounded-full bg-emerald-500/10 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">✅ Test rapide</span>
                  )}
                  {connector.requiresOAuth && (
                    <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">OAuth</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{connector.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Étape 2 — Credentials */}
      {step === "credentials" && selected && (
        <div className="max-w-lg">
          <div className="mb-6 flex items-center gap-2">
            <span className="text-2xl">{selected.logo}</span>
            <h2 className="text-lg font-medium text-white">{selected.name}</h2>
            <button onClick={() => setStep("choose_connector")} className="ml-auto text-xs text-slate-500 hover:text-slate-300">
              ← Changer
            </button>
          </div>

          {selected.requiresOAuth ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <p className="mb-4 text-sm text-slate-400">
                {selected.name} utilise une authentification OAuth2.<br />
                Vous serez redirigé vers {selected.name} pour autoriser l'accès.
              </p>
              <button
                onClick={() => setStep("test")}
                className="rounded-lg bg-brand px-6 py-2 text-sm font-medium text-white"
              >
                Connecter {selected.name} →
              </button>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nom de la caméra *</label>
                <input
                  type="text"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  placeholder="ex: Entrée principale"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </div>
              {selected.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs text-slate-400">
                    {field.label} {field.required && "*"}
                  </label>
                  <input
                    type={field.type}
                    value={credentials[field.key] ?? ""}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                  />
                </div>
              ))}
              <button
                onClick={() => setStep("test")}
                className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white"
              >
                Continuer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Étape 3 — Test de connexion */}
      {step === "test" && selected && (
        <div className="max-w-lg">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-base font-medium text-white">Test de connexion — {selected.name}</h2>

            {testStatus === "idle" && (
              <button
                onClick={handleTest}
                className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white"
              >
                Lancer le test
              </button>
            )}

            {testStatus === "testing" && (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                {testMessage}
              </div>
            )}

            {testStatus === "success" && (
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm text-emerald-400">
                  <span>✅</span> {testMessage}
                </div>
                {streamUrl && (
                  <div className="mb-4 rounded-lg bg-slate-950 px-3 py-2">
                    <p className="mb-1 text-xs text-slate-500">Stream URL détectée</p>
                    <code className="text-xs text-slate-300">{streamUrl}</code>
                  </div>
                )}
                {/* Aperçu live placeholder */}
                <div className="mb-4 flex aspect-video items-center justify-center rounded-lg bg-black text-xs text-slate-600">
                  Aperçu Live — Phase 4 (Live Stream Manager)
                </div>
                <button
                  onClick={handleSave}
                  className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white"
                >
                  Enregistrer la caméra
                </button>
              </div>
            )}

            {testStatus === "error" && (
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm text-red-400">
                  <span>❌</span> {testMessage}
                </div>
                <button
                  onClick={() => { setTestStatus("idle"); setStep("credentials"); }}
                  className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300"
                >
                  ← Modifier les paramètres
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Étape 4 — Done */}
      {step === "done" && (
        <div className="max-w-lg rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-8 text-center">
          <span className="text-4xl">✅</span>
          <h2 className="mt-3 text-lg font-semibold text-white">
            {cameraName || "Caméra"} ajoutée avec succès
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Elle apparaîtra dans Live Monitor dès que le flux sera confirmé par le système.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => { setStep("choose_connector"); setSelected(null); setCameraName(""); setTestStatus("idle"); }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
            >
              Ajouter une autre caméra
            </button>
            <a href="/cameras" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Voir mes caméras →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
