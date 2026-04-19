import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { useSlideshow } from '../store';
import type { Slide, TransitionType } from '../types';

export function ExportPanel() {
  const { state, getComputedDurations } = useSlideshow();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress: p }) => {
      setProgress(Math.round(p * 100));
    });
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const renderFrameToBlob = useCallback(
    async (
      time: number,
      width: number,
      height: number,
      imageCache: Map<string, HTMLImageElement>
    ): Promise<Uint8Array> => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      const durations = getComputedDurations();

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Find current slide
      let accumulated = 0;
      let slideIndex = 0;
      let timeInSlide = 0;
      let slideDuration = 0;

      for (let i = 0; i < state.slides.length; i++) {
        const dur = durations[i] || 5;
        if (time < accumulated + dur) {
          slideIndex = i;
          timeInSlide = time - accumulated;
          slideDuration = dur;
          break;
        }
        accumulated += dur;
        if (i === state.slides.length - 1) {
          slideIndex = i;
          timeInSlide = dur;
          slideDuration = dur;
        }
      }

      const slide = state.slides[slideIndex];
      const nextSlide =
        slideIndex < state.slides.length - 1 ? state.slides[slideIndex + 1] : null;

      // Draw current slide
      drawSlideOnCanvas(ctx, slide, width, height, imageCache);

      // Draw transition
      if (nextSlide) {
        const transitionDuration = nextSlide.transitionDuration;
        if (timeInSlide > slideDuration - transitionDuration) {
          const progress =
            (timeInSlide - (slideDuration - transitionDuration)) / transitionDuration;
          drawTransitionOnCanvas(
            ctx,
            nextSlide,
            width,
            height,
            progress,
            nextSlide.transition,
            imageCache
          );
        }
      }

      // Draw text overlays
      for (const overlay of slide.textOverlays) {
        const x = (overlay.x / 100) * width;
        const y = (overlay.y / 100) * height;
        const scaledFontSize = (overlay.fontSize / 1080) * height;
        ctx.save();
        ctx.font = `${overlay.italic ? 'italic ' : ''}${overlay.bold ? 'bold ' : ''}${scaledFontSize}px ${overlay.fontFamily}`;
        ctx.fillStyle = overlay.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(overlay.text, x, y);
        ctx.restore();
      }

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
    },
    [state.slides, getComputedDurations]
  );

  const drawSlideOnCanvas = (
    ctx: OffscreenCanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    imageCache: Map<string, HTMLImageElement>
  ) => {
    const img = imageCache.get(slide.imageUrl);
    if (!img) return;

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let dw, dh, dx, dy;
    if (imgRatio > canvasRatio) {
      dh = height;
      dw = height * imgRatio;
      dx = (width - dw) / 2;
      dy = 0;
    } else {
      dw = width;
      dh = width / imgRatio;
      dx = 0;
      dy = (height - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  const drawTransitionOnCanvas = (
    ctx: OffscreenCanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    progress: number,
    transition: TransitionType,
    imageCache: Map<string, HTMLImageElement>
  ) => {
    const img = imageCache.get(slide.imageUrl);
    if (!img) return;

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let dw, dh, dx, dy;
    if (imgRatio > canvasRatio) {
      dh = height;
      dw = height * imgRatio;
      dx = (width - dw) / 2;
      dy = 0;
    } else {
      dw = width;
      dh = width / imgRatio;
      dx = 0;
      dy = (height - dh) / 2;
    }

    ctx.save();
    switch (transition) {
      case 'fade':
      case 'dissolve':
        ctx.globalAlpha = progress;
        ctx.drawImage(img, dx, dy, dw, dh);
        break;
      case 'slide-left':
        ctx.drawImage(img, width - width * progress + dx, dy, dw, dh);
        break;
      case 'slide-right':
        ctx.drawImage(img, -width + width * progress + dx, dy, dw, dh);
        break;
      case 'slide-up':
        ctx.drawImage(img, dx, height - height * progress + dy, dw, dh);
        break;
      case 'slide-down':
        ctx.drawImage(img, dx, -height + height * progress + dy, dw, dh);
        break;
      case 'zoom-in': {
        ctx.globalAlpha = progress;
        const zw = dw * progress;
        const zh = dh * progress;
        ctx.drawImage(img, (width - zw) / 2, (height - zh) / 2, zw, zh);
        break;
      }
      case 'zoom-out': {
        ctx.globalAlpha = progress;
        const scale = 2 - progress;
        const zw2 = dw * scale;
        const zh2 = dh * scale;
        ctx.drawImage(img, (width - zw2) / 2, (height - zh2) / 2, zw2, zh2);
        break;
      }
      default:
        if (progress > 0.5) {
          ctx.drawImage(img, dx, dy, dw, dh);
        }
    }
    ctx.restore();
  };

  const handleExport = async () => {
    if (state.slides.length === 0) return;

    setIsExporting(true);
    setProgress(0);
    setStatus('Loading FFmpeg...');

    try {
      const ffmpeg = await loadFFmpeg();
      const { width, height } = state.settings.resolution;
      const fps = state.settings.fps;
      const durations = getComputedDurations();
      const totalDuration = durations.reduce((a, b) => a + b, 0);
      const totalFrames = Math.ceil(totalDuration * fps);

      // Preload all images
      setStatus('Loading images...');
      const imageCache = new Map<string, HTMLImageElement>();
      await Promise.all(
        state.slides.map(
          (slide) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                imageCache.set(slide.imageUrl, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = slide.imageUrl;
            })
        )
      );

      // Render frames
      setStatus('Rendering frames...');
      for (let i = 0; i < totalFrames; i++) {
        const time = (i / fps);
        const frameData = await renderFrameToBlob(time, width, height, imageCache);
        const frameName = `frame${i.toString().padStart(6, '0')}.png`;
        await ffmpeg.writeFile(frameName, frameData);
        setProgress(Math.round(((i + 1) / totalFrames) * 50));
        setStatus(`Rendering frame ${i + 1}/${totalFrames}...`);
      }

      // Handle audio
      let hasAudio = false;
      if (state.audioTracks.length > 0) {
        setStatus('Processing audio...');
        // Write each audio file
        for (let i = 0; i < state.audioTracks.length; i++) {
          const track = state.audioTracks[i];
          const audioData = await fetchFile(track.url);
          await ffmpeg.writeFile(`audio${i}.mp3`, audioData);
        }

        // Concatenate audio files
        if (state.audioTracks.length === 1) {
          // Single audio file - just rename
          await ffmpeg.exec(['-i', 'audio0.mp3', '-c', 'copy', 'combined_audio.mp3']);
        } else {
          // Multiple audio files - create concat list
          let concatList = '';
          for (let i = 0; i < state.audioTracks.length; i++) {
            concatList += `file 'audio${i}.mp3'\n`;
          }
          await ffmpeg.writeFile('audiolist.txt', new TextEncoder().encode(concatList));
          await ffmpeg.exec([
            '-f', 'concat', '-safe', '0', '-i', 'audiolist.txt',
            '-c', 'copy', 'combined_audio.mp3',
          ]);
        }

        // Apply fade effects
        const audioFilters: string[] = [];
        if (state.settings.fadeInMusic) {
          audioFilters.push(`afade=t=in:st=0:d=${state.settings.fadeDuration}`);
        }
        if (state.settings.fadeOutMusic) {
          const fadeStart = Math.max(0, totalDuration - state.settings.fadeDuration);
          audioFilters.push(`afade=t=out:st=${fadeStart}:d=${state.settings.fadeDuration}`);
        }

        if (audioFilters.length > 0) {
          await ffmpeg.exec([
            '-i', 'combined_audio.mp3',
            '-af', audioFilters.join(','),
            '-t', totalDuration.toString(),
            'final_audio.mp3',
          ]);
        } else {
          await ffmpeg.exec([
            '-i', 'combined_audio.mp3',
            '-t', totalDuration.toString(),
            '-c', 'copy',
            'final_audio.mp3',
          ]);
        }
        hasAudio = true;
      }

      // Encode video
      setStatus('Encoding video...');
      setProgress(50);

      const ffmpegArgs = [
        '-framerate', fps.toString(),
        '-i', 'frame%06d.png',
      ];

      if (hasAudio) {
        ffmpegArgs.push('-i', 'final_audio.mp3');
      }

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '23',
      );

      if (hasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-shortest');
      }

      ffmpegArgs.push('-y', 'output.mp4');

      await ffmpeg.exec(ffmpegArgs);

      setStatus('Reading output...');
      setProgress(90);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slideshow.mp4';
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup files in FFmpeg
      for (let i = 0; i < totalFrames; i++) {
        const frameName = `frame${i.toString().padStart(6, '0')}.png`;
        try {
          await ffmpeg.deleteFile(frameName);
        } catch {
          // ignore
        }
      }

      setStatus('Export complete!');
      setProgress(100);
    } catch (err) {
      console.error('Export error:', err);
      setStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="panel export-panel">
      <h2>Export</h2>
      <button
        onClick={handleExport}
        disabled={isExporting || state.slides.length === 0}
        className="btn-primary btn-export"
      >
        {isExporting ? 'Exporting...' : 'Export as MP4'}
      </button>

      {state.slides.length === 0 && (
        <p className="info-text">Add at least one image to export.</p>
      )}

      {isExporting && (
        <div className="export-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">
            {progress}% - {status}
          </p>
        </div>
      )}

      {!isExporting && status && (
        <p className="info-text">{status}</p>
      )}
    </div>
  );
}
