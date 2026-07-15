import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import type { StreamQuality } from "../types";

export interface TranscoderOptions {
  sessionId: string;
  rtspUrl: string;
  outputDir: string;
  quality: StreamQuality;
}

export interface TranscoderResult {
  hlsUrl: string;
  process: ffmpeg.FfmpegCommand;
}

/**
 * HlsTranscoder — convertit un flux RTSP en HLS (.m3u8 + segments .ts)
 * via FFmpeg, rendant le stream lisible par tous les navigateurs et apps mobiles.
 *
 * Architecture de distribution :
 *
 *   RTSP Source (caméra)
 *       ↓
 *   FFmpeg HlsTranscoder
 *       ↓            ↓
 *   HLS (web/app)   RTSP copy (YOLO — Phase 5)
 *
 * Qualités disponibles :
 *   hd   → 1280×720  @ 2 Mbps
 *   sd   → 854×480   @ 800 kbps
 *   low  → 426×240   @ 300 kbps
 *   auto → détection automatique selon la bande passante client
 */
export class HlsTranscoder {
  private readonly outputBaseDir: string;

  constructor(outputBaseDir: string = "/tmp/visionguard/streams") {
    this.outputBaseDir = outputBaseDir;
  }

  private getVideoSettings(quality: StreamQuality): {
    scale: string;
    videoBitrate: string;
    audioBitrate: string;
  } {
    switch (quality) {
      case "hd":
        return { scale: "1280:720",  videoBitrate: "2000k", audioBitrate: "128k" };
      case "sd":
        return { scale: "854:480",   videoBitrate: "800k",  audioBitrate: "64k"  };
      case "low":
        return { scale: "426:240",   videoBitrate: "300k",  audioBitrate: "32k"  };
      case "auto":
      default:
        return { scale: "-2:720",    videoBitrate: "1500k", audioBitrate: "96k"  };
    }
  }

  start(options: TranscoderOptions): TranscoderResult {
    const { sessionId, rtspUrl, quality } = options;
    const outputDir = path.join(this.outputBaseDir, sessionId);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, "stream.m3u8");
    const segmentPattern = path.join(outputDir, "segment%03d.ts");
    const { scale, videoBitrate, audioBitrate } = this.getVideoSettings(quality);

    const process = ffmpeg(rtspUrl)
      .inputOptions([
        "-rtsp_transport", "tcp",   // TCP pour éviter les pertes de paquets UDP
        "-stimeout", "5000000",     // timeout source 5s
        "-re",                       // lire à vitesse réelle (live)
      ])
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        `-vf scale=${scale}`,
        `-b:v ${videoBitrate}`,
        `-b:a ${audioBitrate}`,
        "-g 48",                     // GOP size = 2x framerate (24fps → 48)
        "-sc_threshold 0",
        "-hls_time 2",               // segment de 2 secondes
        "-hls_list_size 6",          // garder les 6 derniers segments (12s de buffer)
        "-hls_flags delete_segments+append_list",
        "-hls_segment_filename", segmentPattern,
        "-preset ultrafast",         // priorité latence vs compression
        "-tune zerolatency",
        "-f hls",
      ])
      .output(playlistPath)
      .on("start", (cmd) => {
        console.log(JSON.stringify({
          module: "HlsTranscoder",
          event: "start",
          sessionId,
          quality,
          cmd: cmd.replace(rtspUrl, "[rtsp-url-hidden]"),
        }));
      })
      .on("error", (err) => {
        console.error(JSON.stringify({
          module: "HlsTranscoder",
          event: "error",
          sessionId,
          error: err.message,
        }));
      })
      .on("end", () => {
        console.log(JSON.stringify({ module: "HlsTranscoder", event: "end", sessionId }));
        // Nettoyage des segments
        try { fs.rmSync(outputDir, { recursive: true }); } catch {}
      });

    process.run();

    // L'URL HLS sera servie par un serveur HTTP statique pointant sur outputBaseDir
    const hlsUrl = `/streams/${sessionId}/stream.m3u8`;

    return { hlsUrl, process };
  }

  stop(process: ffmpeg.FfmpegCommand, sessionId: string): void {
    try {
      process.kill("SIGKILL");
      const outputDir = path.join(this.outputBaseDir, sessionId);
      if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true });
      console.log(JSON.stringify({ module: "HlsTranscoder", event: "stopped", sessionId }));
    } catch (err: any) {
      console.error(JSON.stringify({ module: "HlsTranscoder", event: "stop_error", error: err.message }));
    }
  }
}
