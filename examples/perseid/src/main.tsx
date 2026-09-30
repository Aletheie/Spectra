import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { Booking } from './Booking'
import { ObservationList } from './ObservationList'
import { WeatherAlert } from './WeatherAlert'
import { Launcher } from './Launcher'
import './styles.css'

const pages: Record<string, ComponentType> = {
  index: Launcher,
  booking: Booking,
  observation: ObservationList,
  weather: WeatherAlert,
}
const Page = pages[document.body.dataset.page ?? 'index'] ?? Launcher
const root = document.getElementById('root')
if (!root) throw new Error('Perseid root element is missing.')
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
