import { useState, useRef, useEffect, useCallback } from 'react';
import { useSlideshow } from '../store';
import type { Slide, TransitionType } from '../types';

export function Preview() {
  const { state, getComputedDurations } = useSlideshow();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const durations = getComputedDurations();
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  const getCurrentSlideInfo = useCallback(
    (time: number) => {
      let accumulated = 0;
      for (let i = 0; i < state.slides.length; i++) {
        const dur = durations[i] || 5;
        if (time < accumulated + dur) {
          return {
            index: i,
            slide: state.slides[i],
            progress: (time - accumulated) / dur,
            timeInSlide: time - accumulated,
            duration: dur,
          };
        }
        accumulated += dur;
      }
      return state.slides.length > 0
        ? {
            index: state.slides.length - 1,
            slide: state.slides[state.slides.length - 1],
            progress: 1,
            timeInSlide: durations[state.slides.length - 1],
            duration: durations[state.slides.length - 1],
          }
        : null;
    },
    [state.slides, durations]
  );

  const drawFrame = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = state.settings.resolution;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      if (state.slides.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add images to preview', width / 2, height / 2);
        return;
      }

      const info = getCurrentSlideInfo(time);
      if (!info) return;

      const { index, slide, timeInSlide, duration } = info;
      const nextSlide = index < state.slides.length - 1 ? state.slides[index + 1] : null;
      const isLastSlide = index === state.slides.length - 1;

      // Intro transition for first slide
      if (index === 0 && state.settings.introTransition !== 'none') {
        const introDur = state.settings.introTransitionDuration;
        if (timeInSlide < introDur) {
          const introProgress = timeInSlide / introDur;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, width, height);
          drawTransition(ctx, slide, width, height, introProgress, state.settings.introTransition);
          drawTextOverlays(ctx, slide, width, height, introProgress);
          return;
        }
      }

      if (isLastSlide && state.settings.endingTransition !== 'none') {
        const endingDur = Math.min(duration, state.settings.endingTransitionDuration);
        if (timeInSlide > duration - endingDur) {
          const endingProgress = (timeInSlide - (duration - endingDur)) / endingDur;
          drawExitTransition(
            ctx,
            slide,
            width,
            height,
            endingProgress,
            state.settings.endingTransition
          );
          drawTextOverlays(ctx, slide, width, height, 1 - endingProgress);
          return;
        }
      }

      // Determine transition
      const transitionDuration = nextSlide ? nextSlide.transitionDuration : 0;
      const transitionProgress =
        nextSlide && timeInSlide > duration - transitionDuration
          ? (timeInSlide - (duration - transitionDuration)) / transitionDuration
          : 0;

      drawSlide(ctx, slide, width, height, 1);

      if (nextSlide && transitionProgress > 0) {
        drawTransition(ctx, nextSlide, width, height, transitionProgress, nextSlide.transition);
      }

      // Draw text overlays
      drawTextOverlays(ctx, slide, width, height);
    },
    [state.slides, state.settings, getCurrentSlideInfo]
  );

  // Image cache
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const getImage = (url: string): HTMLImageElement | null => {
    if (imageCache.current.has(url)) {
      return imageCache.current.get(url)!;
    }
    const img = new Image();
    img.src = url;
    img.onload = () => {
      imageCache.current.set(url, img);
    };
    return null;
  };

  const drawSlide = (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    alpha: number
  ) => {
    const img = getImage(slide.imageUrl);
    if (!img) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Cover fit
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawWidth, drawHeight, drawX, drawY;

    if (imgRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
      drawX = (width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = 0;
      drawY = (height - drawHeight) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  };

  const drawTransition = (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    progress: number,
    transition: TransitionType
  ) => {
    const img = getImage(slide.imageUrl);
    if (!img) return;

    ctx.save();

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawWidth, drawHeight, drawX, drawY;
    if (imgRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
      drawX = (width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = 0;
      drawY = (height - drawHeight) / 2;
    }

    switch (transition) {
      case 'fade':
      case 'dissolve':
        ctx.globalAlpha = progress;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        break;
      case 'slide-left':
        ctx.drawImage(img, width - width * progress + drawX, drawY, drawWidth, drawHeight);
        break;
      case 'slide-right':
        ctx.drawImage(img, -width + width * progress + drawX, drawY, drawWidth, drawHeight);
        break;
      case 'slide-up':
        ctx.drawImage(img, drawX, height - height * progress + drawY, drawWidth, drawHeight);
        break;
      case 'slide-down':
        ctx.drawImage(img, drawX, -height + height * progress + drawY, drawWidth, drawHeight);
        break;
      case 'zoom-in': {
        const scale = progress;
        ctx.globalAlpha = progress;
        const zw = drawWidth * scale;
        const zh = drawHeight * scale;
        ctx.drawImage(img, (width - zw) / 2, (height - zh) / 2, zw, zh);
        break;
      }
      case 'zoom-out': {
        const scale = 2 - progress;
        ctx.globalAlpha = progress;
        const zw2 = drawWidth * scale;
        const zh2 = drawHeight * scale;
        ctx.drawImage(img, (width - zw2) / 2, (height - zh2) / 2, zw2, zh2);
        break;
      }
      default:
        ctx.globalAlpha = progress > 0.5 ? 1 : 0;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }

    ctx.restore();
  };

  const drawExitTransition = (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    progress: number,
    transition: TransitionType
  ) => {
    const img = getImage(slide.imageUrl);
    if (!img) return;

    ctx.save();

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawWidth, drawHeight, drawX, drawY;
    if (imgRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
      drawX = (width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = 0;
      drawY = (height - drawHeight) / 2;
    }

    switch (transition) {
      case 'fade':
      case 'dissolve':
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        break;
      case 'slide-left':
        ctx.drawImage(img, drawX - width * progress, drawY, drawWidth, drawHeight);
        break;
      case 'slide-right':
        ctx.drawImage(img, drawX + width * progress, drawY, drawWidth, drawHeight);
        break;
      case 'slide-up':
        ctx.drawImage(img, drawX, drawY - height * progress, drawWidth, drawHeight);
        break;
      case 'slide-down':
        ctx.drawImage(img, drawX, drawY + height * progress, drawWidth, drawHeight);
        break;
      case 'zoom-in': {
        const scale = 1 + progress;
        ctx.globalAlpha = 1 - progress;
        const zw = drawWidth * scale;
        const zh = drawHeight * scale;
        ctx.drawImage(img, (width - zw) / 2, (height - zh) / 2, zw, zh);
        break;
      }
      case 'zoom-out': {
        const scale = Math.max(0.4, 1 - progress * 0.6);
        ctx.globalAlpha = 1 - progress;
        const zw = drawWidth * scale;
        const zh = drawHeight * scale;
        ctx.drawImage(img, (width - zw) / 2, (height - zh) / 2, zw, zh);
        break;
      }
      default:
        if (progress < 0.5) {
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
    }

    ctx.restore();
  };

  const drawTextOverlays = (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number,
    alpha = 1
  ) => {
    for (const overlay of slide.textOverlays) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const x = (overlay.x / 100) * width;
      const y = (overlay.y / 100) * height;
      const scaledFontSize = (overlay.fontSize / 1080) * height;
      const fontStyle = `${overlay.italic ? 'italic ' : ''}${overlay.bold ? 'bold ' : ''}${scaledFontSize}px ${overlay.fontFamily}`;
      ctx.font = fontStyle;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(overlay.text, x, y);
      ctx.restore();
    }
  };

  // Preload images
  useEffect(() => {
    state.slides.forEach((slide) => {
      if (!imageCache.current.has(slide.imageUrl)) {
        const img = new Image();
        img.onload = () => imageCache.current.set(slide.imageUrl, img);
        img.src = slide.imageUrl;
      }
    });
  }, [state.slides]);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now() - currentTime * 1000;

      const animate = () => {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0);
          setIsPlaying(false);
          stopAudio();
          return;
        }
        setCurrentTime(elapsed);
        drawFrame(elapsed);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
      playAudio(currentTime);
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Draw initial frame
  useEffect(() => {
    drawFrame(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slides, state.settings, currentTime]);

  const playAudio = (startAt: number) => {
    stopAudio();
    if (state.audioTracks.length === 0) return;

    let offset = 0;
    for (const track of state.audioTracks) {
      if (startAt < offset + track.duration) {
        const audio = new Audio(track.url);
        audio.currentTime = Math.max(0, startAt - offset);

        // Apply fade
        if (state.settings.fadeInMusic && offset === 0) {
          audio.volume = 0;
          const fadeIn = setInterval(() => {
            if (audio.volume < 0.95) {
              audio.volume = Math.min(1, audio.volume + 0.05);
            } else {
              clearInterval(fadeIn);
            }
          }, (state.settings.fadeDuration * 1000) / 20);
        }

        audio.play().catch(() => {});
        audioRefs.current.push(audio);
        break;
      }
      offset += track.duration;
    }
  };

  const stopAudio = () => {
    audioRefs.current.forEach((a) => {
      a.pause();
      a.src = '';
    });
    audioRefs.current = [];
  };

  const handlePlayPause = () => {
    if (state.slides.length === 0) return;
    if (isPlaying) {
      // Stop: reset to beginning
      setIsPlaying(false);
      setCurrentTime(0);
      stopAudio();
      drawFrame(0);
    } else {
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    drawFrame(t);
    if (isPlaying) {
      startTimeRef.current = performance.now() - t * 1000;
      stopAudio();
      playAudio(t);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel preview-panel">
      <h2>Preview</h2>
      <div className="preview-canvas-container">
        <canvas
          ref={canvasRef}
          className="preview-canvas"
          width={state.settings.resolution.width}
          height={state.settings.resolution.height}
        />
      </div>
      <div className="preview-controls">
        <button onClick={handlePlayPause} className="btn-primary">
          {isPlaying ? '⏹ Stop' : '▶ Play'}
        </button>
        <span className="time-display">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="seek-bar"
        />
      </div>
    </div>
  );
}
