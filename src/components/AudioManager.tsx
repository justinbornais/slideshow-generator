import { useRef } from 'react';
import { useSlideshow } from '../store';

export function AudioManager() {
  const { state, dispatch, addAudio } = useSlideshow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (const file of Array.from(e.target.files)) {
        await addAudio(file);
      }
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('audio/')) {
        await addAudio(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeTrack = (id: string) => {
    dispatch({ type: 'REMOVE_AUDIO', id });
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.audioTracks.length) return;
    const tracks = [...state.audioTracks];
    [tracks[index], tracks[newIndex]] = [tracks[newIndex], tracks[index]];
    dispatch({ type: 'REORDER_AUDIO', tracks });
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalDuration = state.audioTracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div className="panel">
      <h2>Music</h2>
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <p>Drop audio files here or click to upload</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {state.audioTracks.length > 0 && (
        <>
          <div className="audio-list">
            {state.audioTracks.map((track, index) => (
              <div key={track.id} className="audio-item">
                <div className="audio-info">
                  <span className="audio-name">🎵 {track.name}</span>
                  <span className="audio-duration">{formatDuration(track.duration)}</span>
                </div>
                <div className="audio-actions">
                  <button
                    onClick={() => moveTrack(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveTrack(index, 1)}
                    disabled={index === state.audioTracks.length - 1}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="btn-danger btn-sm"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="audio-total">
            Total music duration: {formatDuration(totalDuration)}
          </div>
        </>
      )}
    </div>
  );
}
