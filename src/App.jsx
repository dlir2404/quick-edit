import React, { useState, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { VideoCanvas } from './components/VideoCanvas';
import { Timeline } from './components/Timeline';
import { ExportModal } from './components/ExportModal';
import { generateSampleVideo } from './utils/sampleVideo';
import { exportVideoClientSide } from './utils/videoExporter';
import { generateVideoFilmstrip } from './utils/filmstripGenerator';
import { fetchTikTokVideo } from './utils/tiktokLoader';

// Helper to calculate effective clip duration after trimming
export function getEffectiveClipDuration(clip) {
  if (!clip) return 0;
  const dur = clip.duration || 0;
  const tStart = clip.trimStart || 0;
  const tEnd = clip.trimEnd || 0;
  return Math.max(0.2, Number((dur - tStart - tEnd).toFixed(1)));
}

// Helper to calculate total merged/multitrack timeline duration
export function calculateTotalClipsDuration(videoClips = []) {
  if (!videoClips || videoClips.length === 0) return 0;
  let maxEnd = 0;
  for (const clip of videoClips) {
    const effDur = getEffectiveClipDuration(clip);
    const startSec = clip.startTime || 0;
    const endSec = startSec + effDur;
    if (endSec > maxEnd) maxEnd = endSec;
  }
  return Number(maxEnd.toFixed(1));
}

// Helper to calculate active clip on main/base track (trackIndex = 0) for primary time seeking
export function getActiveClipForTime(globalTime, videoClips = []) {
  if (!videoClips || videoClips.length === 0) {
    return { clipIndex: -1, clipOffset: 0, localSeekTime: 0, clip: null, accumulatedStart: 0, effDur: 0 };
  }

  // Filter track 0 clips sorted chronologically by startTime
  const track0Clips = videoClips
    .filter((c) => (c.trackIndex || 0) === 0)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  for (let i = 0; i < track0Clips.length; i++) {
    const clip = track0Clips[i];
    const startSec = clip.startTime || 0;
    const effDur = getEffectiveClipDuration(clip);
    const endSec = startSec + effDur;

    if (globalTime >= startSec && globalTime < endSec) {
      const offsetInClip = Math.max(0, globalTime - startSec);
      const localSeekTime = (clip.trimStart || 0) + offsetInClip;
      return {
        clipIndex: i,
        clipOffset: offsetInClip,
        localSeekTime: Number(localSeekTime.toFixed(2)),
        clip,
        accumulatedStart: startSec,
        effDur,
      };
    }
  }

  // No clip on Track 0 covers globalTime
  return {
    clipIndex: -1,
    clipOffset: 0,
    localSeekTime: 0,
    clip: null,
    accumulatedStart: 0,
    effDur: 0,
  };
}

// Helper to get all active clips at globalTime, sorted by trackIndex ascending (lower tracks draw first, upper tracks draw on top)
export function getActiveClipsForTimeAllTracks(globalTime, videoClips = []) {
  if (!videoClips || videoClips.length === 0) return [];
  const active = [];
  for (const clip of videoClips) {
    if (clip.visible === false) continue;
    const startSec = clip.startTime || 0;
    const effDur = getEffectiveClipDuration(clip);
    const endSec = startSec + effDur;
    if (globalTime >= startSec && globalTime <= endSec) {
      const offsetInClip = Math.max(0, globalTime - startSec);
      const localSeekTime = Number(((clip.trimStart || 0) + offsetInClip).toFixed(2));
      active.push({ clip, localSeekTime });
    }
  }
  return active.sort((a, b) => (a.clip.trackIndex || 0) - (b.clip.trackIndex || 0));
}

// Robust helper to safely switch video sources and seek after metadata loads
export function switchVideoSource(videoElement, newUrl, targetLocalTime, shouldPlay = false) {
  if (!videoElement || !newUrl) return;

  const targetTime = Math.max(0.01, Number(targetLocalTime.toFixed(2)));

  if (videoElement.src === newUrl) {
    if (videoElement.readyState >= 1) {
      videoElement.currentTime = targetTime;
      if (shouldPlay) videoElement.play().catch(() => {});
    } else {
      const onReady = () => {
        videoElement.removeEventListener('loadedmetadata', onReady);
        videoElement.currentTime = targetTime;
        if (shouldPlay) videoElement.play().catch(() => {});
      };
      videoElement.addEventListener('loadedmetadata', onReady);
    }
    return;
  }

  const onMeta = () => {
    videoElement.removeEventListener('loadedmetadata', onMeta);
    videoElement.removeEventListener('loadeddata', onMeta);
    try {
      videoElement.currentTime = targetTime;
    } catch (e) {}
    if (shouldPlay) {
      videoElement.play().catch(() => {});
    }
  };

  videoElement.addEventListener('loadedmetadata', onMeta);
  videoElement.addEventListener('loadeddata', onMeta);
  videoElement.src = newUrl;
  videoElement.load();
}

export function App() {
  const videoRef = useRef(null);

  // Active Tab & Drawer state
  const [activeTab, setActiveTab] = useState('video');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Default Text Layer Template Settings (Persisted in localStorage)
  const [defaultTextConfig, setDefaultTextConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_edit_default_text');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      text: "CHÈN CHỮ VÀO VIDEO\nCHÈN CHỮ VÀO VIDEO",
      fontFamily: 'Be Vietnam Pro',
      fontSize: 36,
      color: '#ffffff',
      bgStyle: 'box',
      bgColor: '#6366f1',
      bgOpacity: 1,
      stroke: true,
      strokeColor: '#000000',
      x: 50,
      y: 18,
      defaultStartTime: 0,
      defaultEndTimeMode: 'full',
      defaultEndTime: 10,
    };
  });

  const handleUpdateDefaultTextConfig = (updates) => {
    setDefaultTextConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('quick_edit_default_text', JSON.stringify(next));
      } catch (e) {
        console.error('Lỗi lưu LocalStorage:', e);
      }
      return next;
    });
  };

  // Sync to LocalStorage on state update
  React.useEffect(() => {
    try {
      localStorage.setItem('quick_edit_default_text', JSON.stringify(defaultTextConfig));
    } catch (e) {}
  }, [defaultTextConfig]);

  // Default Video Overlay Template Settings (Persisted in localStorage)
  const [defaultOverlayConfig, setDefaultOverlayConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_edit_default_overlay');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      width: 80,
      opacity: 1,
      x: 50,
      y: 50,
    };
  });

  const handleUpdateDefaultOverlayConfig = (updates) => {
    setDefaultOverlayConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('quick_edit_default_overlay', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Video State
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [filmstripThumbs, setFilmstripThumbs] = useState([]);
  const [isTikTokLoading, setIsTikTokLoading] = useState(false);

  // Video Clips State (Unified Multitrack Clips)
  const [videoClips, setVideoClips] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);

  // Crop State
  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    presetName: 'Gốc (Full)',
  });

  // Text Layers State
  const [textLayers, setTextLayers] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState(null);

  // Sync real video duration from mounted video element
  const handleDurationChange = (realDur) => {
    if (!realDur || !isFinite(realDur) || realDur <= 0) return;

    if (videoClips && videoClips.length > 0) {
      const totalClipsDur = calculateTotalClipsDuration(videoClips);
      if (totalClipsDur > 0) {
        setDuration(totalClipsDur);
        return;
      }
    }

    const roundedDur = Number(realDur.toFixed(1));

    setDuration((prev) => {
      if (Math.abs(prev - roundedDur) > 0.2) {
        setVideoData((prevData) => (prevData ? { ...prevData, duration: roundedDur } : null));

        setTextLayers((prevLayers) =>
          prevLayers.map((l) => {
            if (l.endTime >= prev - 0.5 || l.endTime === 10 || l.endTime < roundedDur) {
              return { ...l, endTime: roundedDur };
            }
            return l;
          })
        );
        return roundedDur;
      }
      return prev;
    });
  };

  // Helper to compute initial text layer start & end time based on defaultTextConfig
  const getInitialLayerTiming = (videoDur, config = defaultTextConfig) => {
    const totalDur = Number((videoDur || 10).toFixed(1));
    const startSec = Math.max(0, Math.min(totalDur, Number(config?.defaultStartTime) || 0));

    let endSec = totalDur;
    if (config?.defaultEndTimeMode === 'custom' && config?.defaultEndTime > 0) {
      endSec = Math.min(totalDur, Number(config.defaultEndTime));
    }
    if (endSec <= startSec) {
      endSec = Math.min(totalDur, Number((startSec + 1).toFixed(1)));
    }
    return {
      startTime: Number(startSec.toFixed(1)),
      endTime: Number(endSec.toFixed(1)),
    };
  };

  // Handle Video File Selection (Primary Video)
  const handleFileSelect = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const videoObj = document.createElement('video');
    videoObj.src = url;

    videoObj.onloadedmetadata = async () => {
      const dur = (videoObj.duration && isFinite(videoObj.duration) && videoObj.duration > 0)
        ? videoObj.duration
        : 10;
      const roundedDur = Number(dur.toFixed(1));

      const firstClip = {
        id: `clip-${Date.now()}`,
        name: file.name,
        url,
        duration: roundedDur,
        width: videoObj.videoWidth,
        height: videoObj.videoHeight,
        startTime: 0,
        trackIndex: 0,
        x: 50,
        y: 50,
        widthPercent: 100,
        opacity: 1,
        volume: 1,
        visible: true,
      };

      setVideoSrc(url);
      setVideoClips([firstClip]);
      setVideoData({
        name: file.name,
        width: videoObj.videoWidth,
        height: videoObj.videoHeight,
        duration: roundedDur,
      });
      setDuration(roundedDur);
      setCrop({ x: 0, y: 0, width: 100, height: 100, presetName: 'Gốc (Full)' });

      generateVideoFilmstrip(url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

      const timing = getInitialLayerTiming(roundedDur);
      const firstLayerId = `text-${Date.now()}`;
      setTextLayers([
        {
          id: firstLayerId,
          ...defaultTextConfig,
          startTime: timing.startTime,
          endTime: timing.endTime,
          visible: true,
        },
      ]);
      setSelectedTextId(firstLayerId);
      setActiveTab('text');
      setIsDrawerOpen(true);
    };
  };

  // Append a secondary video clip (Unified Multitrack Clip)
  const handleAppendVideoClip = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const videoObj = document.createElement('video');
    videoObj.src = url;

    videoObj.onloadedmetadata = () => {
      const dur = (videoObj.duration && isFinite(videoObj.duration) && videoObj.duration > 0)
        ? videoObj.duration
        : 5;
      const roundedDur = Number(dur.toFixed(1));

      setVideoClips((prev) => {
        // Find maximum end time on track 0 to append smoothly, or default to 0
        const track0Clips = prev.filter((c) => (c.trackIndex || 0) === 0);
        let appendStartTime = 0;
        track0Clips.forEach((c) => {
          const effDur = getEffectiveClipDuration(c);
          const end = (c.startTime || 0) + effDur;
          if (end > appendStartTime) appendStartTime = end;
        });

        const newClip = {
          id: `clip-${Date.now()}`,
          name: file.name,
          url,
          duration: roundedDur,
          width: videoObj.videoWidth,
          height: videoObj.videoHeight,
          startTime: Number(appendStartTime.toFixed(1)),
          trackIndex: 0,
          x: 50,
          y: 50,
          widthPercent: 100,
          opacity: 1,
          volume: 1,
          visible: true,
        };

        const nextClips = [...prev, newClip];
        const newTotalDur = calculateTotalClipsDuration(nextClips);
        setDuration(newTotalDur);
        return nextClips;
      });
    };
  };

  // Remove a merged video clip
  const handleRemoveVideoClip = (id) => {
    setVideoClips((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        const track0Clips = remaining
          .filter((c) => (c.trackIndex || 0) === 0)
          .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        const overlayClips = remaining.filter((c) => (c.trackIndex || 0) > 0);

        let currentStart = 0;
        const compactedTrack0 = track0Clips.map((clip) => {
          const effDur = getEffectiveClipDuration(clip);
          const updated = { ...clip, startTime: Number(currentStart.toFixed(1)) };
          currentStart = Number((currentStart + effDur).toFixed(1));
          return updated;
        });

        const nextClips = [...compactedTrack0, ...overlayClips];
        const firstBaseClip = nextClips.find((clip) => (clip.trackIndex || 0) === 0) || nextClips[0];
        setVideoSrc(firstBaseClip.url);
        setDuration(calculateTotalClipsDuration(nextClips));
        return nextClips;
      } else {
        handleReset();
        return [];
      }
    });
  };

  // Update a video clip while dragging without changing the project duration.
  const handleUpdateVideoClip = (id, updates) => {
    setVideoClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleVideoClipDragEnd = () => {
    setVideoClips((prev) => {
      const track0Clips = prev
        .filter((c) => (c.trackIndex || 0) === 0)
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      const overlayClips = prev.filter((c) => (c.trackIndex || 0) > 0);

      let currentStart = 0;
      const compactedTrack0 = track0Clips.map((clip) => {
        const effDur = getEffectiveClipDuration(clip);
        const updated = { ...clip, startTime: Number(currentStart.toFixed(1)) };
        currentStart = Number((currentStart + effDur).toFixed(1));
        return updated;
      });

      const nextClips = [...compactedTrack0, ...overlayClips];
      const newTotalDur = calculateTotalClipsDuration(nextClips);
      if (newTotalDur > 0) setDuration(newTotalDur);
      return nextClips;
    });
  };

  // Reorder video clips (move up / move down)
  const handleReorderVideoClip = (index, direction) => {
    setVideoClips((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const nextClips = [...prev];
      const temp = nextClips[index];
      nextClips[index] = nextClips[targetIndex];
      nextClips[targetIndex] = temp;
      setVideoSrc(nextClips[0].url);
      return nextClips;
    });
  };

  // Swap video clips (Drag-and-drop reorder on Timeline)
  const handleSwapVideoClips = (fromIndex, toIndex) => {
    setVideoClips((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;
      const nextClips = [...prev];
      const [moved] = nextClips.splice(fromIndex, 1);
      nextClips.splice(toIndex, 0, moved);
      if (nextClips.length > 0) setVideoSrc(nextClips[0].url);
      return nextClips;
    });
  };

  // Add a Video Overlay Layer (Unified Clip on trackIndex = 1 or higher)
  const handleAddOverlay = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const videoObj = document.createElement('video');
    videoObj.src = url;

    videoObj.onloadedmetadata = () => {
      const dur = (videoObj.duration && isFinite(videoObj.duration) && videoObj.duration > 0)
        ? videoObj.duration
        : 5;
      const roundedDur = Number(dur.toFixed(1));

      setVideoClips((prev) => {
        const newOverlayId = `clip-overlay-${Date.now()}`;
        const newOverlay = {
          id: newOverlayId,
          name: file.name,
          url,
          duration: roundedDur,
          width: videoObj.videoWidth || 720,
          height: videoObj.videoHeight || 1280,
          startTime: 0,
          trackIndex: 1,
          x: defaultOverlayConfig.x !== undefined ? defaultOverlayConfig.x : 50,
          y: defaultOverlayConfig.y !== undefined ? defaultOverlayConfig.y : 50,
          widthPercent: defaultOverlayConfig.width !== undefined ? defaultOverlayConfig.width : 80,
          opacity: defaultOverlayConfig.opacity !== undefined ? defaultOverlayConfig.opacity : 1,
          volume: 0,
          visible: true,
        };

        const nextClips = [...prev, newOverlay];
        const newTotalDur = calculateTotalClipsDuration(nextClips);
        setDuration(newTotalDur);
        setSelectedOverlayId(newOverlayId);
        setActiveTab('video');
        setIsDrawerOpen(true);
        return nextClips;
      });
    };
  };

  const handleUpdateOverlay = (id, updates) => {
    handleUpdateVideoClip(id, updates);
  };

  const handleDeleteOverlay = (id) => {
    handleRemoveVideoClip(id);
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  // Handle Fetch TikTok Video by URL
  const handleTikTokSubmit = async (url) => {
    if (!url) return;
    setIsTikTokLoading(true);

    try {
      const data = await fetchTikTokVideo(url);
      const initialDur = data.duration || 10;

      const firstClip = {
        id: `clip-tiktok-${Date.now()}`,
        name: data.title || 'TikTok Video',
        url: data.url,
        duration: initialDur,
        width: 720,
        height: 1280,
      };

      setVideoSrc(data.url);
      setVideoClips([firstClip]);
      setVideoData({
        name: data.title || 'TikTok Video',
        width: 720,
        height: 1280,
        duration: initialDur,
      });
      setDuration(initialDur);

      generateVideoFilmstrip(data.url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

      const timing = getInitialLayerTiming(initialDur);
      const firstLayerId = `text-tiktok-${Date.now()}`;
      setTextLayers([
        {
          id: firstLayerId,
          ...defaultTextConfig,
          startTime: timing.startTime,
          endTime: timing.endTime,
          visible: true,
        },
      ]);
      setSelectedTextId(firstLayerId);
      setActiveTab('text');
      setIsDrawerOpen(true);
    } catch (err) {
      console.error('Lỗi nạp TikTok:', err);
      alert(err.message || 'Không thể lấy video TikTok từ URL này.');
    } finally {
      setIsTikTokLoading(false);
    }
  };

  // Handle Load Sample Video
  const handleLoadSample = async () => {
    const sample = await generateSampleVideo();
    const firstClip = {
      id: `clip-sample-${Date.now()}`,
      name: sample.name,
      url: sample.url,
      duration: sample.duration,
      width: sample.width,
      height: sample.height,
    };

    setVideoSrc(sample.url);
    setVideoClips([firstClip]);
    setVideoData({
      name: sample.name,
      width: sample.width,
      height: sample.height,
      duration: sample.duration,
    });
    setDuration(sample.duration);
    setCrop({ x: 0, y: 0, width: 100, height: 100, presetName: 'Gốc (Full)' });

    generateVideoFilmstrip(sample.url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

    const timing = getInitialLayerTiming(sample.duration);
    const firstLayerId = `text-sample-${Date.now()}`;
    setTextLayers([
      {
        id: firstLayerId,
        ...defaultTextConfig,
        startTime: timing.startTime,
        endTime: timing.endTime,
        visible: true,
      },
    ]);
    setSelectedTextId(firstLayerId);
    setActiveTab('text');
    setIsDrawerOpen(true);
  };

  // Reset project
  const handleReset = () => {
    setVideoSrc(null);
    setVideoClips([]);
    setSelectedOverlayId(null);
    setVideoData(null);
    setTextLayers([]);
    setSelectedTextId(null);
    setFilmstripThumbs([]);
    setCrop({ x: 0, y: 0, width: 100, height: 100, presetName: 'Gốc (Full)' });
    setActiveTab('video');
    setIsDrawerOpen(false);
  };

  // Add text layer
  const handleAddText = () => {
    const newId = `text-${Date.now()}`;
    const timing = getInitialLayerTiming(duration || 10);
    const newLayer = {
      id: newId,
      ...defaultTextConfig,
      startTime: timing.startTime,
      endTime: timing.endTime,
      visible: true,
    };
    setTextLayers([...textLayers, newLayer]);
    setSelectedTextId(newId);
  };

  // Update text layer
  const handleUpdateText = (id, updates) => {
    setTextLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer))
    );
  };

  // Delete text layer
  const handleDeleteText = (id) => {
    setTextLayers((prev) => prev.filter((layer) => layer.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };


  // Seek time
  const handleSeek = (newTime) => {
    const totalDur = duration || 10;
    const clampedTime = Math.max(0, Math.min(totalDur, newTime));
    setCurrentTime(clampedTime);

    if (!videoRef.current) return;
    if (videoClips && videoClips.length > 0) {
      const activeInfo = getActiveClipForTime(clampedTime, videoClips);
      if (activeInfo.clip && activeInfo.clip.url) {
        switchVideoSource(videoRef.current, activeInfo.clip.url, activeInfo.localSeekTime, isPlaying);
      }
    } else {
      videoRef.current.currentTime = clampedTime;
    }
  };

  // Export video client-side
  const handleExport = async () => {
    if (!videoRef.current || !videoSrc) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportResult(null);

    try {
      const result = await exportVideoClientSide({
        videoElement: videoRef.current,
        videoClips,
        crop,
        textLayers,
        qualityResolution: {
          width: Math.round((crop.width / 100) * (videoData?.width || 1280)),
          height: Math.round((crop.height / 100) * (videoData?.height || 720)),
        },
        onProgress: (p) => setExportProgress(p),
      });

      setExportResult(result);

      // Auto download video file immediately
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = result.url;
      downloadAnchor.download = `quick_edit_${Date.now()}.${result.mimeType?.includes('mp4') ? 'mp4' : 'webm'}`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
    } catch (err) {
      console.error('Lỗi khi xuất video:', err);
      alert('Không thể xuất video: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const activeClipInfo = getActiveClipForTime(currentTime, videoClips);
  const activeVideoSrc = activeClipInfo.clip ? activeClipInfo.clip.url : videoSrc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Header
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        videoLoaded={!!videoSrc}
        onExportClick={handleExport}
      />

      <div className="main-workspace">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          videoData={videoData}
          onFileSelect={handleFileSelect}
          onLoadSample={handleLoadSample}
          videoClips={videoClips}
          onAppendVideoClip={handleAppendVideoClip}
          onRemoveVideoClip={handleRemoveVideoClip}
          onReorderVideoClip={handleReorderVideoClip}
          selectedOverlayId={selectedOverlayId}
          setSelectedOverlayId={setSelectedOverlayId}
          onAddOverlay={handleAddOverlay}
          onUpdateOverlay={handleUpdateOverlay}
          onDeleteOverlay={handleDeleteOverlay}
          crop={crop}
          setCrop={setCrop}
          textLayers={textLayers}
          selectedTextId={selectedTextId}
          setSelectedTextId={setSelectedTextId}
          onAddText={handleAddText}
          onUpdateText={handleUpdateText}
          onDeleteText={handleDeleteText}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          volume={volume}
          setVolume={setVolume}
          onTikTokSubmit={handleTikTokSubmit}
          isTikTokLoading={isTikTokLoading}
          defaultTextConfig={defaultTextConfig}
          onUpdateDefaultTextConfig={handleUpdateDefaultTextConfig}
          defaultOverlayConfig={defaultOverlayConfig}
          onUpdateDefaultOverlayConfig={handleUpdateDefaultOverlayConfig}
        />

        <VideoCanvas
          videoRef={videoRef}
          videoSrc={activeVideoSrc}
          videoClips={videoClips}
          selectedOverlayId={selectedOverlayId}
          setSelectedOverlayId={setSelectedOverlayId}
          onUpdateOverlay={handleUpdateOverlay}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          duration={duration}
          onDurationChange={handleDurationChange}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          crop={crop}
          setCrop={setCrop}
          textLayers={textLayers}
          selectedTextId={selectedTextId}
          setSelectedTextId={setSelectedTextId}
          onUpdateText={handleUpdateText}
          activeTab={activeTab}
          volume={volume}
          setVolume={setVolume}
          playbackSpeed={playbackSpeed}
          onFileSelect={handleFileSelect}
          onLoadSample={handleLoadSample}
          onTikTokSubmit={handleTikTokSubmit}
          isTikTokLoading={isTikTokLoading}
        />
      </div>

      <Timeline
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        textLayers={textLayers}
        selectedTextId={selectedTextId}
        setSelectedTextId={setSelectedTextId}
        onUpdateText={handleUpdateText}
        videoClips={videoClips}
        onUpdateVideoClip={handleUpdateVideoClip}
        onVideoClipDragEnd={handleVideoClipDragEnd}
        onSwapVideoClips={handleSwapVideoClips}
        selectedOverlayId={selectedOverlayId}
        setSelectedOverlayId={setSelectedOverlayId}
        onUpdateOverlay={handleUpdateOverlay}
        filmstripThumbs={filmstripThumbs}
      />

      <ExportModal
        isExporting={isExporting}
        progress={exportProgress}
        exportResult={exportResult}
        onClose={() => setExportResult(null)}
        onNewProject={handleReset}
      />
    </div>
  );
}

export default App;
