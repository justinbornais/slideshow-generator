import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SlideshowProvider } from './store.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SlideshowProvider>
      <App />
    </SlideshowProvider>
  </StrictMode>,
)
