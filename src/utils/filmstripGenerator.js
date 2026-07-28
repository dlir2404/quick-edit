/**
 * Generates an array of thumbnail image data URLs across the video duration for filmstrip timeline
 */
export async function generateVideoFilmstrip(videoUrl, count = 10) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 68;
    const ctx = canvas.getContext('2d');

    const thumbnails = [];

    video.onloadedmetadata = async () => {
      const duration = video.duration || 10;
      const step = duration / count;

      for (let i = 0; i < count; i++) {
        const time = Math.min(duration - 0.1, i * step + step / 2);
        video.currentTime = time;

        await new Promise((res) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
            res();
          };
          video.addEventListener('seeked', onSeeked);
        });
      }

      resolve(thumbnails);
    };

    video.onerror = () => {
      resolve([]);
    };
  });
}
