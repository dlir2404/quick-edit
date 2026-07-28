// Utility to generate a high quality animated sample video in-browser
export function generateSampleVideo() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve({
        url,
        name: 'sample_nature_demo.mp4',
        width: 1280,
        height: 720,
        duration: 8
      });
    };

    let frame = 0;
    const totalFrames = 30 * 8; // 8 seconds video

    mediaRecorder.start();

    const drawFrame = () => {
      const time = frame / 30;

      // Dynamic glowing background
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#311042');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Draw animated orb 1
      const x1 = 640 + Math.sin(time * 1.5) * 300;
      const y1 = 360 + Math.cos(time * 2) * 150;
      const r1 = 180 + Math.sin(time) * 40;
      const g1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, r1);
      g1.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
      g1.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(x1, y1, r1, 0, Math.PI * 2);
      ctx.fill();

      // Draw animated orb 2
      const x2 = 640 - Math.sin(time * 2) * 350;
      const y2 = 360 - Math.cos(time * 1.2) * 180;
      const r2 = 220 + Math.cos(time * 1.5) * 30;
      const g2 = ctx.createRadialGradient(x2, y2, 10, x2, y2, r2);
      g2.addColorStop(0, 'rgba(236, 72, 153, 0.7)');
      g2.addColorStop(1, 'rgba(236, 72, 153, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(x2, y2, r2, 0, Math.PI * 2);
      ctx.fill();

      // Grid pattern effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 1280; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 720);
        ctx.stroke();
      }

      // Sample visual elements
      ctx.font = '800 64px "Outfit", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.fillText('QUICK EDIT DEMO VIDEO', 640, 320);

      ctx.font = '500 28px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText('Kéo thả chữ & Crop video trực tiếp 100% Client-Side', 640, 390);

      // Timer counter badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(540, 440, 200, 44);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(540, 440, 200, 44);

      ctx.font = '700 20px monospace';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`00:0${Math.floor(time)}.${Math.floor((time % 1) * 10)} / 00:08`, 640, 468);

      frame++;
      if (frame < totalFrames) {
        requestAnimationFrame(drawFrame);
      } else {
        mediaRecorder.stop();
      }
    };

    drawFrame();
  });
}
