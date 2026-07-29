import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Upload, Sparkles, Link as LinkIcon, Loader2 } from 'lucide-react';
import { getActiveClipForTime, switchVideoSource } from '../App';

export function VideoCanvas({
  videoRef,
  videoSrc,
  videoClips = [],
  overlayLayers = [],
  selectedOverlayId,
  setSelectedOverlayId,
  onUpdateOverlay,
  currentTime,
  setCurrentTime,
  duration,
  onDurationChange,
  isPlaying,
  setIsPlaying,
  crop,
  textLayers,
  selectedTextId,
  setSelectedTextId,
  onUpdateText,
  activeTab,
  volume,
  setVolume,
  playbackSpeed,
  onFileSelect,
  onLoadSample,
  onTikTokSubmit,
  isTikTokLoading,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [dragMode, setDragMode] = useState(null); // 'move' | 'resize'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialFontSize: 36, initialX: 50, initialY: 50 });
  const [isDragOverStage, setIsDragOverStage] = useState(false);
  const [tiktokInputUrl, setTiktokInputUrl] = useState('');

  // Sync volume & playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed]);

  // Handle native video element metadata & real duration loading
  const handleNativeVideoMetadata = (e) => {
    const v = e.target;
    if (v && v.duration && isFinite(v.duration) && v.duration > 0) {
      if (onDurationChange) {
        onDurationChange(v.duration);
      }
    }
    if (v && v.currentTime === 0) {
      v.currentTime = 0.05;
    }
  };

  // Force first frame decode on load
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (video.readyState >= 1 && video.duration && isFinite(video.duration) && video.duration > 0) {
      if (onDurationChange) onDurationChange(video.duration);
      if (video.currentTime === 0) video.currentTime = 0.05;
    }
  }, [videoSrc]);

  // Global Paste Event Listener
  useEffect(() => {
    if (videoSrc) return;

    const handleGlobalPaste = (e) => {
      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('tiktok.com') || text.startsWith('http'))) {
        setTiktokInputUrl(text);
        if (onTikTokSubmit) {
          onTikTokSubmit(text);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [videoSrc, onTikTokSubmit]);

  const overlayVideoRefs = useRef(new Map());

  // Main canvas render loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    const renderFrame = () => {
      if (video.readyState >= 1) {
        const origW = video.videoWidth || 1280;
        const origH = video.videoHeight || 720;

        const cropX = (crop.x / 100) * origW;
        const cropY = (crop.y / 100) * origH;
        const cropW = (crop.width / 100) * origW;
        const cropH = (crop.height / 100) * origH;

        canvas.width = Math.max(320, cropW);
        canvas.height = Math.max(180, cropH);

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          // ignore
        }

        const currSec = video.currentTime;

        // Render Video Overlay Layers (Picture-In-Picture / Watermark Video)
        (overlayLayers || []).forEach((overlay) => {
          if (!overlay.visible) return;
          if (currSec < overlay.startTime || currSec > overlay.endTime) return;

          let vEl = overlayVideoRefs.current.get(overlay.id);
          if (!vEl) {
            vEl = document.createElement('video');
            vEl.src = overlay.url;
            vEl.muted = true;
            vEl.playsInline = true;
            vEl.crossOrigin = 'anonymous';
            vEl.preload = 'auto';
            vEl.onloadedmetadata = () => {
              if (vEl.currentTime === 0) vEl.currentTime = 0.05;
            };
            vEl.currentTime = 0.05;
            overlayVideoRefs.current.set(overlay.id, vEl);
          }

          if (vEl) {
            const relTime = Math.max(0.05, currSec - overlay.startTime);
            if (Math.abs(vEl.currentTime - relTime) > 0.15 && isFinite(relTime) && relTime >= 0) {
              vEl.currentTime = relTime;
            }

            const vW = vEl.videoWidth || 1280;
            const vH = vEl.videoHeight || 720;
            const ovWidth = (overlay.width / 100) * canvas.width;
            const ovHeight = ovWidth * (vH / vW);
            const ovX = (overlay.x / 100) * canvas.width - ovWidth / 2;
            const ovY = (overlay.y / 100) * canvas.height - ovHeight / 2;

            ctx.save();
            ctx.globalAlpha = overlay.opacity !== undefined ? overlay.opacity : 1;
            try {
              ctx.drawImage(vEl, ovX, ovY, ovWidth, ovHeight);
            } catch (e) {}

            if (overlay.id === selectedOverlayId) {
              ctx.save();
              ctx.strokeStyle = '#06b6d4';
              ctx.lineWidth = Math.max(2, canvas.height / 350);
              ctx.setLineDash([6, 4]);
              ctx.strokeRect(ovX, ovY, ovWidth, ovHeight);
              ctx.setLineDash([]);

              const radius = Math.max(6, ovWidth * 0.03);
              const corners = [
                { x: ovX, y: ovY },
                { x: ovX + ovWidth, y: ovY },
                { x: ovX, y: ovY + ovHeight },
                { x: ovX + ovWidth, y: ovY + ovHeight },
              ];

              corners.forEach((c) => {
                ctx.beginPath();
                ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = '#06b6d4';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
              });
              ctx.restore();
            }
            ctx.restore();
          }
        });

        // Render Text Layers
        textLayers.forEach((layer) => {
          if (!layer.visible) return;
          if (currSec < layer.startTime || currSec > layer.endTime) return;

          ctx.save();
          const posX = (layer.x / 100) * canvas.width;
          const posY = (layer.y / 100) * canvas.height;

          ctx.font = `${layer.fontWeight || 'bold'} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
          ctx.textAlign = layer.textAlign || 'center';
          ctx.textBaseline = 'middle';

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

          if (layer.id === selectedTextId) {
            ctx.save();
            const offset = Math.max(4, layer.fontSize * 0.1);
            const boxX = bgX - offset;
            const boxY = bgY - offset;
            const boxW = bgW + offset * 2;
            const boxH = bgH + offset * 2;

            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = Math.max(2, canvas.height / 350);
            ctx.setLineDash([8, 5]);
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            ctx.setLineDash([]);

            const radius = Math.max(6, layer.fontSize * 0.2);
            const corners = [
              { x: boxX, y: boxY },
              { x: boxX + boxW, y: boxY },
              { x: boxX, y: boxY + boxH },
              { x: boxX + boxW, y: boxY + boxH },
            ];

            corners.forEach((c) => {
              ctx.beginPath();
              ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
              ctx.fillStyle = '#ec4899';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
            });

            ctx.restore();
          }

          ctx.restore();
        });

        if (videoClips && videoClips.length > 0) {
          const activeInfo = getActiveClipForTime(currentTime, videoClips);
          const localTime = video.currentTime;
          const trimStart = activeInfo.clip?.trimStart || 0;
          const trimEnd = activeInfo.clip?.trimEnd || 0;
          const origDur = activeInfo.clip?.duration || 10;
          const maxLocalTime = Math.max(0.1, origDur - trimEnd);

          const effLocalTime = Math.max(0, localTime - trimStart);
          const currentGlobalTime = activeInfo.accumulatedStart + effLocalTime;
          setCurrentTime(Number(currentGlobalTime.toFixed(1)));

          if (isPlaying && (video.ended || localTime >= maxLocalTime - 0.08)) {
            if (activeInfo.clipIndex < videoClips.length - 1) {
              const nextGlobalTime = Number((activeInfo.accumulatedStart + activeInfo.effDur + 0.05).toFixed(1));
              setCurrentTime(nextGlobalTime);
              const nextInfo = getActiveClipForTime(nextGlobalTime, videoClips);
              if (nextInfo.clip) {
                switchVideoSource(video, nextInfo.clip.url, nextInfo.localSeekTime, true);
              }
            } else {
              video.pause();
              setIsPlaying(false);
            }
          }
        } else {
          setCurrentTime(video.currentTime);
        }
      }

      animId = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => cancelAnimationFrame(animId);
  }, [crop, textLayers, selectedTextId, overlayLayers, selectedOverlayId, currentTime, videoClips, isPlaying]);

  const [dragTarget, setDragTarget] = useState('text'); // 'text' | 'overlay'

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoClips && videoClips.length > 0) {
        const activeInfo = getActiveClipForTime(currentTime, videoClips);
        if (activeInfo.clip && activeInfo.clip.url) {
          switchVideoSource(videoRef.current, activeInfo.clip.url, activeInfo.localSeekTime, true);
          setIsPlaying(true);
          return;
        }
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleCanvasMouseDown = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { clientX, clientY } = getEventCoords(e);

    const mouseCanvasX = (clientX - rect.left) * (canvas.width / rect.width);
    const mouseCanvasY = (clientY - rect.top) * (canvas.height / rect.height);
    const currSec = videoRef.current ? videoRef.current.currentTime : 0;

    // 1. Check Selected Video Overlay Layer
    const selectedOverlay = (overlayLayers || []).find((o) => o.id === selectedOverlayId);
    if (selectedOverlay && selectedOverlay.visible && currSec >= selectedOverlay.startTime && currSec <= selectedOverlay.endTime) {
      const vEl = overlayVideoRefs.current.get(selectedOverlay.id);
      const aspect = vEl && vEl.videoWidth && vEl.videoHeight ? vEl.videoHeight / vEl.videoWidth : 0.5625;
      const ovWidth = (selectedOverlay.width / 100) * canvas.width;
      const ovHeight = ovWidth * aspect;
      const ovX = (selectedOverlay.x / 100) * canvas.width - ovWidth / 2;
      const ovY = (selectedOverlay.y / 100) * canvas.height - ovHeight / 2;

      const corners = [
        { x: ovX, y: ovY },
        { x: ovX + ovWidth, y: ovY },
        { x: ovX, y: ovY + ovHeight },
        { x: ovX + ovWidth, y: ovY + ovHeight },
      ];

      const hitRadius = Math.max(24, ovWidth * 0.15);
      const isCornerHit = corners.some((c) => {
        const dx = mouseCanvasX - c.x;
        const dy = mouseCanvasY - c.y;
        return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
      });

      if (isCornerHit) {
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        setDragTarget('overlay');
        setDragMode('resize');
        setDragStart({
          x: clientX,
          y: clientY,
          initialX: selectedOverlay.x,
          initialY: selectedOverlay.y,
          initialWidth: selectedOverlay.width,
        });
        return;
      }

      if (mouseCanvasX >= ovX && mouseCanvasX <= ovX + ovWidth && mouseCanvasY >= ovY && mouseCanvasY <= ovY + ovHeight) {
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        setDragTarget('overlay');
        setDragMode('move');
        setDragStart({
          x: clientX,
          y: clientY,
          initialX: selectedOverlay.x,
          initialY: selectedOverlay.y,
          initialWidth: selectedOverlay.width,
        });
        return;
      }
    }

    // 2. Check Selected Text Layer
    const selectedLayer = textLayers.find((t) => t.id === selectedTextId);
    if (selectedLayer && selectedLayer.visible) {
      const posX = (selectedLayer.x / 100) * canvas.width;
      const posY = (selectedLayer.y / 100) * canvas.height;

      const ctx = canvas.getContext('2d');
      ctx.font = `${selectedLayer.fontWeight || 'bold'} ${selectedLayer.fontSize}px "${selectedLayer.fontFamily}", sans-serif`;

      const lines = (selectedLayer.text || '').split('\n');
      const lineHeight = selectedLayer.fontSize * 1.25;

      let maxLineWidth = 0;
      lines.forEach((line) => {
        const w = ctx.measureText(line || ' ').width;
        if (w > maxLineWidth) maxLineWidth = w;
      });

      const paddingX = selectedLayer.fontSize * 0.4;
      const paddingY = selectedLayer.fontSize * 0.3;
      const bgW = maxLineWidth + paddingX * 2;
      const totalTextHeight = lines.length * lineHeight;
      const bgH = totalTextHeight + paddingY;

      let bgX = posX - bgW / 2;
      if (selectedLayer.textAlign === 'left') bgX = posX;
      if (selectedLayer.textAlign === 'right') bgX = posX - bgW;

      const bgY = posY - bgH / 2;
      const offset = Math.max(4, selectedLayer.fontSize * 0.1);

      const boxX = bgX - offset;
      const boxY = bgY - offset;
      const boxW = bgW + offset * 2;
      const boxH = bgH + offset * 2;

      const corners = [
        { x: boxX, y: boxY },
        { x: boxX + boxW, y: boxY },
        { x: boxX, y: boxY + boxH },
        { x: boxX + boxW, y: boxY + boxH },
      ];

      const hitRadius = Math.max(24, selectedLayer.fontSize * 0.6);
      const isCornerHit = corners.some((c) => {
        const dx = mouseCanvasX - c.x;
        const dy = mouseCanvasY - c.y;
        return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
      });

      if (isCornerHit) {
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        setDragTarget('text');
        setDragMode('resize');
        setDragStart({
          x: clientX,
          y: clientY,
          initialX: selectedLayer.x,
          initialY: selectedLayer.y,
          initialFontSize: selectedLayer.fontSize,
        });
        return;
      }

      if (
        mouseCanvasX >= boxX &&
        mouseCanvasX <= boxX + boxW &&
        mouseCanvasY >= bgY &&
        mouseCanvasY <= bgY + bgH
      ) {
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        setDragTarget('text');
        setDragMode('move');
        setDragStart({
          x: clientX,
          y: clientY,
          initialX: selectedLayer.x,
          initialY: selectedLayer.y,
          initialFontSize: selectedLayer.fontSize,
        });
        return;
      }
    }

    // 3. Search for any visible Overlay Layer hit
    let foundOverlay = null;
    for (let i = (overlayLayers || []).length - 1; i >= 0; i--) {
      const overlay = overlayLayers[i];
      if (!overlay.visible || currSec < overlay.startTime || currSec > overlay.endTime) continue;

      const vEl = overlayVideoRefs.current.get(overlay.id);
      const aspect = vEl && vEl.videoWidth && vEl.videoHeight ? vEl.videoHeight / vEl.videoWidth : 0.5625;
      const ovWidth = (overlay.width / 100) * canvas.width;
      const ovHeight = ovWidth * aspect;
      const ovX = (overlay.x / 100) * canvas.width - ovWidth / 2;
      const ovY = (overlay.y / 100) * canvas.height - ovHeight / 2;

      if (mouseCanvasX >= ovX && mouseCanvasX <= ovX + ovWidth && mouseCanvasY >= ovY && mouseCanvasY <= ovY + ovHeight) {
        foundOverlay = overlay;
        break;
      }
    }

    if (foundOverlay) {
      if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
      if (setSelectedOverlayId) setSelectedOverlayId(foundOverlay.id);
      setDragTarget('overlay');
      setDragMode('move');
      setDragStart({
        x: clientX,
        y: clientY,
        initialX: foundOverlay.x,
        initialY: foundOverlay.y,
        initialWidth: foundOverlay.width,
      });
      return;
    }

    // 4. Search for any Text Layer hit
    let foundLayer = null;
    const ctx = canvas.getContext('2d');
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const layer = textLayers[i];
      if (!layer.visible) continue;

      const posX = (layer.x / 100) * canvas.width;
      const posY = (layer.y / 100) * canvas.height;
      ctx.font = `${layer.fontWeight || 'bold'} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;

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

      if (
        mouseCanvasX >= bgX &&
        mouseCanvasX <= bgX + bgW &&
        mouseCanvasY >= bgY &&
        mouseCanvasY <= bgY + bgH
      ) {
        foundLayer = layer;
        break;
      }
    }

    if (foundLayer) {
      if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
      setSelectedTextId(foundLayer.id);
      setDragTarget('text');
      setDragMode('move');
      setDragStart({
        x: clientX,
        y: clientY,
        initialX: foundLayer.x,
        initialY: foundLayer.y,
        initialFontSize: foundLayer.fontSize,
      });
    } else {
      togglePlay();
    }
  };

  const handleMouseMove = (e) => {
    if (!dragMode || !containerRef.current) return;
    if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
    const { clientX, clientY } = getEventCoords(e);
    const rect = containerRef.current.getBoundingClientRect();

    if (dragTarget === 'overlay') {
      if (!selectedOverlayId) return;
      if (dragMode === 'move') {
        const deltaXPercent = ((clientX - dragStart.x) / rect.width) * 100;
        const deltaYPercent = ((clientY - dragStart.y) / rect.height) * 100;

        const newX = Math.max(0, Math.min(100, dragStart.initialX + deltaXPercent));
        const newY = Math.max(0, Math.min(100, dragStart.initialY + deltaYPercent));

        if (onUpdateOverlay) onUpdateOverlay(selectedOverlayId, { x: Math.round(newX), y: Math.round(newY) });
      } else if (dragMode === 'resize') {
        const deltaX = clientX - dragStart.x;
        const deltaY = clientY - dragStart.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const scaleFactor = deltaX > 0 || deltaY > 0 ? 1 + dist / 180 : 1 - dist / 180;

        const newWidth = Math.max(5, Math.min(100, Math.round(dragStart.initialWidth * scaleFactor)));
        if (onUpdateOverlay) onUpdateOverlay(selectedOverlayId, { width: newWidth });
      }
    } else {
      if (!selectedTextId) return;
      const selectedLayer = textLayers.find((t) => t.id === selectedTextId);
      if (!selectedLayer) return;

      if (dragMode === 'move') {
        const deltaXPercent = ((clientX - dragStart.x) / rect.width) * 100;
        const deltaYPercent = ((clientY - dragStart.y) / rect.height) * 100;

        const newX = Math.max(5, Math.min(95, dragStart.initialX + deltaXPercent));
        const newY = Math.max(5, Math.min(95, dragStart.initialY + deltaYPercent));

        onUpdateText(selectedTextId, { x: Math.round(newX), y: Math.round(newY) });
      } else if (dragMode === 'resize') {
        const deltaX = clientX - dragStart.x;
        const deltaY = clientY - dragStart.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const scaleFactor = deltaX > 0 || deltaY > 0 ? 1 + dist / 180 : 1 - dist / 180;

        const newFontSize = Math.max(14, Math.min(160, Math.round(dragStart.initialFontSize * scaleFactor)));
        onUpdateText(selectedTextId, { fontSize: newFontSize });
      }
    }
  };

  const handleMouseUp = () => {
    setDragMode(null);
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const formatTimecode = (secs) => {
    if (isNaN(secs)) return '00:00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `00:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const handleFormTikTokSubmit = (e) => {
    e.preventDefault();
    if (tiktokInputUrl && onTikTokSubmit) {
      onTikTokSubmit(tiktokInputUrl);
    }
  };

  if (!videoSrc) {
    return (
      <div
        className="center-dropzone-stage"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverStage(true);
        }}
        onDragLeave={() => setIsDragOverStage(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOverStage(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileSelect(e.dataTransfer.files[0]);
          }
        }}
      >
        <div className={`center-drop-box ${isDragOverStage ? 'drag-over' : ''}`}>
          <div className="center-drop-icon">
            {isTikTokLoading ? (
              <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Upload size={32} />
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>
              {isTikTokLoading ? 'Đang Lấy Video TikTok...' : 'Kéo thả Video vào giữa màn hình để Edit'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hỗ trợ Kéo thả file MP4/WebM hoặc <strong>Dán URL TikTok</strong> (Nhấn Ctrl+V / Cmd+V bất kỳ đâu)
            </p>
          </div>

          <form
            onSubmit={handleFormTikTokSubmit}
            style={{ display: 'flex', width: '100%', maxWidth: '420px', gap: '8px', marginTop: '6px' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <LinkIcon
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px', height: '40px' }}
                placeholder="Dán link TikTok (VD: https://www.tiktok.com/...)"
                value={tiktokInputUrl}
                onChange={(e) => setTiktokInputUrl(e.target.value)}
                disabled={isTikTokLoading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '40px', padding: '0 16px', whiteSpace: 'nowrap' }}
              disabled={isTikTokLoading || !tiktokInputUrl}
            >
              {isTikTokLoading ? 'Đang Tải...' : 'Nạp TikTok'}
            </button>
          </form>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px' }}>
              <Upload size={15} /> Chọn File Từ Máy
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onFileSelect(e.target.files[0]);
                  }
                }}
              />
            </label>

            <button className="btn btn-secondary" onClick={onLoadSample} style={{ padding: '8px 16px' }}>
              <Sparkles size={15} style={{ color: '#a5b4fc' }} /> Thử Video Mẫu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="stage-section"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Hidden Video Source with real metadata listener */}
      <video
        ref={videoRef}
        src={videoSrc}
        style={{ display: 'none' }}
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={handleNativeVideoMetadata}
        onDurationChange={handleNativeVideoMetadata}
        onCanPlay={handleNativeVideoMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Canvas Viewport */}
      <div className="canvas-viewport-wrapper" ref={containerRef}>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="main-preview-canvas"
            onMouseDown={handleCanvasMouseDown}
            onTouchStart={handleCanvasMouseDown}
            style={{ cursor: dragMode === 'resize' ? 'nwse-resize' : dragMode === 'move' ? 'move' : 'pointer' }}
          />
        </div>
      </div>

      {/* Floating Center Controls */}
      <div className="player-controls-floating">
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
          title="Tắt / Mở âm thanh"
        >
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <span className="time-display-capcut">{formatTimecode(currentTime)}</span>

        <button className="btn btn-secondary btn-icon" onClick={() => (videoRef.current.currentTime -= 1)}>
          <SkipBack size={16} />
        </button>

        <button className="control-play-btn" onClick={togglePlay}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
        </button>

        <button className="btn btn-secondary btn-icon" onClick={() => (videoRef.current.currentTime += 1)}>
          <SkipForward size={16} />
        </button>

        <span className="time-display-capcut">{formatTimecode(duration)}</span>

        <button className="btn btn-secondary btn-icon" onClick={toggleFullscreen} title="Toàn màn hình">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
