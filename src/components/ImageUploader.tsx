import { useRef } from 'react';
import { useSlideshow } from '../store';
import type { Slide } from '../types';

export function ImageUploader() {
  const { state, dispatch, addImages } = useSlideshow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addImages(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSortStart = (index: number) => {
    dragItem.current = index;
  };

  const handleSortEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleSortEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const slides = [...state.slides];
    const draggedSlide = slides[dragItem.current];
    slides.splice(dragItem.current, 1);
    slides.splice(dragOverItem.current, 0, draggedSlide);
    dispatch({ type: 'REORDER_SLIDES', slides });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const removeSlide = (id: string) => {
    dispatch({ type: 'REMOVE_SLIDE', id });
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.slides.length) return;
    const slides = [...state.slides];
    [slides[index], slides[newIndex]] = [slides[newIndex], slides[index]];
    dispatch({ type: 'REORDER_SLIDES', slides });
  };

  return (
    <div className="panel">
      <h2>Images</h2>
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <p>Drop images here or click to upload</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className="slides-grid">
        {state.slides.map((slide: Slide, index: number) => (
          <div
            key={slide.id}
            className="slide-thumb"
            draggable
            onDragStart={() => handleSortStart(index)}
            onDragEnter={() => handleSortEnter(index)}
            onDragEnd={handleSortEnd}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="slide-number">{index + 1}</div>
            <img src={slide.imageUrl} alt={`Slide ${index + 1}`} />
            <div className="slide-actions">
              <button
                onClick={() => moveSlide(index, -1)}
                disabled={index === 0}
                title="Move left"
              >
                ◀
              </button>
              <button
                onClick={() => removeSlide(slide.id)}
                title="Remove"
                className="btn-danger"
              >
                ✕
              </button>
              <button
                onClick={() => moveSlide(index, 1)}
                disabled={index === state.slides.length - 1}
                title="Move right"
              >
                ▶
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
