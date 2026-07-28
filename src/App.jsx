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

  // Handle Video File Selection
  const handleFileSelect = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const videoObj = document.createElement('video');
    videoObj.src = url;

    videoObj.onloadedmetadata = async () => {
      const dur = (videoObj.duration && isFinite(videoObj.duration) && videoObj.duration > 0)
        ? videoObj.duration
        : 10;

      setVideoSrc(url);
      setVideoData({
        name: file.name,
        width: videoObj.videoWidth,
        height: videoObj.videoHeight,
        duration: Number(dur.toFixed(1)),
      });
      setDuration(Number(dur.toFixed(1)));
      setCrop({ x: 0, y: 0, width: 100, height: 100, presetName: 'Gốc (Full)' });

      generateVideoFilmstrip(url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

      const firstLayerId = `text-${Date.now()}`;
      setTextLayers([
        {
          id: firstLayerId,
          ...defaultTextConfig,
          startTime: 0,
          endTime: Number(dur.toFixed(1)),
          visible: true,
        },
      ]);
      setSelectedTextId(firstLayerId);
      setActiveTab('text');
      setIsDrawerOpen(true);
    };
  };

  // Handle Fetch TikTok Video by URL
  const handleTikTokSubmit = async (url) => {
    if (!url) return;
    setIsTikTokLoading(true);

    try {
      const data = await fetchTikTokVideo(url);
      const initialDur = data.duration || 10;

      setVideoSrc(data.url);
      setVideoData({
        name: data.title || 'TikTok Video',
        width: 720,
        height: 1280,
        duration: initialDur,
      });
      setDuration(initialDur);

      generateVideoFilmstrip(data.url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

      const firstLayerId = `text-tiktok-${Date.now()}`;
      setTextLayers([
        {
          id: firstLayerId,
          ...defaultTextConfig,
          startTime: 0,
          endTime: initialDur,
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
    setVideoSrc(sample.url);
    setVideoData({
      name: sample.name,
      width: sample.width,
      height: sample.height,
      duration: sample.duration,
    });
    setDuration(sample.duration);
    setCrop({ x: 0, y: 0, width: 100, height: 100, presetName: 'Gốc (Full)' });

    generateVideoFilmstrip(sample.url, 12).then((thumbs) => setFilmstripThumbs(thumbs));

    const firstLayerId = `text-sample-${Date.now()}`;
    setTextLayers([
      {
        id: firstLayerId,
        ...defaultTextConfig,
        startTime: 0,
        endTime: sample.duration,
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
    const newLayer = {
      id: newId,
      ...defaultTextConfig,
      startTime: 0,
      endTime: duration || 10,
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
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
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
        />

        <VideoCanvas
          videoRef={videoRef}
          videoSrc={videoSrc}
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
