import { ImageUploader } from './components/ImageUploader';
import { SlideEditor } from './components/SlideEditor';
import { AudioManager } from './components/AudioManager';
import { SettingsPanel } from './components/SettingsPanel';
import { Preview } from './components/Preview';
import { ExportPanel } from './components/ExportPanel';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Slideshow Generator</h1>
      </header>
      <main className="app-main">
        <div className="left-column">
          <ImageUploader />
          <AudioManager />
        </div>
        <div className="center-column">
          <Preview />
          <SlideEditor />
        </div>
        <div className="right-column">
          <SettingsPanel />
          <ExportPanel />
        </div>
      </main>
    </div>
  );
}

export default App;
