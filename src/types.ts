export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out' | 'dissolve';

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export interface Slide {
  id: string;
  imageFile: File;
  imageUrl: string;
  duration: number | null; // seconds, null = auto
  textOverlays: TextOverlay[];
  transition: TransitionType;
  transitionDuration: number; // seconds
}

export interface AudioTrack {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number; // seconds
}

export interface SlideshowSettings {
  targetDuration: number | null; // seconds, null = use music length
  fadeInMusic: boolean;
  fadeOutMusic: boolean;
  fadeDuration: number; // seconds for fade in/out
  defaultTransition: TransitionType;
  defaultTransitionDuration: number;
  outputFormat: 'mp4';
  fps: number;
  resolution: { width: number; height: number };
}

export interface SlideshowState {
  slides: Slide[];
  audioTracks: AudioTrack[];
  settings: SlideshowSettings;
}
