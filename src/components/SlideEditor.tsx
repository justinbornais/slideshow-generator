import { useState } from 'react';
import { useSlideshow } from '../store';
import { TextEditor } from './TextEditor';

export function SlideEditor() {
  const { state } = useSlideshow();
  const [selectedSlide, setSelectedSlide] = useState<number>(0);

  if (state.slides.length === 0) {
    return (
      <div className="panel">
        <h2>Slide Editor</h2>
        <p className="info-text">Upload images to start editing slides.</p>
      </div>
    );
  }

  const clampedIndex = Math.min(selectedSlide, state.slides.length - 1);
  const slide = state.slides[clampedIndex];

  return (
    <div className="panel">
      <h2>Slide Editor</h2>
      <div className="slide-selector">
        <button
          onClick={() => setSelectedSlide(Math.max(0, clampedIndex - 1))}
          disabled={clampedIndex === 0}
        >
          ◀ Prev
        </button>
        <span>
          Slide {clampedIndex + 1} of {state.slides.length}
        </span>
        <button
          onClick={() => setSelectedSlide(Math.min(state.slides.length - 1, clampedIndex + 1))}
          disabled={clampedIndex === state.slides.length - 1}
        >
          Next ▶
        </button>
      </div>
      <TextEditor slide={slide} slideIndex={clampedIndex} />
    </div>
  );
}
