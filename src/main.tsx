import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { db } from './db/db'
import { ensureCatalog } from './data/seed'

registerSW()

// Upserts built-in exercises/templates for installs created before the current catalog
// version. Fire-and-forget: live queries pick the rows up as soon as they land.
void ensureCatalog(db).catch(error => {
  console.error('Failed to apply the built-in catalog', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
