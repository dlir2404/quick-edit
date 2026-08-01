/**
 * Client-Side Video Exporter using Canvas + Web Audio API + MediaRecorder
 */
export async function exportVideoClientSide({
  videoElement,
  videoClips = [],
  crop,
  textLayers = [],
  qualityResolution = { width: 1280, height: 720 },
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    try {
      const origWidth = videoElement.videoWidth || 1280;
      const origHeight = videoElement.videoHeight || 720;
      const duration = videoElement.duration || 10;

      // Crop coordinates in original video scale
      const cropX = (crop.x / 100) * origWidth;
      const cropY = (crop.y / 100) * origHeight;
      const cropW = (crop.width / 100) * origWidth;
      const cropH = (crop.height / 100) * origHeight;

      // Create offscreen export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = qualityResolution.width;
      exportCanvas.height = qualityResolution.height;
      const ctx = exportCanvas.getContext('2d');

      // Prepare canvas stream (30 FPS)
      const canvasStream = exportCanvas.captureStream(30);

      // Web Audio API setup
      let audioTrack = null;
      let audioCtx = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(videoElement);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        audioTrack = dest.stream.getAudioTracks()[0];
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
        videoBitsPerSecond: 5000000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (audioCtx) audioCtx.close();
        resolve({ url, mimeType, blob });
      };

      // Prepare overlay video elements for export (trackIndex >= 1)
      const overlayVideoElements = new Map();
      const overlayClips = (videoClips || []).filter((c) => (c.trackIndex || 0) > 0);
      overlayClips.forEach((overlay) => {
        const vEl = document.createElement('video');
        vEl.src = overlay.url;
        vEl.muted = true;
        vEl.volume = 0;
        vEl.playsInline = true;
        vEl.crossOrigin = 'anonymous';
        overlayVideoElements.set(overlay.id, vEl);
      });

      const wasPaused = videoElement.paused;
      videoElement.currentTime = 0;

      recorder.start();
      videoElement.play();

      let animationFrameId;

      const renderExportFrame = () => {
        const currentTime = videoElement.currentTime;
        const progress = Math.min(100, Math.round((currentTime / duration) * 100));
        if (onProgress) onProgress(progress);

        // Clear background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw cropped base video frame
        try {
          ctx.drawImage(
            videoElement,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            exportCanvas.width,
            exportCanvas.height
          );
        } catch (e) {}

        // Render Video Overlay Layers during export (trackIndex >= 1)
        overlayClips.forEach((overlay) => {
          const vEl = overlayVideoElements.get(overlay.id);
          if (!vEl) return;

          const effDur = Math.max(0.2, (overlay.duration || 10) - (overlay.trimStart || 0) - (overlay.trimEnd || 0));
          const overlayStart = overlay.startTime || 0;
          const overlayEnd = overlayStart + effDur;

          const isActive = overlay.visible !== false && currentTime >= overlayStart && currentTime <= overlayEnd;

          if (!isActive) {
            if (!vEl.paused) vEl.pause();
            return;
          }

          if (vEl) {
            const relTime = Math.max(0.05, (overlay.trimStart || 0) + (currentTime - overlayStart));
            if (vEl.paused) {
              vEl.currentTime = relTime;
              vEl.play().catch(() => {});
            } else if (Math.abs(vEl.currentTime - relTime) > 0.3) {
              vEl.currentTime = relTime;
            }

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
          }
        });

        // Draw text layers (supporting multiline text)
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

        if (currentTime < duration && !videoElement.ended) {
          animationFrameId = requestAnimationFrame(renderExportFrame);
        } else {
          cancelAnimationFrame(animationFrameId);
          videoElement.pause();
          if (wasPaused) videoElement.currentTime = 0;
          if (onProgress) onProgress(100);
          setTimeout(() => recorder.stop(), 300);
        }
      };

      renderExportFrame();
    } catch (err) {
      reject(err);
    }
  });
}
