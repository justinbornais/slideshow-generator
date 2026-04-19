import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { useSlideshow } from '../store';
import type { Slide, TransitionType } from '../types';

const FRAME_IMAGE_QUALITY = 0.8;

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
      setProgress(50 + Math.round(p * 50));
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

  // Pre-render a slide image to an offscreen canvas for reuse
  const renderSlideImage = (
    slide: Slide,
    width: number,
    height: number,
    imageCache: Map<string, HTMLImageElement>
  ): OffscreenCanvas | null => {
    const img = imageCache.get(slide.imageUrl);
    if (!img) return null;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let dw, dh, dx, dy;
    if (imgRatio > canvasRatio) {
      dh = height; dw = height * imgRatio; dx = (width - dw) / 2; dy = 0;
    } else {
      dw = width; dh = width / imgRatio; dx = 0; dy = (height - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
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
    return canvas;
  };

  const drawTransitionFrame = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    slideCanvas: OffscreenCanvas,
    nextCanvas: OffscreenCanvas | null,
    width: number,
    height: number,
    transitionProgress: number,
    transition: TransitionType,
    introProgress?: number,
    introTransition?: TransitionType,
    endingProgress?: number,
    endingTransition?: TransitionType
  ) => {
    // Intro transition: draw from black
    if (introProgress !== undefined && introTransition && introTransition !== 'none') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      switch (introTransition) {
        case 'fade':
        case 'dissolve':
          ctx.globalAlpha = introProgress;
          ctx.drawImage(slideCanvas, 0, 0);
          break;
        case 'slide-left':
          ctx.drawImage(slideCanvas, width - width * introProgress, 0);
          break;
        case 'slide-right':
          ctx.drawImage(slideCanvas, -width + width * introProgress, 0);
          break;
        case 'slide-up':
          ctx.drawImage(slideCanvas, 0, height - height * introProgress);
          break;
        case 'slide-down':
          ctx.drawImage(slideCanvas, 0, -height + height * introProgress);
          break;
        case 'zoom-in':
          ctx.globalAlpha = introProgress;
          ctx.drawImage(slideCanvas, (width - width * introProgress) / 2, (height - height * introProgress) / 2, width * introProgress, height * introProgress);
          break;
        case 'zoom-out': {
          ctx.globalAlpha = introProgress;
          const s = 2 - introProgress;
          ctx.drawImage(slideCanvas, (width - width * s) / 2, (height - height * s) / 2, width * s, height * s);
          break;
        }
        default:
          ctx.drawImage(slideCanvas, 0, 0);
      }
      ctx.restore();
      return;
    }

    if (endingProgress !== undefined && endingTransition && endingTransition !== 'none') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      switch (endingTransition) {
        case 'fade':
        case 'dissolve':
          ctx.globalAlpha = 1 - endingProgress;
          ctx.drawImage(slideCanvas, 0, 0);
          break;
        case 'slide-left':
          ctx.drawImage(slideCanvas, -width * endingProgress, 0);
          break;
        case 'slide-right':
          ctx.drawImage(slideCanvas, width * endingProgress, 0);
          break;
        case 'slide-up':
          ctx.drawImage(slideCanvas, 0, -height * endingProgress);
          break;
        case 'slide-down':
          ctx.drawImage(slideCanvas, 0, height * endingProgress);
          break;
        case 'zoom-in': {
          const scale = 1 + endingProgress;
          ctx.globalAlpha = 1 - endingProgress;
          ctx.drawImage(
            slideCanvas,
            (width - width * scale) / 2,
            (height - height * scale) / 2,
            width * scale,
            height * scale
          );
          break;
        }
        case 'zoom-out': {
          const scale = Math.max(0.4, 1 - endingProgress * 0.6);
          ctx.globalAlpha = 1 - endingProgress;
          ctx.drawImage(
            slideCanvas,
            (width - width * scale) / 2,
            (height - height * scale) / 2,
            width * scale,
            height * scale
          );
          break;
        }
        default:
          if (endingProgress < 0.5) {
            ctx.drawImage(slideCanvas, 0, 0);
          }
      }
      ctx.restore();
      return;
    }

    // Normal: draw current slide
    ctx.drawImage(slideCanvas, 0, 0);

    // Draw transition to next slide
    if (nextCanvas && transitionProgress > 0 && transition !== 'none') {
      ctx.save();
      switch (transition) {
        case 'fade':
        case 'dissolve':
          ctx.globalAlpha = transitionProgress;
          ctx.drawImage(nextCanvas, 0, 0);
          break;
        case 'slide-left':
          ctx.drawImage(nextCanvas, width - width * transitionProgress, 0);
          break;
        case 'slide-right':
          ctx.drawImage(nextCanvas, -width + width * transitionProgress, 0);
          break;
        case 'slide-up':
          ctx.drawImage(nextCanvas, 0, height - height * transitionProgress);
          break;
        case 'slide-down':
          ctx.drawImage(nextCanvas, 0, -height + height * transitionProgress);
          break;
        case 'zoom-in':
          ctx.globalAlpha = transitionProgress;
          ctx.drawImage(nextCanvas, (width - width * transitionProgress) / 2, (height - height * transitionProgress) / 2, width * transitionProgress, height * transitionProgress);
          break;
        case 'zoom-out': {
          ctx.globalAlpha = transitionProgress;
          const s = 2 - transitionProgress;
          ctx.drawImage(nextCanvas, (width - width * s) / 2, (height - height * s) / 2, width * s, height * s);
          break;
        }
        default:
          if (transitionProgress > 0.5) ctx.drawImage(nextCanvas, 0, 0);
      }
      ctx.restore();
    }
  }, []);

  const encodeFrame = async (canvas: OffscreenCanvas): Promise<Uint8Array> => {
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: FRAME_IMAGE_QUALITY,
    });
    return new Uint8Array(await blob.arrayBuffer());
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
              img.onload = () => { imageCache.set(slide.imageUrl, img); resolve(); };
              img.onerror = () => resolve();
              img.src = slide.imageUrl;
            })
        )
      );

      // Pre-render each slide with text overlays to reusable canvases
      setStatus('Pre-rendering slides...');
      const slideCanvases: (OffscreenCanvas | null)[] = state.slides.map(
        (slide) => renderSlideImage(slide, width, height, imageCache)
      );

      // Build frame segments to know which frames are static vs transitioning
      // This lets us skip rendering for static frames
      interface FrameSegment {
        slideIndex: number;
        startFrame: number;
        endFrame: number; // exclusive
        isStatic: boolean; // no transition happening
      }
      const segments: FrameSegment[] = [];
      let accumulated = 0;
      for (let i = 0; i < state.slides.length; i++) {
        const dur = durations[i] || 5;
        const slideStartFrame = Math.floor(accumulated * fps);
        const slideEndFrame = Math.min(totalFrames, Math.ceil((accumulated + dur) * fps));

        const nextSlide = i < state.slides.length - 1 ? state.slides[i + 1] : null;
        const isLastSlide = i === state.slides.length - 1;
        const nextTransDur = nextSlide ? nextSlide.transitionDuration : 0;
        const introTransDur = (i === 0 && state.settings.introTransition !== 'none') ? state.settings.introTransitionDuration : 0;
        const endingTransDur = (isLastSlide && state.settings.endingTransition !== 'none')
          ? Math.min(dur, state.settings.endingTransitionDuration)
          : 0;

        const introEndFrame = Math.min(slideEndFrame, Math.ceil((accumulated + introTransDur) * fps));
        const firstAvailableFrame = introTransDur > 0 ? introEndFrame : slideStartFrame;
        const transStartFrame = nextTransDur > 0
          ? Math.max(slideStartFrame, Math.floor((accumulated + dur - nextTransDur) * fps))
          : slideEndFrame;
        const endingStartFrame = endingTransDur > 0
          ? Math.max(slideStartFrame, Math.floor((accumulated + dur - endingTransDur) * fps))
          : slideEndFrame;
        const staticEndFrame = Math.min(transStartFrame, endingStartFrame);

        // Intro frames (transition from black)
        if (introTransDur > 0 && introEndFrame > slideStartFrame) {
          segments.push({ slideIndex: i, startFrame: slideStartFrame, endFrame: introEndFrame, isStatic: false });
          if (introEndFrame < staticEndFrame) {
            segments.push({ slideIndex: i, startFrame: introEndFrame, endFrame: staticEndFrame, isStatic: true });
          }
        } else if (staticEndFrame > slideStartFrame) {
          segments.push({ slideIndex: i, startFrame: slideStartFrame, endFrame: staticEndFrame, isStatic: true });
        }

        // Transition-out frames
        if (transStartFrame < slideEndFrame && nextTransDur > 0) {
          segments.push({
            slideIndex: i,
            startFrame: Math.max(transStartFrame, staticEndFrame, firstAvailableFrame),
            endFrame: slideEndFrame,
            isStatic: false,
          });
        }

        if (endingStartFrame < slideEndFrame && endingTransDur > 0) {
          segments.push({
            slideIndex: i,
            startFrame: Math.max(endingStartFrame, staticEndFrame, firstAvailableFrame),
            endFrame: slideEndFrame,
            isStatic: false,
          });
        }

        accumulated += dur;
      }

      // Render and write frames using segment-aware optimization.
      // This avoids holding the entire frame sequence in memory.
      setStatus('Rendering frames...');
      const compositeCanvas = new OffscreenCanvas(width, height);
      const compositeCtx = compositeCanvas.getContext('2d')!;
      let renderedCount = 0;

      for (const seg of segments) {
        const slideCanvas = slideCanvases[seg.slideIndex];
        if (!slideCanvas) continue;

        if (seg.isStatic) {
          // Render once and reuse for all frames in this segment
          compositeCtx.clearRect(0, 0, width, height);
          compositeCtx.drawImage(slideCanvas, 0, 0);
          const encodedFrame = await encodeFrame(compositeCanvas);

          for (let f = seg.startFrame; f < seg.endFrame && f < totalFrames; f++) {
            await ffmpeg.writeFile(
              `frame${f.toString().padStart(6, '0')}.jpg`,
              encodedFrame.slice()
            );
            renderedCount++;
            if (renderedCount % 30 === 0) {
              setProgress(Math.round((renderedCount / totalFrames) * 45));
              setStatus(`Rendering frame ${renderedCount}/${totalFrames}...`);
            }
          }
        } else {
          // Each frame needs individual rendering (transition or intro)
          const dur = durations[seg.slideIndex] || 5;
          let slideAccum = 0;
          for (let k = 0; k < seg.slideIndex; k++) slideAccum += durations[k] || 5;

          const nextSlide = seg.slideIndex < state.slides.length - 1 ? state.slides[seg.slideIndex + 1] : null;
          const nextCanvas = nextSlide ? slideCanvases[seg.slideIndex + 1] : null;

          for (let f = seg.startFrame; f < seg.endFrame && f < totalFrames; f++) {
            const time = f / fps;
            const timeInSlide = time - slideAccum;

            compositeCtx.clearRect(0, 0, width, height);

            // Check intro transition
            const introTransDur = (seg.slideIndex === 0 && state.settings.introTransition !== 'none') ? state.settings.introTransitionDuration : 0;
            const endingTransDur =
              seg.slideIndex === state.slides.length - 1 && state.settings.endingTransition !== 'none'
                ? Math.min(dur, state.settings.endingTransitionDuration)
                : 0;

            if (introTransDur > 0 && timeInSlide < introTransDur) {
              drawTransitionFrame(
                compositeCtx,
                slideCanvas,
                null,
                width,
                height,
                0,
                'none',
                timeInSlide / introTransDur,
                state.settings.introTransition
              );
            } else if (endingTransDur > 0 && timeInSlide > dur - endingTransDur) {
              drawTransitionFrame(
                compositeCtx,
                slideCanvas,
                null,
                width,
                height,
                0,
                'none',
                undefined,
                undefined,
                (timeInSlide - (dur - endingTransDur)) / endingTransDur,
                state.settings.endingTransition
              );
            } else {
              // Check outgoing transition
              const nextTransDur = nextSlide ? nextSlide.transitionDuration : 0;
              let transProgress = 0;
              if (nextTransDur > 0 && timeInSlide > dur - nextTransDur) {
                transProgress = (timeInSlide - (dur - nextTransDur)) / nextTransDur;
              }
              drawTransitionFrame(compositeCtx, slideCanvas, nextCanvas, width, height, transProgress, nextSlide?.transition || 'none');
            }

            await ffmpeg.writeFile(
              `frame${f.toString().padStart(6, '0')}.jpg`,
              (await encodeFrame(compositeCanvas)).slice()
            );
            renderedCount++;
            if (renderedCount % 10 === 0) {
              setProgress(Math.round((renderedCount / totalFrames) * 45));
              setStatus(`Rendering frame ${renderedCount}/${totalFrames}...`);
            }
          }
        }
      }

      setProgress(45);

      // Handle audio
      let hasAudio = false;
      if (state.audioTracks.length > 0) {
        setStatus('Processing audio...');
        for (let i = 0; i < state.audioTracks.length; i++) {
          const track = state.audioTracks[i];
          const audioData = await fetchFile(track.url);
          await ffmpeg.writeFile(`audio${i}.mp3`, audioData);
        }

        if (state.audioTracks.length === 1) {
          await ffmpeg.exec(['-i', 'audio0.mp3', '-c', 'copy', 'combined_audio.mp3']);
        } else {
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

      // Encode video with optimized settings
      setStatus('Encoding video...');
      setProgress(50);

      const ffmpegArgs = [
        '-framerate', fps.toString(),
        '-i', 'frame%06d.jpg',
      ];

      if (hasAudio) {
        ffmpegArgs.push('-i', 'final_audio.mp3');
      }

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-tune', 'stillimage',
        '-crf', '23',
      );

      if (hasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-shortest');
      }

      ffmpegArgs.push('-y', 'output.mp4');

      await ffmpeg.exec(ffmpegArgs);

      setStatus('Reading output...');
      setProgress(95);

      const data = await ffmpeg.readFile('output.mp4');
      const videoBytes = typeof data === 'string' ? new TextEncoder().encode(data) : Uint8Array.from(data);
      const blob = new Blob([
        videoBytes.buffer.slice(
          videoBytes.byteOffset,
          videoBytes.byteOffset + videoBytes.byteLength
        ),
      ], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'slideshow.mp4';
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup
      for (let i = 0; i < totalFrames; i++) {
        try { await ffmpeg.deleteFile(`frame${i.toString().padStart(6, '0')}.jpg`); } catch { /* ignore */ }
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
