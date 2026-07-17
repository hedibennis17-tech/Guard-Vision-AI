"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { PageHeader } from "@/components/PageHeader";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface Detection { id:string; type:string; label:string; category:VGCategory; confidence:number; severity:string; cameraId:string; detectedAt:string; }
interface EventDoc   { id:string; label:string; severity:string; acknowledged:boolean; createdAt:string; }

export default function AnalyticsPage() {
  const { currentOrg } = useOrganization();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [events,     setEvents]     = useState<EventDoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState<"1h"|"24h"|"7d">("24h");

  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }
    const u1 = onSnapshot(query(collection(db,"organizations",currentOrg.id,"detections"),orderBy("detectedAt","desc"),limit(500)),(s)=>{setDetections(s.docs.map(d=>({id:d.id,...d.data()}as Detection)));setLoading(false);});
    const u2 = onSnapshot(query(collection(db,"organizations",currentOrg.id,"events"),orderBy("createdAt","desc"),limit(200)),(s)=>{setEvents(s.docs.map(d=>({id:d.id,...d.data()}as EventDoc)));});
    return () => { u1(); u2(); };
  }, [currentOrg?.id]);

  // Filtrer par période
  const since = period === "1h" ? Date.now()-3600000 : period === "24h" ? Date.now()-86400000 : Date.now()-604800000;
  const filtered = detections.filter(d => new Date(d.detectedAt).getTime() >= since);

  // Stats
  const total    = filtered.length;
  const critical = filtered.filter(d=>d.severity==="critical").length;
  const warning  = filtered.filter(d=>d.severity==="warning").length;
  const avgConf  = total > 0 ? Math.round(filtered.reduce((s,d)=>s+d.confidence,0)/total*100) : 0;

  // Par catégorie
  const byCat: Record<string,number> = {};
  filtered.forEach(d=>{ byCat[d.category]=(byCat[d.category]??0)+1; });
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  // Par heure (24 dernières heures)
  const byHour: number[] = Array(24).fill(0);
  filtered.forEach(d=>{ const h=new Date(d.detectedAt).getHours(); byHour[h]++; });
  const maxHour = Math.max(...byHour,1);

  // Par caméra
  const byCam: Record<string,number> = {};
  filtered.forEach(d=>{ byCam[d.cameraId]=(byCam[d.cameraId]??0)+1; });

  // Events
  const openEvents     = events.filter(e=>!e.acknowledged).length;
  const criticalEvents = events.filter(e=>e.severity==="critical"&&!e.acknowledged).length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"/></div>;

  if (!currentOrg) return (
    <div className="text-center py-16">
      <p className="text-slate-400 mb-4">Aucune organisation configurée</p>
      <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2">→ Caméra Phone</Link>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Analytics" description="Analyse des détections IA en temps réel" />
        <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
          {(["1h","24h","7d"] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${period===p?"bg-brand text-white":"text-slate-400"}`}>
              {p==="1h"?"1 heure":p==="24h"?"24 heures":"7 jours"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Détections",     value:total,    color:"text-white",       icon:"🎯" },
          { label:"Critiques",      value:critical, color:"text-red-400",     icon:"🚨" },
          { label:"Alertes",        value:warning,  color:"text-amber-400",   icon:"⚠️" },
          { label:"Confiance moy.", value:`${avgConf}%`, color:"text-brand",  icon:"📊" },
        ].map(k=>(
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>{k.icon}</span>
              <p className="text-xs text-slate-500">{k.label}</p>
            </div>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Events */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500 mb-1">🚨 Events ouverts</p>
          <p className="text-3xl font-bold text-amber-400">{openEvents}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500 mb-1">🔴 Critiques ouverts</p>
          <p className="text-3xl font-bold text-red-400">{criticalEvents}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Heatmap 24h */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Activité par heure (24h)</h3>
          {total === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">Pas de données — activez l'IA sur la caméra</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {byHour.map((count,h)=>(
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm transition-all"
                    style={{ height:`${Math.max(2,(count/maxHour)*80)}px`, background:count>0?"#0EA5E9":"#1E293B" }}
                    title={`${h}h: ${count} détection(s)`}/>
                  {h%4===0&&<span className="text-xs text-slate-700">{h}h</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Par catégorie */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Par catégorie</h3>
          {catEntries.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">Pas de données</p>
          ) : (
            <div className="space-y-2">
              {catEntries.slice(0,8).map(([cat,count])=>{
                const def=CATEGORY_LABELS[cat as VGCategory]??{icon:"📦",color:"#64748B",label:cat};
                const pct=Math.round(count/total*100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{def.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{def.label}</span>
                        <span style={{color:def.color}}>{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full" style={{width:`${pct}%`,background:def.color}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top caméras */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Top caméras</h3>
          {Object.keys(byCam).length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">Pas de données</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(byCam).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([camId,count])=>(
                <div key={camId} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-xs text-slate-400 font-mono">{camId.slice(0,16)}...</span>
                  <span className="text-xs text-brand font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sévérité */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Distribution sévérité</h3>
          {total === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">Pas de données</p>
          ) : (
            <div className="space-y-3">
              {[
                { label:"Critique", count:critical, color:"#EF4444" },
                { label:"Alerte",   count:warning,  color:"#F59E0B" },
                { label:"Info",     count:total-critical-warning, color:"#64748B" },
              ].map(s=>(
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{s.label}</span>
                    <span style={{color:s.color}}>{s.count} ({total>0?Math.round(s.count/total*100):0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full" style={{width:`${total>0?(s.count/total*100):0}%`,background:s.color}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
