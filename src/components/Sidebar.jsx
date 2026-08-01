import React, { useState } from 'react';
import {
  Upload,
  Crop as CropIcon,
  Type,
  Sliders,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Film,
  Volume2,
  Sparkles,
  X,
  Loader2,
  Settings,
  Save,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export function Sidebar({
  activeTab,
  setActiveTab,
  isDrawerOpen,
  setIsDrawerOpen,
  videoData,
  onFileSelect,
  onLoadSample,
  videoClips = [],
  onAppendVideoClip,
  onRemoveVideoClip,
  onReorderVideoClip,
  selectedOverlayId,
  setSelectedOverlayId,
  onAddOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  crop,
  setCrop,
  textLayers,
  selectedTextId,
  setSelectedTextId,
  onAddText,
  onUpdateText,
  onDeleteText,
  playbackSpeed,
  setPlaybackSpeed,
  volume,
  setVolume,
  onTikTokSubmit,
  isTikTokLoading,
  defaultTextConfig,
  onUpdateDefaultTextConfig,
  defaultOverlayConfig,
  onUpdateDefaultOverlayConfig,
}) {
  const [tiktokInput, setTiktokInput] = useState('');
  const [showDefaultSettings, setShowDefaultSettings] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Local state for default config form before explicit Save click
  const [tempDefaultConfig, setTempDefaultConfig] = useState(defaultTextConfig || {});
  const [tempOverlayConfig, setTempOverlayConfig] = useState(defaultOverlayConfig || { width: 80, opacity: 1 });

  // Sync temp state if parent configs change
  React.useEffect(() => {
    if (defaultTextConfig) {
      setTempDefaultConfig(defaultTextConfig);
    }
  }, [defaultTextConfig]);

  React.useEffect(() => {
    if (defaultOverlayConfig) {
      setTempOverlayConfig(defaultOverlayConfig);
    }
  }, [defaultOverlayConfig]);

  const handleSaveDefaultConfig = () => {
    if (onUpdateDefaultTextConfig) {
      onUpdateDefaultTextConfig(tempDefaultConfig);
    }
    if (onUpdateDefaultOverlayConfig) {
      onUpdateDefaultOverlayConfig(tempOverlayConfig);
    }
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2500);
  };

  const CROP_PRESETS = [
    { name: 'Gốc', ratio: 'Full', w: 100, h: 100 },
    { name: '16:9', ratio: 'Ngang', w: 100, h: 56.25 },
    { name: '9:16', ratio: 'TikTok', w: 56.25, h: 100 },
    { name: '1:1', ratio: 'Vuông', w: 100, h: 100 },
    { name: '4:5', ratio: 'Insta', w: 80, h: 100 },
  ];

  const applyCropPreset = (preset) => {
    let w = preset.w;
    let h = preset.h;
    let x = (100 - w) / 2;
    let y = (100 - h) / 2;

    if (x < 0) {
      h = (100 * 100) / preset.w;
      w = 100;
      x = 0;
      y = (100 - h) / 2;
    }

    setCrop({
      x: Math.max(0, Math.min(100 - w, Math.round(x))),
      y: Math.max(0, Math.min(100 - h, Math.round(y))),
      width: Math.round(w),
      height: Math.round(h),
      presetName: preset.name,
    });
  };

  const handleToolClick = (tabKey) => {
    if (activeTab === tabKey && isDrawerOpen) {
      setIsDrawerOpen(false);
    } else {
      setActiveTab(tabKey);
      setIsDrawerOpen(true);
    }
  };

  const handleTikTokFormSubmit = (e) => {
    e.preventDefault();
    if (tiktokInput && onTikTokSubmit) {
      onTikTokSubmit(tiktokInput);
    }
  };

  const selectedTextLayer = textLayers.find((t) => t.id === selectedTextId);
  const selectedOverlayLayer = (videoClips || []).find((c) => c.id === selectedOverlayId);
  const selectedOverlayWidth = selectedOverlayLayer?.widthPercent ?? selectedOverlayLayer?.width ?? 100;
  const selectedOverlayEndTime = selectedOverlayLayer
    ? (selectedOverlayLayer.startTime || 0) + Math.max(
      0.2,
      (selectedOverlayLayer.duration || 10) - (selectedOverlayLayer.trimStart || 0) - (selectedOverlayLayer.trimEnd || 0)
    )
    : 0;

  return (
    <>
      {/* Mobile Backdrop Overlay when drawer is open */}
      {isDrawerOpen && (
        <div
          className="drawer-backdrop-mobile"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Vertical Icon Toolbar (56px) */}
      <div className="vertical-icon-toolbar">
        <button
          className={`tool-icon-btn ${activeTab === 'video' && isDrawerOpen ? 'active' : ''}`}
          onClick={() => handleToolClick('video')}
          title="Nạp & Quản lý Video Clips"
        >
          <Film size={18} />
          <span>Media</span>
        </button>

        <button
          className={`tool-icon-btn ${activeTab === 'text' && isDrawerOpen ? 'active' : ''}`}
          onClick={() => handleToolClick('text')}
          title="Chèn & Quản lý Text"
        >
          <Type size={18} />
          <span>Text</span>
        </button>

        <button
          className={`tool-icon-btn ${activeTab === 'crop' && isDrawerOpen ? 'active' : ''}`}
          onClick={() => handleToolClick('crop')}
          title="Tỷ lệ & Cắt video"
        >
          <CropIcon size={18} />
          <span>Crop</span>
        </button>

        <button
          className={`tool-icon-btn ${activeTab === 'controls' && isDrawerOpen ? 'active' : ''}`}
          onClick={() => handleToolClick('controls')}
          title="Tốc độ & Âm lượng"
        >
          <Sliders size={18} />
          <span>Điều khiển</span>
        </button>
      </div>

      {/* Flyout Drawer Panel */}
      {isDrawerOpen && (
        <div className="tool-drawer-panel">
          <div className="mobile-sheet-handle" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer-header">
            <span>
              {activeTab === 'video' && `📁 Nguồn Media Clips (${videoClips.length})`}
              {activeTab === 'text' && `💬 Chèn Text (${textLayers.length})`}
              {activeTab === 'crop' && '✂️ Cắt Khung Hình (Crop)'}
              {(activeTab === 'audio' || activeTab === 'controls') && '🎛️ Điều Khiển & Cấu Hình'}
            </span>
            <button
              className="btn btn-secondary btn-icon"
              style={{ width: '24px', height: '24px' }}
              onClick={() => setIsDrawerOpen(false)}
            >
              <X size={14} />
            </button>
          </div>

          <div className="drawer-content">
            {/* TAB 1: MEDIA & MERGE VIDEO CLIPS */}
            {activeTab === 'video' && (
              <>
                <form onSubmit={handleTikTokFormSubmit} className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Dán URL Video TikTok</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://www.tiktok.com/@..."
                      value={tiktokInput}
                      onChange={(e) => setTiktokInput(e.target.value)}
                      disabled={isTikTokLoading}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '0 12px', whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                      disabled={isTikTokLoading || !tiktokInput}
                    >
                      {isTikTokLoading ? <Loader2 size={14} className="spin-loader" /> : 'Nạp'}
                    </button>
                  </div>
                </form>

                {!videoData ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    Hoặc chọn file từ máy tính
                    <label className="btn btn-secondary" style={{ cursor: 'pointer', width: '100%', marginTop: '8px' }}>
                      <Upload size={14} /> Chọn File Từ Máy
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

                    <button className="btn btn-secondary" onClick={onLoadSample} style={{ width: '100%', marginTop: '6px' }}>
                      <Sparkles size={14} style={{ color: '#a5b4fc' }} /> Thử Video Mẫu
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎬 Danh Sách Media Clips ({videoClips.length})</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {videoClips.map((clip, index) => {
                        const isSelected = selectedOverlayId === clip.id;
                        const isTrack0 = (clip.trackIndex || 0) === 0;

                        return (
                          <div
                            key={clip.id}
                            onClick={() => setSelectedOverlayId && setSelectedOverlayId(clip.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                              border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-color)'}`,
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                              <span style={{ fontSize: '0.7rem', color: isTrack0 ? '#38bdf8' : '#a7f3d0', fontWeight: '800', flexShrink: 0 }}>
                                T{clip.trackIndex || 0}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {clip.name}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                  {clip.duration?.toFixed(1)}s ({clip.width || 720}x{clip.height || 1280})
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '22px', height: '22px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUpdateOverlay) onUpdateOverlay(clip.id, { visible: clip.visible === false ? true : false });
                                }}
                              >
                                {clip.visible !== false ? <Eye size={11} /> : <EyeOff size={11} style={{ opacity: 0.5 }} />}
                              </button>
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '22px', height: '22px' }}
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onReorderVideoClip) onReorderVideoClip(index, -1);
                                }}
                                title="Di chuyển lên trước"
                                >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '22px', height: '22px' }}
                                disabled={index === videoClips.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onReorderVideoClip) onReorderVideoClip(index, 1);
                                }}
                                title="Di chuyển xuống sau"
                              >
                                <ArrowDown size={11} />
                              </button>
                              <button
                                className="btn btn-danger btn-icon"
                                style={{ width: '22px', height: '22px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRemoveVideoClip) onRemoveVideoClip(clip.id);
                                }}
                                title="Xóa clip này"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <label className="btn btn-primary" style={{ cursor: 'pointer', width: '100%', fontSize: '0.8rem', padding: '8px' }}>
                      <Plus size={15} /> Ghép Thêm Video Clip
                      <input
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            if (onAppendVideoClip) onAppendVideoClip(e.target.files[0]);
                          }
                        }}
                      />
                    </label>

                    <label className="btn btn-secondary" style={{ cursor: 'pointer', width: '100%', fontSize: '0.8rem', borderColor: 'rgba(6, 182, 212, 0.45)', color: '#67e8f9' }}>
                      <Plus size={15} /> Thêm Video Overlay (PIP / Logo)
                      <input
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0] && onAddOverlay) {
                            onAddOverlay(e.target.files[0]);
                          }
                        }}
                      />
                    </label>

                    {selectedOverlayLayer && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#67e8f9', fontWeight: '800' }}>
                          Thuộc tính clip đang chọn · Track {(selectedOverlayLayer.trackIndex || 0) + 1}
                        </div>

                        {(selectedOverlayLayer.trackIndex || 0) > 0 && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                              <div className="form-group">
                                <label className="form-label">Vị trí X: {selectedOverlayLayer.x ?? 50}%</label>
                                <input
                                  type="range"
                                  className="range-slider"
                                  min="0"
                                  max="100"
                                  value={selectedOverlayLayer.x ?? 50}
                                  onChange={(e) => onUpdateOverlay(selectedOverlayLayer.id, { x: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Vị trí Y: {selectedOverlayLayer.y ?? 50}%</label>
                                <input
                                  type="range"
                                  className="range-slider"
                                  min="0"
                                  max="100"
                                  value={selectedOverlayLayer.y ?? 50}
                                  onChange={(e) => onUpdateOverlay(selectedOverlayLayer.id, { y: Number(e.target.value) })}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                              <div className="form-group">
                                <label className="form-label">Kích thước: {selectedOverlayWidth}%</label>
                                <input
                                  type="range"
                                  className="range-slider"
                                  min="5"
                                  max="100"
                                  value={selectedOverlayLayer.widthPercent ?? 100}
                                  onChange={(e) => onUpdateOverlay(selectedOverlayLayer.id, { widthPercent: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Độ mờ: {Math.round((selectedOverlayLayer.opacity ?? 1) * 100)}%</label>
                                <input
                                  type="range"
                                  className="range-slider"
                                  min="0.1"
                                  max="1"
                                  step="0.05"
                                  value={selectedOverlayLayer.opacity ?? 1}
                                  onChange={(e) => onUpdateOverlay(selectedOverlayLayer.id, { opacity: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="form-group">
                          <label className="form-label">Âm lượng clip: {Math.round((selectedOverlayLayer.volume ?? 1) * 100)}%</label>
                          <input
                            type="range"
                            className="range-slider"
                            min="0"
                            max="1"
                            step="0.05"
                            value={selectedOverlayLayer.volume ?? 1}
                            onChange={(e) => onUpdateOverlay(selectedOverlayLayer.id, { volume: Number(e.target.value) })}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span>{(selectedOverlayLayer.startTime || 0).toFixed(1)}s – {selectedOverlayEndTime.toFixed(1)}s</span>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 9px', fontSize: '0.72rem' }}
                            onClick={() => onDeleteOverlay(selectedOverlayLayer.id)}
                          >
                            <Trash2 size={12} /> Xóa clip
                          </button>
                        </div>
                      </div>
                    )}

                    <label className="btn btn-secondary" style={{ cursor: 'pointer', width: '100%', fontSize: '0.78rem' }}>
                      <Upload size={13} /> Đổi Toàn Bộ Video Khác
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
                  </div>
                )}
              </>
            )}

            {/* TAB 2: TEXT */}
            {activeTab === 'text' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Danh Sách Text Layers</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary btn-icon"
                      title="Cấu hình Text Mặc Định"
                      onClick={() => setShowDefaultSettings(!showDefaultSettings)}
                    >
                      <Settings size={15} style={{ color: showDefaultSettings ? 'var(--primary)' : 'inherit' }} />
                    </button>
                    <button className="btn btn-primary btn-icon" title="Thêm chữ mới" onClick={onAddText}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Collapsible Default Settings Section in Text Tab */}
                {showDefaultSettings && tempDefaultConfig && (
                  <div
                    style={{
                      padding: '12px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Settings size={13} /> Text Mặc Định Cho Video Mới</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Chữ Mặc Định</label>
                      <textarea
                        rows={2}
                        className="form-textarea"
                        value={tempDefaultConfig.text || ''}
                        onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, text: e.target.value })}
                        placeholder="Nội dung chữ mặc định..."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Vị trí Y: {tempDefaultConfig.y}%</label>
                        <input
                          type="range"
                          className="range-slider"
                          min="5"
                          max="95"
                          value={tempDefaultConfig.y || 18}
                          onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, y: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Vị trí X: {tempDefaultConfig.x}%</label>
                        <input
                          type="range"
                          className="range-slider"
                          min="5"
                          max="95"
                          value={tempDefaultConfig.x || 50}
                          onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, x: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Bắt đầu từ (s)</label>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          step="0.5"
                          className="form-input"
                          value={tempDefaultConfig.defaultStartTime ?? 0}
                          onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultStartTime: Math.max(0, Number(e.target.value)) })}
                          placeholder="0 (Đầu video)"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Kết thúc tại (s)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            className="form-select"
                            style={{ flex: 1 }}
                            value={tempDefaultConfig.defaultEndTimeMode || 'full'}
                            onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultEndTimeMode: e.target.value })}
                          >
                            <option value="full">Hết Video</option>
                            <option value="custom">Cố định (s)</option>
                          </select>

                          {tempDefaultConfig.defaultEndTimeMode === 'custom' && (
                            <input
                              type="number"
                              min="0.5"
                              max="600"
                              step="0.5"
                              className="form-input"
                              style={{ width: '65px' }}
                              value={tempDefaultConfig.defaultEndTime ?? 10}
                              onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultEndTime: Math.max(0.5, Number(e.target.value)) })}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Default Video Overlay Settings Section */}
                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.74rem', color: '#06b6d4', fontWeight: '800', display: 'block', marginBottom: '6px' }}>
                        🎬 Kích Thước Mặc Định Cho Video Overlay (Watermark/PIP)
                      </span>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                        <div className="form-group">
                          <label className="form-label">Size Rộng Mặc Định: {tempOverlayConfig.width || 80}%</label>
                          <input
                            type="range"
                            className="range-slider"
                            min="10"
                            max="100"
                            value={tempOverlayConfig.width || 80}
                            onChange={(e) => setTempOverlayConfig({ ...tempOverlayConfig, width: Number(e.target.value) })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Độ Mờ Mặc Định: {Math.round((tempOverlayConfig.opacity ?? 1) * 100)}%</label>
                          <input
                            type="range"
                            className="range-slider"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={tempOverlayConfig.opacity ?? 1}
                            onChange={(e) => setTempOverlayConfig({ ...tempOverlayConfig, opacity: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', height: '34px', fontSize: '0.8rem', marginTop: '4px' }}
                      onClick={handleSaveDefaultConfig}
                    >
                      <Save size={14} /> Lưu Cấu Hình Mặc Định
                    </button>

                    {showSaveSuccess && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.72rem', color: '#34d399', fontWeight: '600' }}>
                        <CheckCircle2 size={13} /> Đã lưu vào LocalStorage thành công!
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                  {textLayers.map((layer, index) => (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedTextId(layer.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: selectedTextId === layer.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${selectedTextId === layer.id ? 'var(--primary)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: '700', flexShrink: 0 }}>
                          #{index + 1}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {layer.text?.replace(/\n/g, ' ') || 'Chữ rỗng'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ width: '24px', height: '24px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateText(layer.id, { visible: !layer.visible });
                          }}
                        >
                          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} style={{ opacity: 0.5 }} />}
                        </button>
                        <button
                          className="btn btn-danger btn-icon"
                          style={{ width: '24px', height: '24px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteText(layer.id);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {textLayers.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '10px 0', fontSize: '0.78rem' }}>
                      Bấm nút '+' để thêm chữ vào video
                    </div>
                  )}
                </div>

                {selectedTextLayer && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="form-group">
                      <label className="form-label">Nội dung (Enter xuống dòng)</label>
                      <textarea
                        rows={3}
                        className="form-textarea"
                        style={{ resize: 'vertical' }}
                        value={selectedTextLayer.text}
                        onChange={(e) => onUpdateText(selectedTextLayer.id, { text: e.target.value })}
                        placeholder="Nhập chữ... (Enter để xuống dòng)"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Font chữ</label>
                        <select
                          className="form-select"
                          value={selectedTextLayer.fontFamily}
                          onChange={(e) => onUpdateText(selectedTextLayer.id, { fontFamily: e.target.value })}
                        >
                          <option value="Be Vietnam Pro">Be Vietnam Pro</option>
                          <option value="Inter">Inter</option>
                          <option value="Outfit">Outfit</option>
                          <option value="Impact">Impact</option>
                          <option value="Space Grotesk">Space Grotesk</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Cỡ chữ: {selectedTextLayer.fontSize}px</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="14"
                            max="160"
                            value={selectedTextLayer.fontSize}
                            onChange={(e) => onUpdateText(selectedTextLayer.id, { fontSize: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Màu chữ</label>
                        <input
                          type="color"
                          value={selectedTextLayer.color || '#ffffff'}
                          onChange={(e) => onUpdateText(selectedTextLayer.id, { color: e.target.value })}
                          style={{ width: '100%', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Kiểu nền</label>
                        <select
                          className="form-select"
                          value={selectedTextLayer.bgStyle || 'box'}
                          onChange={(e) => onUpdateText(selectedTextLayer.id, { bgStyle: e.target.value })}
                        >
                          <option value="none">Trong suốt</option>
                          <option value="box">Khung màu</option>
                          <option value="outline">Khung viền</option>
                        </select>
                      </div>
                    </div>

                    {selectedTextLayer.bgStyle !== 'none' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                        <div className="form-group">
                          <label className="form-label">Màu nền</label>
                          <input
                            type="color"
                            value={selectedTextLayer.bgColor === 'transparent' ? '#000000' : (selectedTextLayer.bgColor || '#000000')}
                            onChange={(e) => onUpdateText(selectedTextLayer.id, { bgColor: e.target.value })}
                            style={{ width: '100%', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Độ mờ: {Math.round((selectedTextLayer.bgOpacity ?? 1) * 100)}%</label>
                          <div className="range-slider-container">
                            <input
                              type="range"
                              className="range-slider"
                              min="0"
                              max="1"
                              step="0.05"
                              value={selectedTextLayer.bgOpacity ?? 1}
                              onChange={(e) => onUpdateText(selectedTextLayer.id, { bgOpacity: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline Start & End Controls */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <div className="form-group">
                        <label className="form-label">Bắt đầu: {selectedTextLayer.startTime}s</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="0"
                            max={videoData?.duration || 10}
                            step="0.1"
                            value={selectedTextLayer.startTime}
                            onChange={(e) => onUpdateText(selectedTextLayer.id, { startTime: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Kết thúc: {selectedTextLayer.endTime}s</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="0"
                            max={videoData?.duration || 10}
                            step="0.1"
                            value={selectedTextLayer.endTime}
                            onChange={(e) => onUpdateText(selectedTextLayer.id, { endTime: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-danger"
                      style={{ width: '100%', marginTop: '6px', padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => onDeleteText(selectedTextLayer.id)}
                    >
                      <Trash2 size={14} /> Xóa Text Layer Này
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB 3: CROP */}
            {activeTab === 'crop' && (
              <>
                <div className="form-group">
                  <label className="form-label">Presets Tỷ Lệ</label>
                  <div className="preset-grid">
                    {CROP_PRESETS.map((preset) => (
                      <div
                        key={preset.name}
                        className={`preset-card ${crop.presetName === preset.name ? 'active' : ''}`}
                        onClick={() => applyCropPreset(preset)}
                      >
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-ratio">{preset.ratio}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <div className="form-label"><span>Rộng (Width): {crop.width}%</span></div>
                    <div className="range-slider-container">
                      <input
                        type="range"
                        className="range-slider"
                        min="10"
                        max="100"
                        value={crop.width}
                        onChange={(e) => setCrop({ ...crop, width: Number(e.target.value), presetName: 'Tùy chỉnh' })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <div className="form-label"><span>Cao (Height): {crop.height}%</span></div>
                    <div className="range-slider-container">
                      <input
                        type="range"
                        className="range-slider"
                        min="10"
                        max="100"
                        value={crop.height}
                        onChange={(e) => setCrop({ ...crop, height: Number(e.target.value), presetName: 'Tùy chỉnh' })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <div className="form-label"><span>Vị trí ngang (X): {crop.x}%</span></div>
                    <div className="range-slider-container">
                      <input
                        type="range"
                        className="range-slider"
                        min="0"
                        max={Math.max(0, 100 - crop.width)}
                        value={crop.x}
                        onChange={(e) => setCrop({ ...crop, x: Number(e.target.value), presetName: 'Tùy chỉnh' })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <div className="form-label"><span>Vị trí dọc (Y): {crop.y}%</span></div>
                    <div className="range-slider-container">
                      <input
                        type="range"
                        className="range-slider"
                        min="0"
                        max={Math.max(0, 100 - crop.height)}
                        value={crop.y}
                        onChange={(e) => setCrop({ ...crop, y: Number(e.target.value), presetName: 'Tùy chỉnh' })}
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '4px' }}
                    onClick={() => applyCropPreset(CROP_PRESETS[0])}
                  >
                    Reset Khung Hình Gốc
                  </button>
                </div>
              </>
            )}

            {/* TAB 4: AUDIO & SYSTEM CONFIG */}
            {(activeTab === 'audio' || activeTab === 'controls') && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Volume2 size={14} /> Âm lượng Video: {Math.round(volume * 100)}%
                    </span>
                  </label>
                  <div className="range-slider-container">
                    <input
                      type="range"
                      className="range-slider"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '8px', marginBottom: '14px' }}>
                  <label className="form-label">Tốc độ phát Video</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px' }}>
                    {[0.5, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        className={`btn ${playbackSpeed === spd ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 2px', fontSize: '0.74rem' }}
                        onClick={() => setPlaybackSpeed(spd)}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Default Text Configuration Card */}
                {tempDefaultConfig && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📝 Cấu Hình Text Mặc Định</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Nội dung chữ mặc định</label>
                      <textarea
                        rows={2}
                        className="form-textarea"
                        value={tempDefaultConfig.text || ''}
                        onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, text: e.target.value })}
                        placeholder="Nội dung chữ..."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Vị trí Y: {tempDefaultConfig.y}%</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="5"
                            max="95"
                            value={tempDefaultConfig.y || 18}
                            onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, y: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Vị trí X: {tempDefaultConfig.x}%</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="5"
                            max="95"
                            value={tempDefaultConfig.x || 50}
                            onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, x: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Cỡ chữ: {tempDefaultConfig.fontSize}px</label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            className="range-slider"
                            min="14"
                            max="120"
                            value={tempDefaultConfig.fontSize || 36}
                            onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, fontSize: Number(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Kiểu nền</label>
                        <select
                          className="form-select"
                          value={tempDefaultConfig.bgStyle || 'box'}
                          onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, bgStyle: e.target.value })}
                        >
                          <option value="none">Trong suốt</option>
                          <option value="box">Khung màu</option>
                          <option value="outline">Khung viền</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Bắt đầu từ (s)</label>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          step="0.5"
                          className="form-input"
                          value={tempDefaultConfig.defaultStartTime ?? 0}
                          onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultStartTime: Math.max(0, Number(e.target.value)) })}
                          placeholder="0 (Đầu video)"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Kết thúc tại (s)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            className="form-select"
                            style={{ flex: 1 }}
                            value={tempDefaultConfig.defaultEndTimeMode || 'full'}
                            onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultEndTimeMode: e.target.value })}
                          >
                            <option value="full">Hết Video</option>
                            <option value="custom">Cố định (s)</option>
                          </select>

                          {tempDefaultConfig.defaultEndTimeMode === 'custom' && (
                            <input
                              type="number"
                              min="0.5"
                              max="600"
                              step="0.5"
                              className="form-input"
                              style={{ width: '65px' }}
                              value={tempDefaultConfig.defaultEndTime ?? 10}
                              onChange={(e) => setTempDefaultConfig({ ...tempDefaultConfig, defaultEndTime: Math.max(0.5, Number(e.target.value)) })}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* System Default Video Overlay Configuration Card */}
                    {tempOverlayConfig && (
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>🎬 Cấu Hình Overlay Video Mặc Định</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                          <div className="form-group">
                            <label className="form-label">Size Rộng: {tempOverlayConfig.width || 80}%</label>
                            <div className="range-slider-container">
                              <input
                                type="range"
                                className="range-slider"
                                min="10"
                                max="100"
                                value={tempOverlayConfig.width || 80}
                                onChange={(e) => setTempOverlayConfig({ ...tempOverlayConfig, width: Number(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Độ Mờ: {Math.round((tempOverlayConfig.opacity ?? 1) * 100)}%</label>
                            <div className="range-slider-container">
                              <input
                                type="range"
                                className="range-slider"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={tempOverlayConfig.opacity ?? 1}
                                onChange={(e) => setTempOverlayConfig({ ...tempOverlayConfig, opacity: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Explicit Save Button */}
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', height: '36px', marginTop: '6px', fontSize: '0.82rem' }}
                      onClick={handleSaveDefaultConfig}
                    >
                      <Save size={15} /> Lưu Cấu Hình Mặc Định
                    </button>

                    {showSaveSuccess && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.74rem', color: '#34d399', fontWeight: '600', marginTop: '2px' }}>
                        <CheckCircle2 size={14} /> Đã lưu vào LocalStorage thành công!
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
