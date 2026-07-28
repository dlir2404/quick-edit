/**
 * Utility to fetch TikTok video metadata & video stream via TikWM API
 */
export async function fetchTikTokVideo(tiktokUrl) {
  const cleanUrl = tiktokUrl.trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập URL TikTok hợp lệ.');
  }

  const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error('Lỗi kết nối tới dịch vụ TikWM API.');
  }

  const json = await response.json();

  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'Không thể lấy dữ liệu video từ URL TikTok này.');
  }

  const playUrl = json.data.play || json.data.wmplay;
  if (!playUrl) {
    throw new Error('Không tìm thấy nguồn video phát.');
  }

  // Attempt blob fetch to avoid canvas cross-origin taint during export
  try {
    const videoRes = await fetch(playUrl);
    if (videoRes.ok) {
      const blob = await videoRes.blob();
      const localUrl = URL.createObjectURL(blob);
      return {
        url: localUrl,
        title: json.data.title || 'TikTok Video',
        cover: json.data.cover,
        duration: json.data.duration,
        author: json.data.author?.nickname || 'TikTok User',
      };
    }
  } catch (e) {
    console.warn('Blob fetch fallback to direct URL:', e);
  }

  return {
    url: playUrl,
    title: json.data.title || 'TikTok Video',
    cover: json.data.cover,
    duration: json.data.duration,
    author: json.data.author?.nickname || 'TikTok User',
  };
}
