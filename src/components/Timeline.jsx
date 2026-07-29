import React, { useState, useRef } from 'react';

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
  onSwapVideoClips,
  overlayLayers = [],
  selectedOverlayId,
  setSelectedOverlayId,
  onUpdateOverlay,
  filmstripThumbs = [],
}) {
  const tracksAreaRef = useRef(null);

  // Dragging track state: { type: 'text' | 'overlay' | 'clip', layerId, mode: 'left' | 'right' | 'move', startX, initialStart, initialEnd }
  const [dragState, setDragState] = useState(null);

  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  };

  const containerRef = useRef(null);

  const calculateSecFromX = (clientX) => {
    const el = tracksAreaRef.current || containerRef.current;
    if (!el || !duration || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const trackWidth = Math.max(10, rect.width - 32);
    const clickX = clientX - rect.left - 16;
    const percent = Math.max(0, Math.min(1, clickX / trackWidth));
    return percent * duration;
  };

  const handleTimelineClick = (e) => {
    if (dragState) return;
    const sec = calculateSecFromX(getClientX(e));
    onSeek(sec);
  };

  // Start dragging track handle or track body
  const handleStartDragTrack = (e, layer, mode, type = 'text') => {
    if (e.stopPropagation) e.stopPropagation();
    const clientX = getClientX(e);
    if (type === 'text') setSelectedTextId(layer.id);
    if (type === 'overlay') setSelectedOverlayId(layer.id);

    setDragState({
      type,
      layerId: layer.id,
      mode,
      startX: clientX,
      initialStart: layer.startTime,
      initialEnd: layer.endTime,
    });
  };

  const handleStartDragClip = (e, clip, index, mode) => {
    if (e.stopPropagation) e.stopPropagation();
    const clientX = getClientX(e);
    setDragState({
      type: 'clip',
      clipId: clip.id,
      currentIndex: index,
      mode,
      startX: clientX,
      initialTrimStart: clip.trimStart || 0,
      initialTrimEnd: clip.trimEnd || 0,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragState || !tracksAreaRef.current || !duration) return;
    const clientX = getClientX(e);
    const rect = tracksAreaRef.current.getBoundingClientRect();
    const trackWidth = Math.max(10, rect.width - 32);
    const deltaX = clientX - dragState.startX;
    const deltaSec = (deltaX / trackWidth) * duration;

    if (dragState.type === 'clip') {
      const targetClip = videoClips.find((c) => c.id === dragState.clipId);
      if (!targetClip) return;

      if (dragState.mode === 'clip-left' && onUpdateVideoClip) {
        const maxStart = (targetClip.duration || 10) - (dragState.initialTrimEnd || 0) - 0.2;
        const newStart = Math.max(0, Math.min(maxStart, dragState.initialTrimStart + deltaSec));
        onUpdateVideoClip(dragState.clipId, { trimStart: Number(newStart.toFixed(1)) });
      } else if (dragState.mode === 'clip-right' && onUpdateVideoClip) {
        const maxEnd = (targetClip.duration || 10) - (dragState.initialTrimStart || 0) - 0.2;
        const newEnd = Math.max(0, Math.min(maxEnd, dragState.initialTrimEnd - deltaSec));
        onUpdateVideoClip(dragState.clipId, { trimEnd: Number(newEnd.toFixed(1)) });
      } else if (dragState.mode === 'clip-move' && onSwapVideoClips && videoClips.length > 1) {
        const mouseSec = calculateSecFromX(clientX);
        let acc = 0;
        let targetIndex = dragState.currentIndex;
        for (let i = 0; i < videoClips.length; i++) {
          const effDur = Math.max(0.2, (videoClips[i].duration || 0) - (videoClips[i].trimStart || 0) - (videoClips[i].trimEnd || 0));
          if (mouseSec >= acc && mouseSec <= acc + effDur) {
            targetIndex = i;
            break;
          }
          acc += effDur;
        }

        if (targetIndex !== dragState.currentIndex) {
          onSwapVideoClips(dragState.currentIndex, targetIndex);
          setDragState((prev) => (prev ? { ...prev, currentIndex: targetIndex, startX: clientX } : null));
        }
      }
      return;
    }

    const updateFn = dragState.type === 'overlay' ? onUpdateOverlay : onUpdateText;
    const siblingLayers = (dragState.type === 'overlay' ? overlayLayers : textLayers).filter((l) => l.id !== dragState.layerId);
    const SNAP_THRESHOLD = 0.35;

    if (dragState.mode === 'left') {
      let newStart = Math.max(0, Math.min(dragState.initialEnd - 0.5, dragState.initialStart + deltaSec));

      siblingLayers.forEach((sibling) => {
        if (Math.abs(newStart - sibling.endTime) < SNAP_THRESHOLD) newStart = sibling.endTime;
        if (Math.abs(newStart - sibling.startTime) < SNAP_THRESHOLD) newStart = sibling.startTime;
      });

      updateFn(dragState.layerId, { startTime: Number(newStart.toFixed(1)) });
    } else if (dragState.mode === 'right') {
      let newEnd = Math.max(dragState.initialStart + 0.5, Math.min(duration, dragState.initialEnd + deltaSec));

      siblingLayers.forEach((sibling) => {
        if (Math.abs(newEnd - sibling.startTime) < SNAP_THRESHOLD) newEnd = sibling.startTime;
        if (Math.abs(newEnd - sibling.endTime) < SNAP_THRESHOLD) newEnd = sibling.endTime;
      });

      updateFn(dragState.layerId, { endTime: Number(newEnd.toFixed(1)) });
    } else if (dragState.mode === 'move') {
      const layerDuration = dragState.initialEnd - dragState.initialStart;
      let newStart = dragState.initialStart + deltaSec;
      let newEnd = dragState.initialEnd + deltaSec;

      if (newStart < 0) {
        newStart = 0;
        newEnd = layerDuration;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - layerDuration;
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

      updateFn(dragState.layerId, {
        startTime: Number(newStart.toFixed(1)),
        endTime: Number(newEnd.toFixed(1)),
      });
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate exact integer second ticks matching total video duration
  const getRulerTicks = () => {
    const dur = Math.max(1, duration || 10);
    let step = 1;
    if (dur > 24) step = 2;
    if (dur > 60) step = 5;
    if (dur > 150) step = 10;

    const ticks = [];
    for (let s = 0; s <= dur; s += step) {
      ticks.push(s);
    }
    return ticks;
  };

  const ticks = getRulerTicks();

  return (
    <div
      ref={containerRef}
      className="timeline-fullwidth"
      onClick={handleTimelineClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Top Time Ruler Bar (Inner padded to match 16px track margins) */}
      <div className="timeline-top-ruler" onClick={handleTimelineClick}>
        <div className="timeline-ruler-inner">
          {ticks.map((sec) => {
            const percent = duration > 0 ? (sec / duration) * 100 : 0;
            const formatted = sec < 10 ? `0${sec}s` : `${sec}s`;
            let translateX = '-50%';
            if (percent === 0) translateX = '0%';
            if (percent >= 98) translateX = '-100%';

            return (
              <div
                key={sec}
                className="ruler-tick-mark"
                style={{ left: `${percent}%`, transform: `translateX(${translateX})` }}
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
      >
        <div className="timeline-track-inner-zone">
          {/* Filmstrip Thumbnail Track */}
          <div className="filmstrip-track" style={{ position: 'relative' }}>
            {filmstripThumbs.length > 0 ? (
              filmstripThumbs.map((thumbUrl, idx) => (
                <img key={idx} src={thumbUrl} alt="thumb" className="filmstrip-thumb" />
              ))
            ) : (
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} />
            )}

            {/* Merged Video Clips Segment Dividers, Badges & High-Contrast Trim Handles */}
            {videoClips && videoClips.length > 0 && (() => {
              let accTime = 0;
              const totalDur = duration || 10;
              return videoClips.map((clip, index) => {
                const effDur = Math.max(0.2, (clip.duration || 0) - (clip.trimStart || 0) - (clip.trimEnd || 0));
                const startSec = accTime;
                const endSec = accTime + effDur;
                accTime = endSec;

                const leftPercent = (startSec / totalDur) * 100;
                const widthPercent = (effDur / totalDur) * 100;

                return (
                  <div
                    key={clip.id || index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${leftPercent}%`,
                      width: `${Math.max(1, widthPercent)}%`,
                      borderLeft: index > 0 ? '3px solid #38bdf8' : '2px solid #38bdf8',
                      borderRight: '2px solid #38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 0,
                      boxSizing: 'border-box',
                      background: index % 2 === 1 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.1)',
                      pointerEvents: 'auto',
                      cursor: 'grab',
                    }}
                    onMouseDown={(e) => handleStartDragClip(e, clip, index, 'clip-move')}
                    onTouchStart={(e) => handleStartDragClip(e, clip, index, 'clip-move')}
                  >
                    {/* Left Trim Handle (High-contrast CapCut White/Cyan bar with grip lines) */}
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
                      title="Kéo sang phải/trái để xén (trim) đầu video clip"
                      onMouseDown={(e) => handleStartDragClip(e, clip, index, 'clip-left')}
                      onTouchStart={(e) => handleStartDragClip(e, clip, index, 'clip-left')}
                    >
                      <div style={{ width: '2px', height: '14px', borderLeft: '1px solid #0284c7', borderRight: '1px solid #0284c7' }} />
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: '#ffffff',
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(6px)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1.5px solid #38bdf8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '82%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                        zIndex: 2,
                        userSelect: 'none',
                      }}
                    >
                      🎬 Clip #{index + 1}: {clip.name} ({startSec.toFixed(1)}s - {endSec.toFixed(1)}s)
                    </span>

                    {/* Right Trim Handle (High-contrast CapCut White/Cyan bar with grip lines) */}
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
                      title="Kéo sang phải/trái để xén (trim) đuôi video clip"
                      onMouseDown={(e) => handleStartDragClip(e, clip, index, 'clip-right')}
                      onTouchStart={(e) => handleStartDragClip(e, clip, index, 'clip-right')}
                    >
                      <div style={{ width: '2px', height: '14px', borderLeft: '1px solid #0284c7', borderRight: '1px solid #0284c7' }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Video Overlay Sub-tracks */}
          {(overlayLayers || []).length > 0 && (
            <div className="text-layers-track-row">
              {overlayLayers.map((layer) => {
                if (!duration || duration <= 0) return null;
                const leftPercent = (layer.startTime / duration) * 100;
                const widthPercent = ((layer.endTime - layer.startTime) / duration) * 100;
                const isSelected = selectedOverlayId === layer.id;

                return (
                  <div
                    key={layer.id}
                    className={`timeline-track-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${Math.max(2, widthPercent)}%`,
                      background: 'rgba(6, 182, 212, 0.45)',
                      borderColor: '#06b6d4',
                    }}
                    onMouseDown={(e) => handleStartDragTrack(e, layer, 'move', 'overlay')}
                    onTouchStart={(e) => handleStartDragTrack(e, layer, 'move', 'overlay')}
                  >
                    <div
                      className="timeline-track-handle left"
                      title="Kéo để đổi thời gian bắt đầu overlay"
                      onMouseDown={(e) => handleStartDragTrack(e, layer, 'left', 'overlay')}
                      onTouchStart={(e) => handleStartDragTrack(e, layer, 'left', 'overlay')}
                    />

                    <span
                      style={{
                        padding: '0 10px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                      }}
                    >
                      🎬 {layer.name || 'Overlay Video'} ({layer.startTime}s - {layer.endTime}s)
                    </span>

                    <div
                      className="timeline-track-handle right"
                      title="Kéo để đổi thời gian kết thúc overlay"
                      onMouseDown={(e) => handleStartDragTrack(e, layer, 'right', 'overlay')}
                      onTouchStart={(e) => handleStartDragTrack(e, layer, 'right', 'overlay')}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Overlay Sub-tracks */}
          <div className="text-layers-track-row">
            {textLayers.map((layer) => {
              if (!duration || duration <= 0) return null;
              const leftPercent = (layer.startTime / duration) * 100;
              const widthPercent = ((layer.endTime - layer.startTime) / duration) * 100;
              const isSelected = selectedTextId === layer.id;

              return (
                <div
                  key={layer.id}
                  className={`timeline-track-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(2, widthPercent)}%`,
                  }}
                  onMouseDown={(e) => handleStartDragTrack(e, layer, 'move', 'text')}
                  onTouchStart={(e) => handleStartDragTrack(e, layer, 'move', 'text')}
                >
                  {/* Left Edge Drag Handle (Start Time) */}
                  <div
                    className="timeline-track-handle left"
                    title="Kéo để đổi thời gian bắt đầu"
                    onMouseDown={(e) => handleStartDragTrack(e, layer, 'left', 'text')}
                    onTouchStart={(e) => handleStartDragTrack(e, layer, 'left', 'text')}
                  />

                  <span
                    style={{
                      padding: '0 10px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.72rem',
                      fontWeight: '600',
                    }}
                  >
                    💬 {layer.text?.replace(/\n/g, ' ') || 'Text'} ({layer.startTime}s - {layer.endTime}s)
                  </span>

                  {/* Right Edge Drag Handle (End Time) */}
                  <div
                    className="timeline-track-handle right"
                    title="Kéo để đổi thời gian kết thúc"
                    onMouseDown={(e) => handleStartDragTrack(e, layer, 'right', 'text')}
                    onTouchStart={(e) => handleStartDragTrack(e, layer, 'right', 'text')}
                  />
                </div>
              );
            })}
          </div>

          {/* Playhead Line aligned perfectly inside track zone */}
          <div className="capcut-playhead" style={{ left: `${Math.max(0, Math.min(100, currentPercent))}%` }}>
            <div className="capcut-playhead-cap" />
          </div>
        </div>
      </div>
    </div>
  );
}
