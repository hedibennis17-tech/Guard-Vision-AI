/**
 * Detection Pipeline V2 — Vision Guard AI
 * Pipeline unifié: Capture → IA → NMS → Tracking → Scale → Draw
 */

export interface NormalizedDetection {
  id:         string;
  class:      string;
  label:      string;
  icon:       string;
  color:      string;
  severity:   "critical"|"warning"|"info";
  score:      number;
  // Coordonnées NORMALISÉES [0-1] indépendantes de la résolution
  bbox_norm:  [number,number,number,number]; // [x1,y1,x2,y2] normalisé
  // Coordonnées canvas calculées à l'affichage
  bbox_canvas?:[number,number,number,number];
  track_id?:  number;
  source:     "coco"|"yolo"|"ppe"|"ppe_engine";
  frame_count:number;
  confirmed:  boolean; // true après MIN_FRAMES
  alert:      boolean;
}

export interface PipelineResult {
  detections: NormalizedDetection[];
  workers:    any[];
  frame_w:    number;
  frame_h:    number;
  canvas_w:   number;
  canvas_h:   number;
  timestamp:  number;
}

// ── Non-Maximum Suppression ───────────────────────────────────────────────────
function iou(a:[number,number,number,number], b:[number,number,number,number]):number {
  const xi=Math.max(a[0],b[0]), yi=Math.max(a[1],b[1]);
  const xa=Math.min(a[2],b[2]), ya=Math.min(a[3],b[3]);
  const inter=Math.max(0,xa-xi)*Math.max(0,ya-yi);
  if(!inter) return 0;
  const a1=(a[2]-a[0])*(a[3]-a[1]), a2=(b[2]-b[0])*(b[3]-b[1]);
  return inter/(a1+a2-inter||1);
}

export function applyNMS(dets: NormalizedDetection[], iouThresh=0.45): NormalizedDetection[] {
  const sorted=[...dets].sort((a,b)=>b.score-a.score);
  const keep:NormalizedDetection[]=[];
  const suppressed=new Set<string>();
  for(const det of sorted){
    if(suppressed.has(det.id)) continue;
    keep.push(det);
    for(const other of sorted){
      if(other.id===det.id||suppressed.has(other.id)) continue;
      if(det.class===other.class && iou(det.bbox_norm,other.bbox_norm)>iouThresh)
        suppressed.add(other.id);
    }
  }
  return keep;
}

// ── Normaliser depuis COCO-SSD (coords dans videoWidth x videoHeight) ────────
export function normFromCoco(
  bbox:[number,number,number,number],
  videoW:number, videoH:number
):[number,number,number,number] {
  return [bbox[0]/videoW, bbox[1]/videoH, bbox[2]/videoW, bbox[3]/videoH];
}

// ── Normaliser depuis Railway (coords dans CAPTURE_W x CAPTURE_H = 640x480) ──
export const CAPTURE_W = 640;
export const CAPTURE_H = 480;

export function normFromCapture(
  bbox:[number,number,number,number]
):[number,number,number,number] {
  return [bbox[0]/CAPTURE_W, bbox[1]/CAPTURE_H, bbox[2]/CAPTURE_W, bbox[3]/CAPTURE_H];
}

// ── Convertir coords normalisées → canvas ─────────────────────────────────────
export function toCanvas(
  bbox_norm:[number,number,number,number],
  canvasW:number, canvasH:number
):[number,number,number,number] {
  return [
    bbox_norm[0]*canvasW,
    bbox_norm[1]*canvasH,
    bbox_norm[2]*canvasW,
    bbox_norm[3]*canvasH,
  ];
}

// ── Dessiner UNE box sur le canvas ────────────────────────────────────────────
export function drawBox(
  ctx: CanvasRenderingContext2D,
  bbox_canvas:[number,number,number,number],
  label:string,
  color:string,
  opts:{lineWidth?:number; dashed?:boolean; fontSize?:number}={}
){
  const [x1,y1,x2,y2]=bbox_canvas;
  const w=x2-x1, h=y2-y1;
  if(w<4||h<4) return; // Ignorer les boxes trop petites

  const lw=opts.lineWidth??2;
  const fs=opts.fontSize??11;

  ctx.strokeStyle=color;
  ctx.lineWidth=lw;
  if(opts.dashed){ ctx.setLineDash([6,3]); }
  ctx.strokeRect(x1,y1,w,h);
  ctx.setLineDash([]);

  // Label background
  const tw=ctx.measureText(label).width;
  const lh=fs+6;
  ctx.fillStyle=color+"DD";
  ctx.fillRect(x1,y1-lh,Math.min(tw+8,w+lw),lh);

  // Label text
  ctx.fillStyle="#FFFFFF";
  ctx.font=`bold ${fs}px -apple-system, sans-serif`;
  ctx.fillText(label, x1+4, y1-4, w);
}

// ── Frame tracker (confirmation après N frames) ───────────────────────────────
const MIN_FRAMES = 2; // Confirmer après 2 frames minimum
const frameHistory = new Map<string, number>();

export function confirmDetection(cls:string, score:number): {confirmed:boolean; frames:number} {
  const key=cls;
  const prev=frameHistory.get(key)??0;
  const next=prev+1;
  frameHistory.set(key,next);
  // Reset après 5s inactivité géré par cleanup
  return {confirmed: next>=MIN_FRAMES, frames:next};
}

export function cleanupFrameHistory(activeClasses:Set<string>){
  for(const k of frameHistory.keys()){
    if(!activeClasses.has(k)) frameHistory.delete(k);
  }
}
