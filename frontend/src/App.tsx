import { NavLink, Route, Routes } from 'react-router-dom'
import Detail from './pages/Detail'
import History from './pages/History'
import Live from './pages/Live'

export default function App() {
  return (
    <>
      <header className="top">
        <NavLink to="/" className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          Speech to Text
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Live
          </NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Live />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<Detail />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>
    </>
  )
}
