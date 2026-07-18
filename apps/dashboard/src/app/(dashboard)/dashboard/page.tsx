"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, orderBy, limit, onSnapshot, getDocs, getDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/context/AuthContext";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";

interface Stats {
  orgs:         number;
  cameras:      number;
  events_24h:   number;
  critical_open:number;
  detections_1h:number;
  clips:        number;
  modules:      number;
}

interface RecentEvent {
  id:string; label:string; category:VGCategory; severity:string;
  createdAt:string; videoClipUrl?:string; thumbnailUrl?:string;
}

interface ActivityItem { time:string; label:string; icon:string; color:string; }

export default function DashboardPage() {
  const { profile, isSuperAdmin } = useAuth();
  const [stats,    setStats]    = useState<Stats|null>(null);
  const [events,   setEvents]   = useState<RecentEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [orgId,    setOrgId]    = useState<string|null>(null);
  const [loading,  setLoading]  = useState(true);

  // Trouver l'org de l'utilisateur
  useEffect(()=>{
    const user = auth.currentUser;
    if(!user) return;
    (async()=>{
      try {
        const userDoc = await getDoc(doc(db,"users",user.uid));
        const defaultOrg = userDoc.data()?.defaultOrganizationId;

        // Scanner les orgs membres
        const allOrgs = await getDocs(collection(db,"organizations"));
        let bestOrgId: string|null = null;
        let bestCount = -1;

        for(const orgDoc of allOrgs.docs){
          const isDiag = orgDoc.id.includes("diag") ||
            (orgDoc.data()?.name||"").toLowerCase().includes("diagnostic") ||
            (orgDoc.data()?.name||"").toLowerCase().includes("test");
          if(isDiag) continue;

          const memberDoc = await getDoc(doc(db,"organizations",orgDoc.id,"members",user.uid));
          if(!memberDoc.exists()) continue;

          // Compter les events
          const evSnap = await getDocs(collection(db,"organizations",orgDoc.id,"events"));
          if(evSnap.size>bestCount){
            bestCount = evSnap.size;
            bestOrgId = orgDoc.id;
          }
        }

        setOrgId(bestOrgId ?? defaultOrg ?? null);
      } catch(e){ console.error(e); }
    })();
  },[]);

  // Charger les stats en temps réel
  useEffect(()=>{
    if(!orgId) return;

    // Events en temps réel
    const unsub = onSnapshot(
      query(collection(db,"organizations",orgId,"events"),orderBy("createdAt","desc"),limit(100)),
      snap=>{
        const docs = snap.docs.map(d=>({id:d.id,...d.data()}as RecentEvent));
        setEvents(docs.slice(0,5));

        const now = Date.now();
        const h24 = now - 86400000;
        const h1  = now - 3600000;

        setStats(prev=>({
          orgs:         1,
          cameras:      prev?.cameras??0,
          events_24h:   docs.filter(e=>new Date(e.createdAt).getTime()>h24).length,
          critical_open:docs.filter(e=>e.severity==="critical"&&!(e as any).acknowledged).length,
          detections_1h:prev?.detections_1h??0,
          clips:        docs.filter(e=>e.videoClipUrl).length,
          modules:      prev?.modules??0,
        }));

        // Activité
        setActivity(docs.slice(0,8).map(e=>({
          time: new Date(e.createdAt).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}),
          label:e.label,
          icon: CATEGORY_LABELS[e.category]?.icon??"📦",
          color:e.severity==="critical"?"#EF4444":e.severity==="warning"?"#F59E0B":"#64748B",
        })));

        setLoading(false);
      },
      ()=>setLoading(false)
    );

    // Caméras & modules (one-shot)
    getDocs(collection(db,"organizations",orgId,"cameras"))
      .then(s=>setStats(prev=>prev?{...prev,cameras:s.size}:null));
    getDocs(collection(db,"organizations",orgId,"modules"))
      .then(s=>setStats(prev=>prev?{...prev,modules:s.docs.filter(d=>d.data()?.enabled).length}:null));

    return unsub;
  },[orgId]);

  const hour = new Date().getHours();
  const greeting = hour<12?"Bonjour":hour<18?"Bon après-midi":"Bonsoir";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">
            {greeting}, {profile?.displayName?.split(" ")[0] ?? "Admin"} 👋
          </h1>
          {isSuperAdmin && (
            <span className="rounded-full border border-amber-700 bg-amber-900/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
              👑 Super Admin
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          {new Date().toLocaleDateString("fr-CA",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          {" "}· Vision Guard AI Platform
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
          <span className="text-slate-400 text-sm">Chargement du dashboard...</span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label:"Caméras actives",   value:stats?.cameras??0,       icon:"📷", color:"text-brand",     href:"/cameras"   },
              { label:"Events 24h",        value:stats?.events_24h??0,    icon:"🚨", color:"text-amber-400", href:"/events"    },
              { label:"🔴 Critiques",      value:stats?.critical_open??0, icon:"⚠️", color:"text-red-400",   href:"/events"    },
              { label:"Clips vidéo",       value:stats?.clips??0,         icon:"🎬", color:"text-brand",     href:"/events"    },
              { label:"Modules actifs",    value:stats?.modules??0,       icon:"🧩", color:"text-purple-400",href:"/modules"   },
              { label:"Total events",      value:events.length>0?stats?.events_24h??0:0, icon:"📊", color:"text-emerald-400",href:"/analytics"},
            ].map(k=>(
              <Link key={k.label} href={k.href}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{k.icon}</span>
                </div>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Events récents */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-white">🚨 Derniers events</h2>
                <Link href="/events" className="text-xs text-brand hover:underline">Voir tout →</Link>
              </div>
              {events.length===0 ? (
                <div className="p-8 text-center">
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-sm text-slate-400 mb-3">Aucun event — activez l'IA sur la caméra</p>
                  <Link href="/cameras/phone" className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white">
                    Démarrer la caméra →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {events.map(ev=>{
                    const cat = CATEGORY_LABELS[ev.category]??{icon:"📦",color:"#64748B"};
                    const sevColor = ev.severity==="critical"?"text-red-400":ev.severity==="warning"?"text-amber-400":"text-slate-400";
                    return (
                      <Link key={ev.id} href="/events"
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/50 transition-colors">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                          style={{background:cat.color+"20",border:`1px solid ${cat.color}30`}}>
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{ev.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-medium ${sevColor}`}>
                              {ev.severity==="critical"?"🔴 Critique":ev.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                            </span>
                            <span className="text-xs text-slate-600">
                              {new Date(ev.createdAt).toLocaleString("fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ev.videoClipUrl&&<span className="text-brand text-sm">🎬</span>}
                          {ev.thumbnailUrl&&<span className="text-slate-500 text-sm">📷</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel droit */}
            <div className="space-y-4">

              {/* Activité récente */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">ACTIVITÉ</h3>
                {activity.length===0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">Pas d'activité récente</p>
                ) : (
                  <div className="space-y-2">
                    {activity.map((a,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{background:a.color}}/>
                        <span className="text-xs text-white flex-1 truncate">{a.icon} {a.label}</span>
                        <span className="text-xs text-slate-600 shrink-0">{a.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Accès rapide */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">ACCÈS RAPIDE</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {href:"/cameras/phone",   icon:"📱", label:"Caméra"},
                    {href:"/modules",         icon:"🧩", label:"Modules"},
                    {href:"/events",          icon:"🚨", label:"Events"},
                    {href:"/analytics",       icon:"📊", label:"Analytics"},
                    {href:"/marketplace",     icon:"🏪", label:"Marketplace"},
                    {href:"/notifications",   icon:"🔔", label:"Alertes"},
                  ].map(l=>(
                    <Link key={l.href} href={l.href}
                      className="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 py-3 text-center hover:border-brand transition-colors">
                      <span className="text-xl">{l.icon}</span>
                      <span className="text-xs text-slate-300">{l.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Status système */}
              <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
                <h3 className="mb-2 text-xs font-semibold text-emerald-400">✅ SYSTÈME OPÉRATIONNEL</h3>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["Firebase Firestore","🟢 Connecté"],
                    ["AI Detection (COCO)","🟢 Actif"],
                    ["Events Pipeline","🟢 Opérationnel"],
                    ["Storage (Firebase)","🟢 Disponible"],
                    ["YOLOv11 Serveur","🔴 Non déployé"],
                  ].map(([l,v])=>(
                    <div key={l} className="flex justify-between">
                      <span className="text-slate-500">{l}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
