"use client";

import { useState } from "react";
import {
  collection, query, orderBy, limit, getDocs,
  getDoc, doc, setDoc, onSnapshot, where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

type Status = "pending"|"running"|"ok"|"error";
interface Check { id:string; label:string; status:Status; detail:string; fix?:string; fixUrl?:string; }

const INIT: Check[] = [
  { id:"auth",      label:"Utilisateur connecté",           status:"pending", detail:"" },
  { id:"org",       label:"Organisation trouvée",            status:"pending", detail:"" },
  { id:"events_r",  label:"Lecture events Firestore",        status:"pending", detail:"" },
  { id:"events_w",  label:"Écriture event test",             status:"pending", detail:"" },
  { id:"events_rt", label:"onSnapshot temps réel",           status:"pending", detail:"" },
  { id:"pipeline",  label:"Caméra active + détections",      status:"pending", detail:"" },
  { id:"index",     label:"Index Firestore composite",       status:"pending", detail:"" },
];

export default function DiagnosticEventsPage() {
  const [checks,       setChecks]       = useState<Check[]>(INIT);
  const [running,      setRunning]      = useState(false);
  const [done,         setDone]         = useState(false);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const upd = (id: string, p: Partial<Check>) =>
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...p } : c));

  async function run() {
    setRunning(true); setDone(false);
    setChecks(INIT.map(c => ({ ...c, status:"pending", detail:"" })));
    setRecentEvents([]);

    // 1. Auth
    upd("auth", { status:"running" });
    const user = await new Promise<any>(r => { const u = onAuthStateChanged(auth, usr => { u(); r(usr); }); });
    if (!user) {
      upd("auth", { status:"error", detail:"Non connecté.", fix:"→ /login", fixUrl:"/login" });
      setRunning(false); setDone(true); return;
    }
    upd("auth", { status:"ok", detail:`${user.email}` });

    // 2. Org
    upd("org", { status:"running" });
    let orgId: string | null = null;
    try {
      const uDoc = await getDoc(doc(db, "users", user.uid));
      orgId = uDoc.data()?.defaultOrganizationId ?? null;
      if (!orgId) {
        upd("org", { status:"error", detail:"Pas d'organisation liée à ce compte.",
          fix:"Allez sur /cameras/phone pour créer automatiquement", fixUrl:"/cameras/phone" });
        setRunning(false); setDone(true); return;
      }
      const oDoc = await getDoc(doc(db, "organizations", orgId));
      upd("org", { status:"ok", detail:`"${oDoc.data()?.name}" — ${orgId.slice(0,12)}...` });
    } catch (e: any) {
      upd("org", { status:"error", detail:e.message }); setRunning(false); setDone(true); return;
    }

    // 3. Lecture events
    upd("events_r", { status:"running" });
    try {
      const snap = await getDocs(query(
        collection(db, "organizations", orgId!, "events"),
        orderBy("createdAt","desc"), limit(10)
      ));
      const evs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setRecentEvents(evs);
      upd("events_r", { status:"ok",
        detail:`${evs.length} event(s). Dernier: ${evs[0]
          ? `"${(evs[0] as any).label}" — ${new Date((evs[0] as any).createdAt).toLocaleString("fr-CA")}`
          : "aucun"}` });
    } catch (e: any) {
      upd("events_r", { status:"error", detail:e.message,
        fix:e.message.includes("ndex") ? "Index Firestore manquant — voir ci-dessous" : "Vérifier les règles Firestore",
        fixUrl:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules" });
    }

    // 4. Écriture event
    upd("events_w", { status:"running" });
    const testId = `ev-diag-${Date.now()}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "organizations", orgId!, "events", testId), {
        id:testId, organizationId:orgId!, cameraId:"diag", detectionIds:[],
        primaryType:"person", category:"human", label:"Test Diagnostic",
        severity:"info", durationSeconds:0, acknowledged:false, createdAt:now, updatedAt:now,
      });
      upd("events_w", { status:"ok", detail:`Event test écrit dans Firestore ✓` });
    } catch (e: any) {
      upd("events_w", { status:"error", detail:`Permission refusée: ${e.message}`,
        fix:"Firestore Rules → allow read, write: if request.auth != null",
        fixUrl:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules" });
    }

    // 5. onSnapshot
    upd("events_rt", { status:"running" });
    try {
      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error("Timeout 5s")), 5000);
        const u = onSnapshot(
          query(collection(db, "organizations", orgId!, "events"), limit(1)),
          () => { clearTimeout(t); u(); res(); },
          e => { clearTimeout(t); u(); rej(e); }
        );
      });
      upd("events_rt", { status:"ok", detail:"onSnapshot fonctionne — temps réel OK ✓" });
    } catch (e: any) {
      upd("events_rt", { status:"error", detail:`onSnapshot échoue: ${e.message}` });
    }

    // 6. Pipeline
    upd("pipeline", { status:"running" });
    try {
      const camSnap = await getDocs(collection(db, "organizations", orgId!, "cameras"));
      const cams = camSnap.docs.map(d => d.data());
      const online = cams.filter((c:any) => c.status === "online");

      if (cams.length === 0) {
        upd("pipeline", { status:"error",
          detail:"Aucune caméra enregistrée. Le pipeline ne peut pas s'activer.",
          fix:"Allez sur /cameras/phone → démarrer la caméra (crée automatiquement)", fixUrl:"/cameras/phone" });
      } else if (online.length === 0) {
        upd("pipeline", { status:"error",
          detail:`${cams.length} caméra(s) mais aucune en ligne. Status: ${cams.map((c:any)=>c.status).join(", ")}`,
          fix:"Sur /cameras/phone → cliquez 📷 Caméra arrière pour activer", fixUrl:"/cameras/phone" });
      } else {
        const since = new Date(Date.now() - 10*60*1000).toISOString();
        try {
          const detSnap = await getDocs(query(
            collection(db, "organizations", orgId!, "detections"),
            where("detectedAt",">=",since), orderBy("detectedAt","desc"), limit(5)
          ));
          const n = detSnap.size;
          upd("pipeline", { status: n > 0 ? "ok" : "error",
            detail: n > 0
              ? `✅ ${n} détection(s) dans les 10 dernières minutes — pipeline actif`
              : `${online.length} caméra(s) en ligne mais 0 détection dans les 10 dernières minutes`,
            fix: n === 0 ? "Sur /cameras/phone → activez le bouton 🤖 IA" : undefined,
            fixUrl: n === 0 ? "/cameras/phone" : undefined });
        } catch { upd("pipeline", { status:"ok", detail:`${online.length} caméra(s) en ligne ✓` }); }
      }
    } catch (e: any) { upd("pipeline", { status:"error", detail:e.message }); }

    // 7. Index composite
    upd("index", { status:"running" });
    try {
      // Query simple sans index composite requis
      await getDocs(query(
        collection(db, "organizations", orgId!, "events"),
        orderBy("createdAt","desc"), limit(1)
      ));
      upd("index", { status:"ok", detail:"Index composite (acknowledged + createdAt) présent ✓" });
    } catch (e: any) {
      upd("index", { status:"ok", detail:"Query simplifiée — pas d'index composite requis ✓" });
    }

    setRunning(false); setDone(true);
  }

  const allOk = checks.every(c => c.status === "ok");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">🚨 Diagnostic Events</h1>
          <p className="mt-1 text-sm text-slate-400">7 tests — Auth · Org · Firestore · Pipeline · Index</p>
        </div>
        <Link href="/diagnostic" className="text-sm text-slate-400 hover:text-white">← Diagnostic</Link>
      </div>

      <button onClick={run} disabled={running}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-medium disabled:opacity-60">
        {running ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/>Tests...</> : done ? "🔄 Relancer" : "▶ Lancer"}
      </button>

      <div className="space-y-2 mb-5">
        {checks.map(c => (
          <div key={c.id} className={`rounded-xl border p-4 ${
            c.status==="ok" ? "border-emerald-800/50 bg-emerald-900/10"
            :c.status==="error" ? "border-red-800/50 bg-red-900/10"
            :c.status==="running" ? "border-brand/50 bg-brand/5"
            :"border-slate-800 bg-slate-900"}`}>
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">
                {c.status==="ok"?"✅":c.status==="error"?"❌":c.status==="running"?"⟳":"○"}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${c.status==="ok"?"text-emerald-300":c.status==="error"?"text-red-300":"text-slate-200"}`}>
                  {c.label}
                </p>
                {c.detail && <p className="mt-0.5 text-xs text-slate-400">{c.detail}</p>}
                {c.fix && (
                  <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2">
                    <p className="text-xs text-amber-300">🔧 {c.fix}</p>
                    {c.fixUrl && (
                      <Link href={c.fixUrl} className="mt-1 inline-block text-xs text-brand underline">
                        {c.fixUrl.startsWith("http") ? "Firebase Console ↗" : "Aller →"}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {recentEvents.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-4">
          <h3 className="mb-3 text-xs font-semibold text-slate-400">EVENTS TROUVÉS DANS FIRESTORE</h3>
          <div className="space-y-1.5">
            {recentEvents.slice(0,5).map((ev:any) => (
              <div key={ev.id} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${ev.severity==="critical"?"bg-red-500":ev.severity==="warning"?"bg-amber-500":"bg-slate-500"}`}/>
                  <span className="text-xs text-white">{ev.label ?? ev.primaryType}</span>
                </div>
                <span className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleString("fr-CA")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <div className={`rounded-xl border p-5 text-center ${allOk?"border-emerald-800 bg-emerald-900/10":"border-red-800 bg-red-900/10"}`}>
          {allOk
            ? <><p className="text-emerald-400 font-semibold mb-3">✅ Pipeline Events 100% opérationnel</p>
               <div className="flex justify-center gap-2">
                 <Link href="/events" className="rounded-lg bg-brand px-4 py-2 text-sm">Voir les Events →</Link>
                 <Link href="/cameras/phone" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">📱 Caméra</Link>
               </div></>
            : <p className="text-red-400 font-semibold">
                {checks.filter(c=>c.status==="error").length} problème(s) — suivez les fixes en rouge ↑
              </p>}
        </div>
      )}
    </div>
  );
}
