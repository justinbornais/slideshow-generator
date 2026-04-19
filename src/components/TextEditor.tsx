import { useState, useRef, useEffect, useCallback } from 'react';
import { useSlideshow } from '../store';
import type { Slide, TextOverlay } from '../types';

interface Props {
  slide: Slide;
  slideIndex: number;
}

export function TextEditor({ slide, slideIndex }: Props) {
  const { dispatch, addTextOverlay } = useSlideshow();
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleAddText = () => {
    addTextOverlay(slide.id);
  };

  const handleUpdateOverlay = useCallback((overlayId: string, updates: Partial<TextOverlay>) => {
    dispatch({
      type: 'UPDATE_TEXT_OVERLAY',
      slideId: slide.id,
      overlayId,
      updates,
    });
  }, [dispatch, slide.id]);

  const handleRemoveOverlay = (overlayId: string) => {
    dispatch({
      type: 'REMOVE_TEXT_OVERLAY',
      slideId: slide.id,
      overlayId,
    });
    if (selectedOverlay === overlayId) setSelectedOverlay(null);
  };

  return (
    <div className="text-editor">
      <div className="text-editor-header">
        <h3>Slide {slideIndex + 1} - Text Overlays</h3>
        <button onClick={handleAddText} className="btn-primary">
          + Add Text
        </button>
      </div>

      <div className="text-preview-container" ref={canvasRef}>
        <img src={slide.imageUrl} alt={`Slide ${slideIndex + 1}`} className="text-preview-image" />
        {slide.textOverlays.map((overlay) => (
          <DraggableText
            key={overlay.id}
            overlay={overlay}
            isSelected={selectedOverlay === overlay.id}
            onSelect={() => setSelectedOverlay(overlay.id)}
            onUpdate={(updates) => handleUpdateOverlay(overlay.id, updates)}
            containerRef={canvasRef}
          />
        ))}
      </div>

      {slide.textOverlays.map((overlay) => (
        <div
          key={overlay.id}
          className={`text-controls ${selectedOverlay === overlay.id ? 'selected' : ''}`}
          onClick={() => setSelectedOverlay(overlay.id)}
        >
          <div className="text-controls-row">
            <input
              type="text"
              value={overlay.text}
              onChange={(e) => handleUpdateOverlay(overlay.id, { text: e.target.value })}
              placeholder="Enter text..."
              className="text-input"
            />
            <button
              onClick={() => handleRemoveOverlay(overlay.id)}
              className="btn-danger btn-sm"
            >
              ✕
            </button>
          </div>
          <div className="text-controls-row">
            <label>
              Size:
              <input
                type="number"
                value={overlay.fontSize}
                onChange={(e) =>
                  handleUpdateOverlay(overlay.id, { fontSize: Number(e.target.value) })
                }
                min={8}
                max={200}
                className="input-sm"
              />
            </label>
            <label>
              Color:
              <input
                type="color"
                value={overlay.color}
                onChange={(e) => handleUpdateOverlay(overlay.id, { color: e.target.value })}
              />
            </label>
            <label>
              Font:
              <select
                value={overlay.fontFamily}
                onChange={(e) => handleUpdateOverlay(overlay.id, { fontFamily: e.target.value })}
              >
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
                <option value="Impact">Impact</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={overlay.bold}
                onChange={(e) => handleUpdateOverlay(overlay.id, { bold: e.target.checked })}
              />
              B
            </label>
            <label>
              <input
                type="checkbox"
                checked={overlay.italic}
                onChange={(e) => handleUpdateOverlay(overlay.id, { italic: e.target.checked })}
              />
              I
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

interface DraggableTextProps {
  overlay: TextOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextOverlay>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function DraggableText({ overlay, isSelected, onSelect, onUpdate, containerRef }: DraggableTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOverlayPos = useRef({ x: 0, y: 0 });
  const startFontSize = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isResizing.current) {
        // Resize: vertical drag distance scales font size
        const deltaY = e.clientY - startPos.current.y;
        // scale factor: every 2px of drag = 1pt font change
        const newSize = Math.max(8, Math.min(200, startFontSize.current + deltaY / 2));
        onUpdate({ fontSize: Math.round(newSize) });
        return;
      }

      if (isDragging.current) {
        const deltaX = ((e.clientX - startPos.current.x) / rect.width) * 100;
        const deltaY = ((e.clientY - startPos.current.y) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, startOverlayPos.current.x + deltaX));
        const newY = Math.max(0, Math.min(100, startOverlayPos.current.y + deltaY));
        onUpdate({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, onUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return; // don't drag while editing
    e.preventDefault();
    isDragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOverlayPos.current = { x: overlay.x, y: overlay.y };
    onSelect();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    onSelect();
    // Focus the input after React renders it
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    }
    e.stopPropagation();
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startFontSize.current = overlay.fontSize;
    onSelect();
  };

  return (
    <div
      ref={textRef}
      className={`draggable-text ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        fontSize: `${overlay.fontSize}px`,
        color: overlay.color,
        fontFamily: overlay.fontFamily,
        fontWeight: overlay.bold ? 'bold' : 'normal',
        fontStyle: overlay.italic ? 'italic' : 'normal',
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={overlay.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="inline-text-input"
          style={{
            fontSize: 'inherit',
            color: 'inherit',
            fontFamily: 'inherit',
            fontWeight: 'inherit',
            fontStyle: 'inherit',
          }}
        />
      ) : (
        overlay.text
      )}
      {isSelected && !isEditing && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}
