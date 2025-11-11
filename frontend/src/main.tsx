import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dropzone/styles.css'
import '@fontsource/cascadia-code/500.css'
import '@fontsource/cascadia-code/400.css'
import {MantineProvider} from '@mantine/core'
import {ModalsProvider} from '@mantine/modals'

import {useSelector} from './state/store.ts'
import {App} from './components/App.tsx'
import {theme} from './theme.ts'
import './index.css'
import {SideEffects} from './components/SideEffects.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme='auto'>
      <ModalsProvider>
        <SideEffects />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
)

declare global {
  interface Window {
    store: typeof useSelector
    __ciphernotesInitialPath?: string
  }
}

const params = new URLSearchParams(window.location.search)
const initialPathParam = params.get('initialPath')
if (initialPathParam) {
  try {
    const decoded = decodeURIComponent(initialPathParam)
    const normalized = decoded.startsWith('/') ? decoded : `/${decoded}`
    window.__ciphernotesInitialPath = normalized
    window.history.replaceState(null, '', normalized)
  } catch {
    // ignore malformed values
  }
}

if (import.meta.env.DEV) {
  window.store = useSelector
}
