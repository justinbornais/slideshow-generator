import { useSlideshow } from '../store';
import type { TransitionType } from '../types';

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

export function SettingsPanel() {
  const { state, dispatch, getComputedDurations, getTotalDuration, getMusicDuration } =
    useSlideshow();
  const { settings } = state;
  const computedDurations = getComputedDurations();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Duration</h3>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={settings.targetDuration !== null}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { targetDuration: e.target.checked ? 60 : null },
                })
              }
            />
            Custom total duration
          </label>
        </div>
        {settings.targetDuration !== null && (
          <div className="setting-row">
            <label>
              Duration (seconds):
              <input
                type="number"
                value={settings.targetDuration}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    updates: { targetDuration: Math.max(1, Number(e.target.value)) },
                  })
                }
                min={1}
                className="input-md"
              />
            </label>
          </div>
        )}
        <p className="info-text">
          {settings.targetDuration === null
            ? getMusicDuration() > 0
              ? `Using music duration: ${formatDuration(getMusicDuration())}`
              : 'No music added. Each slide defaults to 5 seconds.'
            : `Target: ${formatDuration(settings.targetDuration)}`}
        </p>
        <p className="info-text">Effective total: {formatDuration(getTotalDuration())}</p>
      </div>

      <div className="settings-section">
        <h3>Per-Slide Duration</h3>
        {state.slides.length === 0 ? (
          <p className="info-text">Add slides to configure durations.</p>
        ) : (
          <div className="slide-durations">
            {state.slides.map((slide, i) => (
              <div key={slide.id} className="setting-row">
                <label>
                  Slide {i + 1}:
                  <input
                    type="checkbox"
                    checked={slide.duration !== null}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_SLIDE',
                        id: slide.id,
                        updates: { duration: e.target.checked ? 5 : null },
                      })
                    }
                  />
                  {slide.duration !== null ? (
                    <input
                      type="number"
                      value={slide.duration}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_SLIDE',
                          id: slide.id,
                          updates: { duration: Math.max(0.5, Number(e.target.value)) },
                        })
                      }
                      min={0.5}
                      step={0.5}
                      className="input-sm"
                    />
                  ) : (
                    <span className="auto-duration">
                      auto ({computedDurations[i]?.toFixed(1)}s)
                    </span>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Transitions</h3>
        <div className="setting-row">
          <label>
            Intro transition:
            <select
              value={settings.introTransition}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { introTransition: e.target.value as TransitionType },
                })
              }
            >
              {TRANSITIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {settings.introTransition !== 'none' && (
          <div className="setting-row">
            <label>
              Intro duration (s):
              <input
                type="number"
                value={settings.introTransitionDuration}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    updates: { introTransitionDuration: Math.max(0.1, Number(e.target.value)) },
                  })
                }
                min={0.1}
                max={5}
                step={0.1}
                className="input-sm"
              />
            </label>
          </div>
        )}
        <div className="setting-row">
          <label>
            Default transition:
            <select
              value={settings.defaultTransition}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { defaultTransition: e.target.value as TransitionType },
                })
              }
            >
              {TRANSITIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="setting-row">
          <label>
            Transition duration (s):
            <input
              type="number"
              value={settings.defaultTransitionDuration}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { defaultTransitionDuration: Math.max(0, Number(e.target.value)) },
                })
              }
              min={0}
              max={5}
              step={0.1}
              className="input-sm"
            />
          </label>
        </div>

        {state.slides.length > 0 && (
          <div className="per-slide-transitions">
            <h4>Per-slide transitions</h4>
            {state.slides.map((slide, i) => (
              <div key={slide.id} className="setting-row">
                <label>
                  Slide {i + 1}:
                  <select
                    value={slide.transition}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_SLIDE',
                        id: slide.id,
                        updates: { transition: e.target.value as TransitionType },
                      })
                    }
                  >
                    {TRANSITIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={slide.transitionDuration}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_SLIDE',
                        id: slide.id,
                        updates: {
                          transitionDuration: Math.max(0, Number(e.target.value)),
                        },
                      })
                    }
                    min={0}
                    max={5}
                    step={0.1}
                    className="input-sm"
                    title="Transition duration"
                  />
                  s
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Music Fade</h3>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={settings.fadeInMusic}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { fadeInMusic: e.target.checked },
                })
              }
            />
            Fade in at start
          </label>
        </div>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={settings.fadeOutMusic}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { fadeOutMusic: e.target.checked },
                })
              }
            />
            Fade out at end
          </label>
        </div>
        {(settings.fadeInMusic || settings.fadeOutMusic) && (
          <div className="setting-row">
            <label>
              Fade duration (s):
              <input
                type="number"
                value={settings.fadeDuration}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    updates: { fadeDuration: Math.max(0.5, Number(e.target.value)) },
                  })
                }
                min={0.5}
                max={10}
                step={0.5}
                className="input-sm"
              />
            </label>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Output</h3>
        <div className="setting-row">
          <label>
            Resolution:
            <select
              value={`${settings.resolution.width}x${settings.resolution.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { resolution: { width: w, height: h } },
                });
              }}
            >
              <option value="1920x1080">1920×1080 (Full HD)</option>
              <option value="1280x720">1280×720 (HD)</option>
              <option value="854x480">854×480 (SD)</option>
              <option value="3840x2160">3840×2160 (4K)</option>
            </select>
          </label>
        </div>
        <div className="setting-row">
          <label>
            FPS:
            <select
              value={settings.fps}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  updates: { fps: Number(e.target.value) },
                })
              }
            >
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
