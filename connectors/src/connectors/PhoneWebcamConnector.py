"""
PhoneWebcamConnector — Caméra téléphone / webcam navigateur.

Ce connecteur utilise WebRTC (getUserMedia) pour streamer la caméra
d'un téléphone ou d'un ordinateur directement dans le Dashboard.

Deux modes :
  1. Test rapide — le navigateur demande l'accès à la caméra locale
  2. Téléphone distant — l'app mobile génère un code QR/lien de session,
     le téléphone streame vers le Dashboard via WebRTC peer-to-peer

Pas besoin de matériel externe — idéal pour tester Vision Guard sans
caméra IP dédiée.
"""

from ..base.BaseConnector import BaseConnector
from ..types import ConnectorCredentials, ConnectionTestResult, DeviceInfo
import uuid


class PhoneWebcamConnector(BaseConnector):
    type = "phone_webcam"

    async def testConnection(self, credentials: ConnectorCredentials) -> ConnectionTestResult:
        """
        Génère une session WebRTC et retourne l'URL de stream.
        En production : utilise un serveur TURN/STUN pour la signalisation.
        """
        session_id = credentials.get("sessionId") or str(uuid.uuid4())[:8]
        stream_url = f"webrtc://phone-session-{session_id}"
        self.log("info", "Session téléphone créée", {"session_id": session_id})
        return ConnectionTestResult(success=True, streamUrl=stream_url,
                                    latencyMs=0, deviceInfo=DeviceInfo(manufacturer="Téléphone / Webcam"))

    async def getStreamUrl(self, credentials: ConnectorCredentials) -> str:
        session_id = credentials.get("sessionId") or "local"
        return f"webrtc://phone-session-{session_id}"

    async def getSnapshotUrl(self, credentials: ConnectorCredentials):
        return None

    async def getDeviceInfo(self, credentials: ConnectorCredentials):
        return DeviceInfo(manufacturer="Téléphone / Webcam", model="WebRTC")
