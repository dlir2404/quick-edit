import React from 'react';
import { Download, Loader2, CheckCircle2, X } from 'lucide-react';

export function ExportModal({ isExporting, progress, exportResult, onClose }) {
  if (!isExporting && !exportResult) return null;

  return (
    <div className="export-modal-backdrop">
      <div className="export-modal glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800' }} className="gradient-text">
            {exportResult ? 'Xuất Video Thành Công!' : 'Đang Đốt Khung Hình & Xuất Video...'}
          </h3>
          {exportResult && (
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          )}
        </div>

        {isExporting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--primary)' }}>
              <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{progress}%</span>
            </div>

            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              🎯 Process 100% Client-Side trên trình duyệt của bạn (Không tốn dữ liệu mạng, bảo mật tối đa).
            </p>
          </div>
        )}

        {exportResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', margin: '12px 0' }}>
            <CheckCircle2 size={56} style={{ color: '#34d399' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Video đã được cắt & ghép chữ hoàn tất!
            </p>

            <a
              href={exportResult.url}
              download={`quick_edit_${Date.now()}.${exportResult.mimeType?.includes('mp4') ? 'mp4' : 'webm'}`}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
            >
              <Download size={18} /> Tải Video Ngay
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
