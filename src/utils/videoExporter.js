/**
 * Client-Side Video Exporter using Canvas + Web Audio API + MediaRecorder
 */
export async function exportVideoClientSide({
  videoElement,
  videoClips = [],
  crop,
  textLayers = [],
  qualityResolution = { width: 1280, height: 720 },
  timelineDuration,
  onProgress,
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const origWidth = videoElement?.videoWidth || 1280;
      const origHeight = videoElement?.videoHeight || 720;

      const calculatedDuration = videoClips.length > 0
        ? Math.max(...videoClips.map((clip) => {
          const effDur = Math.max(0.2, (clip.duration || 10) - (clip.trimStart || 0) - (clip.trimEnd || 0));
          return (clip.startTime || 0) + effDur;
        }))
        : (videoElement?.duration || 10);
      const duration = Math.max(calculatedDuration, Number(timelineDuration) || 0);

      // Pre-create dedicated HTMLVideoElement instances for all clips to isolate
      // export playback completely from the preview renderer. This prevents decoder
      // stalls, dropped frames, and frozen video in the exported file.
      const clipVideoElements = new Map();
      (videoClips || []).forEach((clip) => {
        const vEl = document.createElement('video');
        vEl.src = clip.url;
        vEl.preload = 'auto';
        vEl.playsInline = true;
        vEl.crossOrigin = 'anonymous';
        vEl.muted = false;
        vEl.volume = clip.volume !== undefined ? clip.volume : 1;
        clipVideoElements.set(clip.id, vEl);
      });

      if (clipVideoElements.size === 0 && videoElement && (videoElement.currentSrc || videoElement.src)) {
        const fallbackId = 'base-fallback';
        const vEl = document.createElement('video');
        vEl.src = videoElement.currentSrc || videoElement.src;
        vEl.preload = 'auto';
        vEl.playsInline = true;
        vEl.crossOrigin = 'anonymous';
        vEl.muted = false;
        clipVideoElements.set(fallbackId, vEl);
      }

      // Wait for all video element metadata & initial frames to load
      await Promise.all(
        Array.from(clipVideoElements.values()).map(
          (vEl) =>
            new Promise((res) => {
              if (vEl.readyState >= 2) {
                res();
                return;
              }
              const handleReady = () => {
                vEl.removeEventListener('loadeddata', handleReady);
                vEl.removeEventListener('canplay', handleReady);
                res();
              };
              vEl.addEventListener('loadeddata', handleReady, { once: true });
              vEl.addEventListener('canplay', handleReady, { once: true });
              vEl.load();
              setTimeout(res, 2500);
            })
        )
      );

      // Determine original dimensions from the first base clip video element
      const firstBaseClip = videoClips.find((c) => (c.trackIndex || 0) === 0);
      const firstVEl = firstBaseClip ? clipVideoElements.get(firstBaseClip.id) : clipVideoElements.values().next().value;
      const sourceWidth = firstVEl?.videoWidth || origWidth || 1280;
      const sourceHeight = firstVEl?.videoHeight || origHeight || 720;

      const exportCropX = (crop.x / 100) * sourceWidth;
      const exportCropY = (crop.y / 100) * sourceHeight;
      const exportCropW = (crop.width / 100) * sourceWidth;
      const exportCropH = (crop.height / 100) * sourceHeight;

      // Create offscreen export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = qualityResolution.width;
      exportCanvas.height = qualityResolution.height;
      const ctx = exportCanvas.getContext('2d');

      // Prepare canvas stream (30 FPS)
      const canvasStream = exportCanvas.captureStream(30);

      // Web Audio API setup - route audio from all active clips into stream destination
      let audioTrack = null;
      let audioCtx = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();

        clipVideoElements.forEach((vEl, clipId) => {
          const clip = videoClips.find((c) => c.id === clipId);
          const trackIdx = clip ? (clip.trackIndex || 0) : 0;
          const clipVol = clip?.volume !== undefined ? clip.volume : (trackIdx === 0 ? 1 : 0);

          if (clipVol > 0) {
            try {
              const source = audioCtx.createMediaElementSource(vEl);
              const gainNode = audioCtx.createGain();
              gainNode.gain.value = clipVol;
              source.connect(gainNode);
              gainNode.connect(dest);
            } catch (e) {
              console.warn('Audio node connection warning for clip:', clipId, e);
            }
          }
        });

        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0];
        }
      } catch (err) {
        console.warn('Audio context setup warning:', err);
      }

      // Combine tracks
      const tracks = [...canvasStream.getVideoTracks()];
      if (audioTrack) {
        tracks.push(audioTrack);
      }
      const combinedStream = new MediaStream(tracks);

      // Preferred MIME types for maximum iOS / QuickTime / AirDrop / Photos Album compatibility
      const preferredMimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];

      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch (e) {}
        }
        resolve({ url, mimeType, blob });
      };

      const wasPaused = videoElement?.paused;
      let exportTime = 0;
      let lastFrameMs = null;
      let animationFrameId;
      let isStopped = false;
      let activeBaseClipId = null;

      const stopExport = () => {
        if (isStopped) return;
        isStopped = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        clipVideoElements.forEach((vEl) => {
          try {
            vEl.pause();
          } catch (e) {}
        });
        if (wasPaused && videoElement) videoElement.currentTime = 0;
        if (onProgress) onProgress(100);
        setTimeout(() => recorder.stop(), 300);
      };

      recorder.start();

      const track0Clips = (videoClips || [])
        .filter((clip) => (clip.trackIndex || 0) === 0)
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

      const overlayClips = (videoClips || []).filter((clip) => (clip.trackIndex || 0) > 0);

      const renderExportFrame = (frameMs) => {
        if (isStopped) return;
        if (lastFrameMs === null) lastFrameMs = frameMs;
        const frameDelta = Math.min(0.1, Math.max(1 / 60, (frameMs - lastFrameMs) / 1000));
        lastFrameMs = frameMs;
        exportTime = Math.min(duration, exportTime + frameDelta);
        const currentTime = exportTime;
        const progress = Math.min(100, Math.round((currentTime / duration) * 100));
        if (onProgress) onProgress(progress);

        // Clear background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // 1. Render active Track 0 base video clip
        const activeBaseClip = track0Clips.length > 0
          ? track0Clips.find((clip) => {
            const effDur = Math.max(0.2, (clip.duration || 10) - (clip.trimStart || 0) - (clip.trimEnd || 0));
            return currentTime >= (clip.startTime || 0) && currentTime < (clip.startTime || 0) + effDur;
          })
          : null;

        if (activeBaseClip) {
          const vEl = clipVideoElements.get(activeBaseClip.id);
          if (vEl) {
            const localTime = Math.max(0.01, (activeBaseClip.trimStart || 0) + currentTime - (activeBaseClip.startTime || 0));
            if (activeBaseClipId !== activeBaseClip.id) {
              if (activeBaseClipId) {
                const prevVEl = clipVideoElements.get(activeBaseClipId);
                if (prevVEl && !prevVEl.paused) prevVEl.pause();
              }
              activeBaseClipId = activeBaseClip.id;
              vEl.currentTime = localTime;
              vEl.play().catch(() => {});
            } else {
              if (vEl.paused) {
                vEl.currentTime = localTime;
                vEl.play().catch(() => {});
              } else if (Math.abs(vEl.currentTime - localTime) > 0.25) {
                vEl.currentTime = localTime;
              }
            }

            if (vEl.readyState >= 2) {
              try {
                ctx.drawImage(
                  vEl,
                  exportCropX,
                  exportCropY,
                  exportCropW,
                  exportCropH,
                  0,
                  0,
                  exportCanvas.width,
                  exportCanvas.height
                );
              } catch (e) {}
            }
          }
        } else if (clipVideoElements.has('base-fallback')) {
          const vEl = clipVideoElements.get('base-fallback');
          if (vEl) {
            if (vEl.paused) {
              vEl.currentTime = currentTime;
              vEl.play().catch(() => {});
            } else if (Math.abs(vEl.currentTime - currentTime) > 0.25) {
              vEl.currentTime = currentTime;
            }
            if (vEl.readyState >= 2) {
              try {
                ctx.drawImage(
                  vEl,
                  exportCropX,
                  exportCropY,
                  exportCropW,
                  exportCropH,
                  0,
                  0,
                  exportCanvas.width,
                  exportCanvas.height
                );
              } catch (e) {}
            }
          }
        } else {
          if (activeBaseClipId) {
            const prevVEl = clipVideoElements.get(activeBaseClipId);
            if (prevVEl && !prevVEl.paused) prevVEl.pause();
            activeBaseClipId = null;
          }
        }

        // 2. Render Video Overlay Layers during export (trackIndex >= 1)
        overlayClips.forEach((overlay) => {
          const vEl = clipVideoElements.get(overlay.id);
          if (!vEl) return;

          const effDur = Math.max(0.2, (overlay.duration || 10) - (overlay.trimStart || 0) - (overlay.trimEnd || 0));
          const overlayStart = overlay.startTime || 0;
          const overlayEnd = overlayStart + effDur;

          const isActive = overlay.visible !== false && currentTime >= overlayStart && currentTime <= overlayEnd;

          if (!isActive) {
            if (!vEl.paused) vEl.pause();
            return;
          }

          const relTime = Math.max(0.05, (overlay.trimStart || 0) + (currentTime - overlayStart));
          if (vEl.paused) {
            vEl.currentTime = relTime;
            vEl.play().catch(() => {});
          } else if (Math.abs(vEl.currentTime - relTime) > 0.25) {
            vEl.currentTime = relTime;
          }

          if (vEl.readyState < 2) return;

          const widthPct = overlay.widthPercent !== undefined ? overlay.widthPercent : (overlay.width || 100);
          const ovWidth = (widthPct / 100) * exportCanvas.width;
          const ovHeight = ovWidth * ((vEl.videoHeight || 720) / (vEl.videoWidth || 1280));
          const posX = overlay.x !== undefined ? overlay.x : 50;
          const posY = overlay.y !== undefined ? overlay.y : 50;
          const ovX = (posX / 100) * exportCanvas.width - ovWidth / 2;
          const ovY = (posY / 100) * exportCanvas.height - ovHeight / 2;

          ctx.save();
          ctx.globalAlpha = overlay.opacity !== undefined ? overlay.opacity : 1;
          try {
            ctx.drawImage(vEl, ovX, ovY, ovWidth, ovHeight);
          } catch (e) {}
          ctx.restore();
        });

        // 3. Draw text layers (supporting multiline text)
        textLayers.forEach((layer) => {
          if (!layer.visible) return;
          if (currentTime < layer.startTime || currentTime > layer.endTime) return;

          ctx.save();
          const posX = (layer.x / 100) * exportCanvas.width;
          const posY = (layer.y / 100) * exportCanvas.height;

          ctx.font = `${layer.fontWeight || 'bold'} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
          ctx.textAlign = layer.textAlign || 'center';
          ctx.textBaseline = 'middle';

          // Multiline text calculation
          const lines = (layer.text || '').split('\n');
          const lineHeight = layer.fontSize * 1.25;

          let maxLineWidth = 0;
          lines.forEach((line) => {
            const w = ctx.measureText(line || ' ').width;
            if (w > maxLineWidth) maxLineWidth = w;
          });

          const paddingX = layer.fontSize * 0.4;
          const paddingY = layer.fontSize * 0.3;
          const bgW = maxLineWidth + paddingX * 2;
          const totalTextHeight = lines.length * lineHeight;
          const bgH = totalTextHeight + paddingY;

          let bgX = posX - bgW / 2;
          if (layer.textAlign === 'left') bgX = posX;
          if (layer.textAlign === 'right') bgX = posX - bgW;

          const bgY = posY - bgH / 2;

          if (layer.bgStyle !== 'none' && layer.bgColor && layer.bgColor !== 'transparent') {
            ctx.save();
            ctx.globalAlpha = layer.bgOpacity !== undefined ? layer.bgOpacity : 1;
            ctx.fillStyle = layer.bgColor;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(bgX, bgY, bgW, bgH, layer.bgRadius || 8);
            } else {
              ctx.rect(bgX, bgY, bgW, bgH);
            }
            ctx.fill();

            if (layer.bgStyle === 'outline') {
              ctx.strokeStyle = layer.color || '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            ctx.restore();
          }

          // Draw each line of multiline text
          const startY = posY - ((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, idx) => {
            const lineY = startY + idx * lineHeight;

            if (layer.stroke) {
              ctx.strokeStyle = layer.strokeColor || '#000000';
              ctx.lineWidth = Math.max(2, layer.fontSize / 12);
              ctx.strokeText(line, posX, lineY);
            }

            ctx.fillStyle = layer.color || '#ffffff';
            ctx.fillText(line, posX, lineY);
          });

          ctx.restore();
        });

        if (currentTime < duration) {
          animationFrameId = requestAnimationFrame(renderExportFrame);
        } else {
          stopExport();
        }
      };

      animationFrameId = requestAnimationFrame(renderExportFrame);
    } catch (err) {
      reject(err);
    }
  });
}
