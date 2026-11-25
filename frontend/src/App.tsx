import { Link, NavLink, Route, Routes } from 'react-router-dom'
import About from './pages/About'
import Detail from './pages/Detail'
import History from './pages/History'
import Live from './pages/Live'
import { profile } from './profile'

export default function App() {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <NavLink to="/" className="brand">
            <img src="/favicon.svg" alt="" width="30" height="30" />
            <span>Speech to Text</span>
          </NavLink>
          <nav>
            <NavLink to="/" end>
              Live
            </NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <Routes>
          <Route path="/" element={<Live />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<Detail />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>

      <footer className="wrap foot">
        <span>
          Built by <Link to="/about">{profile.name}</Link> for the Procucev AI Tech assignment
        </span>
        <span className="grow" />
        <a href={profile.repo} target="_blank" rel="noreferrer">
          Source code
        </a>
        <a href={profile.cv} target="_blank" rel="noreferrer">
          CV
        </a>
      </footer>
    </>
  )
}
