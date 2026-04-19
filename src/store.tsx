import { createContext, useContext, useReducer, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  SlideshowState,
  Slide,
  AudioTrack,
  SlideshowSettings,
  TextOverlay,
  TransitionType,
} from './types';

const defaultSettings: SlideshowSettings = {
  targetDuration: null,
  fadeInMusic: false,
  fadeOutMusic: false,
  fadeDuration: 2,
  defaultTransition: 'fade',
  defaultTransitionDuration: 1,
  introTransition: 'none',
  introTransitionDuration: 1,
  endingTransition: 'none',
  endingTransitionDuration: 1,
  outputFormat: 'mp4',
  fps: 30,
  resolution: { width: 1280, height: 720 },
};

const initialState: SlideshowState = {
  slides: [],
  audioTracks: [],
  settings: defaultSettings,
};

type Action =
  | { type: 'ADD_SLIDES'; slides: Slide[] }
  | { type: 'REMOVE_SLIDE'; id: string }
  | { type: 'REORDER_SLIDES'; slides: Slide[] }
  | { type: 'UPDATE_SLIDE'; id: string; updates: Partial<Slide> }
  | { type: 'ADD_TEXT_OVERLAY'; slideId: string; overlay: TextOverlay }
  | { type: 'UPDATE_TEXT_OVERLAY'; slideId: string; overlayId: string; updates: Partial<TextOverlay> }
  | { type: 'REMOVE_TEXT_OVERLAY'; slideId: string; overlayId: string }
  | { type: 'ADD_AUDIO'; track: AudioTrack }
  | { type: 'REMOVE_AUDIO'; id: string }
  | { type: 'REORDER_AUDIO'; tracks: AudioTrack[] }
  | { type: 'UPDATE_SETTINGS'; updates: Partial<SlideshowSettings> };

function reducer(state: SlideshowState, action: Action): SlideshowState {
  switch (action.type) {
    case 'ADD_SLIDES':
      return { ...state, slides: [...state.slides, ...action.slides] };
    case 'REMOVE_SLIDE': {
      const slide = state.slides.find((s) => s.id === action.id);
      if (slide) URL.revokeObjectURL(slide.imageUrl);
      return { ...state, slides: state.slides.filter((s) => s.id !== action.id) };
    }
    case 'REORDER_SLIDES':
      return { ...state, slides: action.slides };
    case 'UPDATE_SLIDE':
      return {
        ...state,
        slides: state.slides.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
      };
    case 'ADD_TEXT_OVERLAY':
      return {
        ...state,
        slides: state.slides.map((s) =>
          s.id === action.slideId
            ? { ...s, textOverlays: [...s.textOverlays, action.overlay] }
            : s
        ),
      };
    case 'UPDATE_TEXT_OVERLAY':
      return {
        ...state,
        slides: state.slides.map((s) =>
          s.id === action.slideId
            ? {
                ...s,
                textOverlays: s.textOverlays.map((t) =>
                  t.id === action.overlayId ? { ...t, ...action.updates } : t
                ),
              }
            : s
        ),
      };
    case 'REMOVE_TEXT_OVERLAY':
      return {
        ...state,
        slides: state.slides.map((s) =>
          s.id === action.slideId
            ? { ...s, textOverlays: s.textOverlays.filter((t) => t.id !== action.overlayId) }
            : s
        ),
      };
    case 'ADD_AUDIO':
      return { ...state, audioTracks: [...state.audioTracks, action.track] };
    case 'REMOVE_AUDIO': {
      const track = state.audioTracks.find((t) => t.id === action.id);
      if (track) URL.revokeObjectURL(track.url);
      return { ...state, audioTracks: state.audioTracks.filter((t) => t.id !== action.id) };
    }
    case 'REORDER_AUDIO':
      return { ...state, audioTracks: action.tracks };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.updates } };
    default:
      return state;
  }
}

interface SlideshowContextType {
  state: SlideshowState;
  dispatch: React.Dispatch<Action>;
  addImages: (files: FileList | File[]) => void;
  addAudio: (file: File) => Promise<void>;
  addTextOverlay: (slideId: string) => void;
  getComputedDurations: () => number[];
  getTotalDuration: () => number;
  getMusicDuration: () => number;
}

const SlideshowContext = createContext<SlideshowContextType | null>(null);

export function SlideshowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addImages = (files: FileList | File[]) => {
    const newSlides: Slide[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        id: uuidv4(),
        imageFile: file,
        imageUrl: URL.createObjectURL(file),
        duration: null,
        textOverlays: [],
        transition: state.settings.defaultTransition,
        transitionDuration: state.settings.defaultTransitionDuration,
      }));
    dispatch({ type: 'ADD_SLIDES', slides: newSlides });
  };

  const addAudio = async (file: File): Promise<void> => {
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(url);
    const track: AudioTrack = {
      id: uuidv4(),
      file,
      url,
      name: file.name,
      duration,
    };
    dispatch({ type: 'ADD_AUDIO', track });
  };

  const addTextOverlay = (slideId: string) => {
    const overlay: TextOverlay = {
      id: uuidv4(),
      text: 'Text',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'Arial',
      bold: false,
      italic: false,
    };
    dispatch({ type: 'ADD_TEXT_OVERLAY', slideId, overlay });
  };

  const getMusicDuration = () => {
    return state.audioTracks.reduce((sum, t) => sum + t.duration, 0);
  };

  const getTotalDuration = () => {
    if (state.settings.targetDuration !== null) {
      return state.settings.targetDuration;
    }
    const musicDur = getMusicDuration();
    if (musicDur > 0) return musicDur;
    // fallback: 5 seconds per slide (for auto-duration slides) + custom durations
    if (state.slides.length === 0) return 0;
    return state.slides.reduce((sum, s) => sum + (s.duration ?? 5), 0);
  };

  const getComputedDurations = (): number[] => {
    if (state.slides.length === 0) return [];

    const totalTarget = getTotalDuration();
    const slidesWithCustomDuration = state.slides.filter((s) => s.duration !== null);
    const slidesWithAutoDuration = state.slides.filter((s) => s.duration === null);

    const customTotal = slidesWithCustomDuration.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const remainingTime = Math.max(0, totalTarget - customTotal);
    const autoDuration =
      slidesWithAutoDuration.length > 0
        ? remainingTime / slidesWithAutoDuration.length
        : 0;

    return state.slides.map((s) => (s.duration !== null ? s.duration : Math.max(1, autoDuration)));
  };

  return (
    <SlideshowContext.Provider
      value={{
        state,
        dispatch,
        addImages,
        addAudio,
        addTextOverlay,
        getComputedDurations,
        getTotalDuration,
        getMusicDuration,
      }}
    >
      {children}
    </SlideshowContext.Provider>
  );
}

export function useSlideshow() {
  const ctx = useContext(SlideshowContext);
  if (!ctx) throw new Error('useSlideshow must be used within SlideshowProvider');
  return ctx;
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      resolve(0);
    });
    audio.src = url;
  });
}
