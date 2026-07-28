import React from 'react';
import { Film, ShieldCheck, Sparkles, Download, RefreshCw } from 'lucide-react';

export function Header({ onLoadSample, onReset, videoLoaded, onExportClick }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Film size={22} />
        </div>
        <div className="brand-text-container">
          <h1 className="brand-title gradient-text">QuickEdit Studio</h1>
          <p className="brand-tagline">
            Video Editing Client-Side Trực Tiếp
          </p>
        </div>
      </div>

      <div className="header-actions">
        <span className="badge badge-privacy">
          <ShieldCheck size={14} /> <span className="badge-text">100% Client-Side</span>
        </span>

        {!videoLoaded && (
          <button className="btn btn-secondary btn-header-sample" onClick={onLoadSample}>
            <Sparkles size={16} style={{ color: '#a5b4fc' }} /> <span className="btn-text">Thử Video Mẫu</span>
          </button>
        )}

        {videoLoaded && (
          <>
            <button className="btn btn-secondary btn-icon" title="Tải lại / Xóa video" onClick={onReset}>
              <RefreshCw size={16} />
            </button>
            <button className="btn btn-primary btn-header-export" onClick={onExportClick}>
              <Download size={16} /> <span className="btn-text">Xuất Video</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
