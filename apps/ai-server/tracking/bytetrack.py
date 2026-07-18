"""ByteTrack — via ultralytics"""
from typing import List, Dict, Any, Optional
import numpy as np
from loguru import logger
from config.settings import settings

class ByteTrackManager:
    def __init__(self):
        self._trackers: Dict[str, Any] = {}

    def _get_tracker(self, camera_id:str):
        if camera_id not in self._trackers:
            try:
                from ultralytics.trackers.byte_tracker import BYTETracker
                self._trackers[camera_id] = BYTETracker(
                    track_high_thresh=settings.TRACK_HIGH_THRESH,
                    track_low_thresh=settings.TRACK_LOW_THRESH,
                    new_track_thresh=settings.TRACK_NEW_THRESH,
                    track_buffer=settings.TRACK_BUFFER,
                    match_thresh=settings.TRACK_MATCH_THRESH,
                )
            except Exception as e:
                logger.warning(f"ByteTrack init: {e}")
                self._trackers[camera_id] = None
        return self._trackers[camera_id]

    def update(self, camera_id:str, detections:List[Dict], img_shape=(720,1280)) -> List[Dict]:
        if not detections: return []
        tracker = self._get_tracker(camera_id)
        if tracker is None: return detections
        try:
            det_array = np.array([[*d["bbox"],d["score"],0] for d in detections if d.get("bbox")],dtype=np.float32)
            if not len(det_array): return detections
            tracks = tracker.update(det_array, img_shape)
            for track in tracks:
                track_id = int(track[4])
                tbbox    = track[:4].tolist()
                best_idx, best_iou = -1, 0.3
                for i,det in enumerate(detections):
                    if not det.get("bbox"): continue
                    iou = self._iou(tbbox, det["bbox"])
                    if iou > best_iou: best_iou=iou; best_idx=i
                if best_idx >= 0: detections[best_idx]["track_id"] = track_id
        except Exception as e:
            logger.warning(f"ByteTrack update: {e}")
        return detections

    @staticmethod
    def _iou(b1,b2):
        xi = max(b1[0],b2[0]); yi=max(b1[1],b2[1])
        xa = min(b1[2],b2[2]); ya=min(b1[3],b2[3])
        inter = max(0,xa-xi)*max(0,ya-yi)
        if not inter: return 0.0
        a1=(b1[2]-b1[0])*(b1[3]-b1[1]); a2=(b2[2]-b2[0])*(b2[3]-b2[1])
        return inter/(a1+a2-inter) if (a1+a2-inter) else 0.0

_tm: Optional[ByteTrackManager] = None
def get_tracker() -> ByteTrackManager:
    global _tm
    if _tm is None: _tm = ByteTrackManager()
    return _tm
