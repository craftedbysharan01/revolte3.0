import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './tailwind.css'

// No StrictMode: the prototype's mock timers should run once, like the real flow.
createRoot(document.getElementById('root')!).render(<App />)
