import React from 'react';
import { Film, ShieldCheck, Sparkles, Download, RefreshCw } from 'lucide-react';

export function Header({ onLoadSample, onReset, videoLoaded, onExportClick }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Film size={22} />
        </div>
        <div>
          <h1 className="brand-title gradient-text">QuickEdit Studio</h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Video Editing Client-Side Trực Tiếp
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="badge badge-privacy">
          <ShieldCheck size={14} /> 100% Client-Side Privacy
        </span>

        {!videoLoaded && (
          <button className="btn btn-secondary" onClick={onLoadSample}>
            <Sparkles size={16} style={{ color: '#a5b4fc' }} /> Thử Video Mẫu
          </button>
        )}

        {videoLoaded && (
          <>
            <button className="btn btn-secondary btn-icon" title="Tải lại / Xóa video" onClick={onReset}>
              <RefreshCw size={16} />
            </button>
            <button className="btn btn-primary" onClick={onExportClick}>
              <Download size={16} /> Xuất Video
            </button>
          </>
        )}
      </div>
    </header>
  );
}
