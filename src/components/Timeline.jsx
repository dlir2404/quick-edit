import React, { useState, useRef } from 'react';

export function Timeline({
  duration,
  currentTime,
  onSeek,
  textLayers,
  selectedTextId,
  setSelectedTextId,
  onUpdateText,
  filmstripThumbs = [],
}) {
  const tracksAreaRef = useRef(null);

  // Dragging track state: { layerId, mode: 'left' | 'right' | 'move', startX, initialStart, initialEnd }
  const [dragState, setDragState] = useState(null);

  const calculateSecFromX = (clientX) => {
    if (!tracksAreaRef.current || !duration || duration <= 0) return 0;
    const rect = tracksAreaRef.current.getBoundingClientRect();
    const trackWidth = Math.max(10, rect.width - 32);
    const clickX = clientX - rect.left - 16;
    const percent = Math.max(0, Math.min(1, clickX / trackWidth));
    return percent * duration;
  };

  const handleTimelineClick = (e) => {
    if (dragState) return;
    const sec = calculateSecFromX(e.clientX);
    onSeek(sec);
  };

  // Start dragging track handle or track body
  const handleStartDragTrack = (e, layer, mode) => {
    e.stopPropagation();
    setSelectedTextId(layer.id);
    setDragState({
      layerId: layer.id,
      mode,
      startX: e.clientX,
      initialStart: layer.startTime,
      initialEnd: layer.endTime,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragState || !tracksAreaRef.current || !duration) return;
    const rect = tracksAreaRef.current.getBoundingClientRect();
    const trackWidth = Math.max(10, rect.width - 32);
    const deltaX = e.clientX - dragState.startX;
    const deltaSec = (deltaX / trackWidth) * duration;

    if (dragState.mode === 'left') {
      const newStart = Math.max(0, Math.min(dragState.initialEnd - 0.5, dragState.initialStart + deltaSec));
      onUpdateText(dragState.layerId, { startTime: Number(newStart.toFixed(1)) });
    } else if (dragState.mode === 'right') {
      const newEnd = Math.max(dragState.initialStart + 0.5, Math.min(duration, dragState.initialEnd + deltaSec));
      onUpdateText(dragState.layerId, { endTime: Number(newEnd.toFixed(1)) });
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

      onUpdateText(dragState.layerId, {
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
    <div className="timeline-fullwidth" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Top Time Ruler Bar (Inner padded to match 16px track margins) */}
      <div className="timeline-top-ruler">
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
      <div className="timeline-tracks-area" ref={tracksAreaRef} onClick={handleTimelineClick}>
        <div className="timeline-track-inner-zone">
          {/* Filmstrip Thumbnail Track */}
          <div className="filmstrip-track">
            {filmstripThumbs.length > 0 ? (
              filmstripThumbs.map((thumbUrl, idx) => (
                <img key={idx} src={thumbUrl} alt="thumb" className="filmstrip-thumb" />
              ))
            ) : (
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} />
            )}
          </div>

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
                  onMouseDown={(e) => handleStartDragTrack(e, layer, 'move')}
                >
                  {/* Left Edge Drag Handle (Start Time) */}
                  <div
                    className="timeline-track-handle left"
                    title="Kéo để đổi thời gian bắt đầu"
                    onMouseDown={(e) => handleStartDragTrack(e, layer, 'left')}
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
                    onMouseDown={(e) => handleStartDragTrack(e, layer, 'right')}
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
