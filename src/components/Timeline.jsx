import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Volume2, VolumeX } from 'lucide-react';

export function Timeline({
  duration,
  currentTime,
  onSeek,
  textLayers = [],
  selectedTextId,
  setSelectedTextId,
  onUpdateText,
  videoClips = [],
  onUpdateVideoClip,
  onVideoClipDragEnd,
  selectedOverlayId,
  setSelectedOverlayId,
  filmstripThumbs = [],
}) {
  const containerRef = useRef(null);
  const tracksAreaRef = useRef(null);

  // Fixed time scale: 1.0 = 40 px/second, independent of total project duration
  const [zoomLevel, setZoomLevel] = useState(1);

  // Touch pinch-to-zoom state
  const touchDistanceRef = useRef(null);

  // Drag state:
  // type: 'text' | 'video'
  // mode: 'left' | 'right' | 'move'
  const [dragState, setDragState] = useState(null);

  const PADDING_PX = 32; // Visual start & end padding in pixels
  const BASE_PX_PER_SECOND = 40;
  const activeTimelineDuration = Math.max(1, duration || 10);
  const displayDuration = activeTimelineDuration + 5; // Extra 5s buffer space so clip tails are never clipped by track edge
  const pixelsPerSecond = Math.max(0.4, BASE_PX_PER_SECOND * zoomLevel);

  // Trackpad 2-finger pinch or Ctrl + MouseWheel event listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
        setZoomLevel((prev) => Math.max(0.01, Math.min(5, Number((prev + zoomDelta).toFixed(2)))));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 2-finger touch pinch-to-zoom handlers
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMovePinch = (e) => {
    if (e.touches && e.touches.length === 2 && touchDistanceRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const factor = dist / touchDistanceRef.current;

      if (Math.abs(factor - 1) > 0.03) {
        setZoomLevel((prev) => {
          const next = prev * factor;
          return Math.max(0.01, Math.min(5, Number(next.toFixed(2))));
        });
        touchDistanceRef.current = dist;
      }
      return;
    }

    if (dragState) {
      handleMouseMove(e);
    }
  };

  const handleTouchCancelPinch = () => {
    touchDistanceRef.current = null;
    if (dragState?.type === 'video' && onVideoClipDragEnd) onVideoClipDragEnd();
    setDragState(null);
  };

  const handleTouchEndPinch = (e) => {
    if (!e.touches || e.touches.length < 2) {
      touchDistanceRef.current = null;
    }
    if (dragState) {
      handleMouseUp();
    }
  };

  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  };

  const calculateSecFromX = (clientX) => {
    const el = tracksAreaRef.current || containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const clickX = clientX - rect.left - PADDING_PX;
    return Math.max(0, Math.min(activeTimelineDuration, clickX / pixelsPerSecond));
  };

  const handleTimelineClick = (e) => {
    if (dragState || touchDistanceRef.current !== null) return;
    const sec = calculateSecFromX(getClientX(e));
    onSeek(sec);
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(5, Number((prev + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.01, Number((prev - 0.25).toFixed(2))));
  const handleZoomReset = () => setZoomLevel(1);

  // Track mute toggle
  const toggleTrackMute = (tIndex) => {
    const clipsInTrack = videoClips.filter((c) => (c.trackIndex || 0) === tIndex);
    const isCurrentlyMuted = clipsInTrack.length > 0 && clipsInTrack.every((c) => (c.volume ?? 1) === 0);

    clipsInTrack.forEach((clip) => {
      if (onUpdateVideoClip) {
        const restoredVolume = clip.volumeBeforeMute ?? (clip.volume > 0 ? clip.volume : 1);
        onUpdateVideoClip(clip.id, isCurrentlyMuted
          ? { volume: restoredVolume }
          : { volumeBeforeMute: restoredVolume, volume: 0 });
      }
    });
  };

  // Helper to calculate effective clip duration
  const getEffDuration = (clip) => {
    const dur = clip.duration || 10;
    const tStart = clip.trimStart || 0;
    const tEnd = clip.trimEnd || 0;
    return Math.max(0.2, Number((dur - tStart - tEnd).toFixed(1)));
  };

  // Start dragging a video clip
  const handleStartDragClip = (e, clip, mode) => {
    if (e.stopPropagation) e.stopPropagation();
    const clientX = getClientX(e);
    if (setSelectedOverlayId) setSelectedOverlayId(clip.id);

    const effDur = getEffDuration(clip);
    const initialStart = clip.startTime !== undefined ? clip.startTime : 0;

    setDragState({
      type: 'video',
      clipId: clip.id,
      mode,
      startX: clientX,
      initialStart,
      initialEnd: initialStart + effDur,
      initialTrimStart: clip.trimStart || 0,
      initialTrimEnd: clip.trimEnd || 0,
      initialTrackIndex: clip.trackIndex || 0,
      duration: clip.duration || 10,
    });
  };

  // Start dragging a text layer
  const handleStartDragText = (e, layer, mode) => {
    if (e.stopPropagation) e.stopPropagation();
    const clientX = getClientX(e);
    if (setSelectedTextId) setSelectedTextId(layer.id);

    setDragState({
      type: 'text',
      layerId: layer.id,
      mode,
      startX: clientX,
      initialStart: layer.startTime,
      initialEnd: layer.endTime,
    });
  };

  const isTimeOverlap = (startA, endA, startB, endB) => {
    return Math.max(startA, startB) < Math.min(endA, endB) - 0.05;
  };

  const findAvailableTrackIndex = (clipId, proposedStart, proposedEnd, candidateTrack, allClips) => {
    let track = Math.max(0, candidateTrack);
    const siblings = allClips.filter((c) => c.id !== clipId);

    while (true) {
      const hasOverlapOnTrack = siblings.some((s) => {
        const sTrack = s.trackIndex || 0;
        if (sTrack !== track) return false;
        const sStart = s.startTime || 0;
        const sEff = getEffDuration(s);
        const sEnd = sStart + sEff;
        return isTimeOverlap(proposedStart, proposedEnd, sStart, sEnd);
      });

      if (!hasOverlapOnTrack) return track;
      track += 1;
    }
  };

  const handleMouseMove = (e) => {
    if (!dragState || !tracksAreaRef.current) return;
    const clientX = getClientX(e);
    const deltaX = clientX - dragState.startX;
    const deltaSec = deltaX / pixelsPerSecond;
    const SNAP_THRESHOLD = 0.35;

    if (dragState.type === 'video') {
      const targetClip = videoClips.find((c) => c.id === dragState.clipId);
      if (!targetClip || !onUpdateVideoClip) return;

      if (dragState.mode === 'left') {
        const maxStart = (targetClip.duration || 10) - (dragState.initialTrimEnd || 0) - 0.2;
        const newTrimStart = Math.max(0, Math.min(maxStart, dragState.initialTrimStart + deltaSec));
        onUpdateVideoClip(dragState.clipId, { trimStart: Number(newTrimStart.toFixed(1)) });
      } else if (dragState.mode === 'right') {
        const maxEnd = (targetClip.duration || 10) - (dragState.initialTrimStart || 0) - 0.2;
        const newTrimEnd = Math.max(0, Math.min(maxEnd, dragState.initialTrimEnd - deltaSec));
        onUpdateVideoClip(dragState.clipId, { trimEnd: Number(newTrimEnd.toFixed(1)) });
      } else if (dragState.mode === 'move') {
        const effDur = dragState.initialEnd - dragState.initialStart;
        let proposedStart = Math.max(0, dragState.initialStart + deltaSec);
        let proposedEnd = proposedStart + effDur;

        const siblings = videoClips.filter((c) => c.id !== dragState.clipId);
        siblings.forEach((s) => {
          const sStart = s.startTime || 0;
          const sEnd = sStart + getEffDuration(s);
          if (Math.abs(proposedStart - sEnd) < SNAP_THRESHOLD) {
            proposedStart = sEnd;
            proposedEnd = proposedStart + effDur;
          } else if (Math.abs(proposedEnd - sStart) < SNAP_THRESHOLD) {
            proposedEnd = sStart;
            proposedStart = proposedEnd - effDur;
          }
        });

        proposedStart = Number(Math.max(0, proposedStart).toFixed(1));
        proposedEnd = proposedStart + effDur;

        const targetTrack = findAvailableTrackIndex(
          dragState.clipId,
          proposedStart,
          proposedEnd,
          0,
          videoClips
        );

        onUpdateVideoClip(dragState.clipId, {
          startTime: proposedStart,
          trackIndex: targetTrack,
        });
      }
      return;
    }

    if (dragState.type === 'text') {
      const siblingLayers = textLayers.filter((l) => l.id !== dragState.layerId);

      if (dragState.mode === 'left') {
        let newStart = Math.max(0, Math.min(dragState.initialEnd - 0.5, dragState.initialStart + deltaSec));
        siblingLayers.forEach((sibling) => {
          if (Math.abs(newStart - sibling.endTime) < SNAP_THRESHOLD) newStart = sibling.endTime;
          if (Math.abs(newStart - sibling.startTime) < SNAP_THRESHOLD) newStart = sibling.startTime;
        });
        onUpdateText(dragState.layerId, { startTime: Number(newStart.toFixed(1)) });
      } else if (dragState.mode === 'right') {
        let newEnd = Math.max(dragState.initialStart + 0.5, Math.min(activeTimelineDuration, dragState.initialEnd + deltaSec));
        siblingLayers.forEach((sibling) => {
          if (Math.abs(newEnd - sibling.startTime) < SNAP_THRESHOLD) newEnd = sibling.startTime;
          if (Math.abs(newEnd - sibling.endTime) < SNAP_THRESHOLD) newEnd = sibling.endTime;
        });
        onUpdateText(dragState.layerId, { endTime: Number(newEnd.toFixed(1)) });
      } else if (dragState.mode === 'move') {
        const layerDuration = dragState.initialEnd - dragState.initialStart;
        let newStart = dragState.initialStart + deltaSec;
        let newEnd = dragState.initialEnd + deltaSec;

        if (newStart < 0) {
          newStart = 0;
          newEnd = layerDuration;
        }
        if (newEnd > activeTimelineDuration) {
          newEnd = activeTimelineDuration;
          newStart = Math.max(0, activeTimelineDuration - layerDuration);
        }

        siblingLayers.forEach((sibling) => {
          if (Math.abs(newStart - sibling.endTime) < SNAP_THRESHOLD) {
            newStart = sibling.endTime;
            newEnd = newStart + layerDuration;
          } else if (Math.abs(newEnd - sibling.startTime) < SNAP_THRESHOLD) {
            newEnd = sibling.startTime;
            newStart = newEnd - layerDuration;
          }
        });

        onUpdateText(dragState.layerId, {
          startTime: Number(newStart.toFixed(1)),
          endTime: Number(newEnd.toFixed(1)),
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (dragState?.type === 'video' && onVideoClipDragEnd) {
      onVideoClipDragEnd();
    }
    setDragState(null);
  };

  const currentPositionPx = currentTime * pixelsPerSecond;

  const getRulerTicks = () => {
    const targetTickSeconds = 80 / pixelsPerSecond;
    let step = 0.5;
    if (targetTickSeconds > 0.5) step = 1;
    if (targetTickSeconds > 1) step = 2;
    if (targetTickSeconds > 2) step = 5;
    if (targetTickSeconds > 5) step = 10;
    if (targetTickSeconds > 10) step = 30;
    if (targetTickSeconds > 30) step = 60;
    if (targetTickSeconds > 60) step = 300;

    const ticks = [];
    for (let s = 0; s <= displayDuration; s += step) {
      ticks.push(Number(s.toFixed(2)));
    }
    return ticks;
  };

  const ticks = getRulerTicks();

  const trackMap = new Map();
  videoClips.forEach((clip) => {
    const tIdx = clip.trackIndex || 0;
    if (!trackMap.has(tIdx)) trackMap.set(tIdx, []);
    trackMap.get(tIdx).push(clip);
  });

  const maxTrackIndex = Math.max(0, ...Array.from(trackMap.keys()));
  const trackIndices = [];
  for (let i = 0; i <= maxTrackIndex; i++) {
    trackIndices.push(i);
  }

  return (
    <div
      ref={containerRef}
      className="timeline-fullwidth"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#090a0f',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        position: 'relative',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMovePinch}
      onTouchEnd={handleTouchEndPinch}
      onTouchCancel={handleTouchCancelPinch}
    >
      {/* Controls Bar: Timeline Zoom & Scale Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          height: '36px',
          minHeight: '36px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '0.74rem', fontWeight: '700', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ⏱️ Tỷ lệ Timeline:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.01}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '3px 8px',
              cursor: zoomLevel <= 0.01 ? 'not-allowed' : 'pointer',
              opacity: zoomLevel <= 0.01 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Thu nhỏ timeline"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min="0.01"
            max="5"
            step="0.01"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            style={{ width: '120px', accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 5}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '3px 8px',
              cursor: zoomLevel >= 5 ? 'not-allowed' : 'pointer',
              opacity: zoomLevel >= 5 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Phóng to timeline"
          >
            <ZoomIn size={14} />
          </button>
          <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: '700', minWidth: '40px' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          {zoomLevel !== 1 && (
            <button
              onClick={handleZoomReset}
              style={{
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '4px',
                color: '#38bdf8',
                padding: '2px 8px',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title="Đặt lại zoom về 100%"
            >
              <RotateCcw size={12} /> Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Outer Scrollable Area (Horizontal & Vertical Scrolling) */}
      <div
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          padding: '8px 0',
        }}
      >
        {/* Inner container uses a fixed pixels-per-second time scale */}
        <div
          style={{
            width: `${displayDuration * pixelsPerSecond + PADDING_PX * 2}px`,
            minWidth: '10px',
            paddingLeft: `${PADDING_PX}px`,
            paddingRight: `${PADDING_PX}px`,
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Top Time Ruler Bar */}
          <div className="timeline-top-ruler" onClick={handleTimelineClick} style={{ position: 'relative', height: '24px', marginBottom: '8px' }}>
            <div className="timeline-ruler-inner" style={{ position: 'relative', width: `${displayDuration * pixelsPerSecond}px`, height: '100%', left: 0, right: 'auto' }}>
              {ticks.map((sec) => {
                const positionPx = sec * pixelsPerSecond;
                const formatted = sec < 10 ? `0${sec}s` : `${sec}s`;
                let translateX = '-50%';
                if (sec === 0) translateX = '0%';
                if (sec >= displayDuration) translateX = '-100%';

                return (
                  <div
                    key={sec}
                    className="ruler-tick-mark"
                    style={{ left: `${positionPx}px`, transform: `translateX(${translateX})` }}
                  >
                    <div className="ruler-tick-line" />
                    <span>{formatted}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Track Area */}
          <div
            className="timeline-tracks-area"
            ref={tracksAreaRef}
            onClick={handleTimelineClick}
            style={{ position: 'relative', width: `${displayDuration * pixelsPerSecond}px`, overflow: 'visible', padding: 0 }}
          >
            <div className="timeline-track-inner-zone" style={{ position: 'relative', width: '100%', margin: 0 }}>
              {/* Dynamic Video Track Rows */}
              {trackIndices.map((tIndex) => {
                const clipsInTrack = trackMap.get(tIndex) || [];
                const isBaseTrack = tIndex === 0;
                const isTrackMuted = clipsInTrack.length > 0 && clipsInTrack.every((clip) => (clip.volume ?? 1) === 0);

                return (
                  <div
                    key={`track-${tIndex}`}
                    className="filmstrip-track"
                    style={{
                      position: 'relative',
                      marginBottom: '8px',
                      height: '52px',
                      minHeight: '52px',
                      background: isBaseTrack ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.5)',
                      borderRadius: '8px',
                      border: isBaseTrack ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {/* Track label badge with Audio Control */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '6px',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        color: isBaseTrack ? '#38bdf8' : '#a7f3d0',
                        background: 'rgba(0,0,0,0.85)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        zIndex: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      <span>{isBaseTrack ? 'Track 1 (Chính)' : `Track ${tIndex + 1} (Overlay)`}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTrackMute(tIndex);
                        }}
                        style={{
                          background: isTrackMuted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                          border: 'none',
                          borderRadius: '3px',
                          color: isTrackMuted ? '#f87171' : '#38bdf8',
                          padding: '1px 4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={isTrackMuted ? 'Bật âm thanh Line này' : 'Tắt âm thanh Line này'}
                      >
                        {isTrackMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                    </div>

                    {/* Clips in this track row */}
                    {clipsInTrack.map((clip) => {
                      const effDur = getEffDuration(clip);
                      const startSec = clip.startTime || 0;
                      const endSec = startSec + effDur;
                      const leftPx = startSec * pixelsPerSecond;
                      const widthPx = effDur * pixelsPerSecond;
                      const isSelected = selectedOverlayId === clip.id;

                      return (
                        <div
                          key={clip.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${leftPx}px`,
                            width: `${Math.max(6, widthPx)}px`,
                            border: isSelected ? '2px solid #06b6d4' : '1.5px solid #38bdf8',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 0,
                            boxSizing: 'border-box',
                            background: isBaseTrack ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.4)',
                            backdropFilter: 'blur(4px)',
                            pointerEvents: 'auto',
                            cursor: 'grab',
                            zIndex: isSelected ? 4 : 2,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            opacity: isTrackMuted ? 0.6 : 1,
                          }}
                          onMouseDown={(e) => handleStartDragClip(e, clip, 'move')}
                          onTouchStart={(e) => handleStartDragClip(e, clip, 'move')}
                        >
                          {/* Left Trim Handle */}
                          <div
                            className="timeline-track-handle left"
                            style={{
                              height: '100%',
                              background: '#ffffff',
                              border: '2px solid #38bdf8',
                              width: '10px',
                              borderRadius: '4px 0 0 4px',
                              cursor: 'ew-resize',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 0 6px rgba(0,0,0,0.8)',
                              zIndex: 5,
                            }}
                            title="Kéo để trim đầu video clip"
                            onMouseDown={(e) => handleStartDragClip(e, clip, 'left')}
                            onTouchStart={(e) => handleStartDragClip(e, clip, 'left')}
                          >
                            <div style={{ width: '2px', height: '14px', borderLeft: '1px solid #0284c7', borderRight: '1px solid #0284c7' }} />
                          </div>

                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: '800',
                              color: '#ffffff',
                              background: 'rgba(15, 23, 42, 0.85)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '85%',
                              userSelect: 'none',
                              pointerEvents: 'none',
                            }}
                          >
                            🎬 {clip.name} ({startSec.toFixed(1)}s - {endSec.toFixed(1)}s)
                          </span>

                          {/* Right Trim Handle */}
                          <div
                            className="timeline-track-handle right"
                            style={{
                              height: '100%',
                              background: '#ffffff',
                              border: '2px solid #38bdf8',
                              width: '10px',
                              borderRadius: '0 4px 4px 0',
                              cursor: 'ew-resize',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 0 6px rgba(0,0,0,0.8)',
                              zIndex: 5,
                            }}
                            title="Kéo để trim đuôi video clip"
                            onMouseDown={(e) => handleStartDragClip(e, clip, 'right')}
                            onTouchStart={(e) => handleStartDragClip(e, clip, 'right')}
                          >
                            <div style={{ width: '2px', height: '14px', borderLeft: '1px solid #0284c7', borderRight: '1px solid #0284c7' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Text Layers Track Row */}
              {(textLayers || []).length > 0 && (
                <div className="text-layers-track-row" style={{ marginTop: '8px', position: 'relative' }}>
                  {textLayers.map((layer) => {
                    const leftPx = layer.startTime * pixelsPerSecond;
                    const widthPx = (layer.endTime - layer.startTime) * pixelsPerSecond;
                    const isSelected = selectedTextId === layer.id;

                    return (
                      <div
                        key={layer.id}
                        className={`timeline-track-item ${isSelected ? 'selected' : ''}`}
                        style={{
                          left: `${leftPx}px`,
                          width: `${Math.max(6, widthPx)}px`,
                        }}
                        onMouseDown={(e) => handleStartDragText(e, layer, 'move')}
                        onTouchStart={(e) => handleStartDragText(e, layer, 'move')}
                      >
                        <div
                          className="timeline-track-handle left"
                          title="Kéo để đổi thời gian bắt đầu chữ"
                          onMouseDown={(e) => handleStartDragText(e, layer, 'left')}
                          onTouchStart={(e) => handleStartDragText(e, layer, 'left')}
                        />

                        <span
                          style={{
                            padding: '0 10px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '0.74rem',
                            fontWeight: '600',
                          }}
                        >
                          ✏️ {layer.text ? layer.text.split('\n')[0] : 'Chữ mới'} ({layer.startTime}s - {layer.endTime}s)
                        </span>

                        <div
                          className="timeline-track-handle right"
                          title="Kéo để đổi thời gian kết thúc chữ"
                          onMouseDown={(e) => handleStartDragText(e, layer, 'right')}
                          onTouchStart={(e) => handleStartDragText(e, layer, 'right')}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Current Time Playhead Scrub Bar */}
              <div
                className="capcut-playhead"
                style={{ left: `${currentPositionPx}px` }}
              >
                <div className="capcut-playhead-cap" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
