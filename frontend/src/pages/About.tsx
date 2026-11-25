import Icon from '../Icon'
import { profile } from '../profile'

const steps = [
  ['Microphone', 'The browser turns your voice into small 0.1 second pieces of audio.'],
  ['WebSocket', 'Each piece goes to the server over a connection that stays open.'],
  ['Speech engine', 'The open-source model or Gemini turns the audio into text.'],
  ['Screen and database', 'Words come back while you speak, and each sentence is saved in PostgreSQL.'],
]

const stack = ['Python', 'FastAPI', 'WebSockets', 'PostgreSQL', 'SQLAlchemy', 'React', 'TypeScript', 'Docker']

const work = [
  [
    'Juno AI at Trugen AI',
    'I lead product and architecture for Juno, an AI assistant on iOS and Android that phones businesses and books appointments. It reached 500+ active users in its first month.',
  ],
  [
    'Voice and WhatsApp agents',
    'At QuibbleAI I built and ran conversational and WhatsApp agents on AWS, and a low-latency voice bot for large documents.',
  ],
  [
    'Research and hackathons',
    '4th of 20,000+ teams at the Bajaj Finserv HackRx RAG hackathon, and a Best Research Paper Award at ICDTV.',
  ],
]

export default function About() {
  return (
    <section className="about">
      <div className="card hero">
        <div className="avatar" aria-hidden="true">
          PS
        </div>
        <div>
          <p className="eyebrow">{profile.role}</p>
          <h1>{profile.name}</h1>
          <p className="lead">
            I build voice and agent systems and take them from prototype to production. I made this app for
            the Procucev AI Tech hiring assignment.
          </p>
          <div className="row">
            <a className="btn primary" href={profile.cv} target="_blank" rel="noreferrer">
              <Icon name="download" /> Download CV
            </a>
            <a className="btn" href={`mailto:${profile.email}`}>
              <Icon name="mail" /> {profile.email}
            </a>
          </div>
          <div className="row links">
            {profile.links.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label} <Icon name="link" size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card panel">
          <h2>What I work on</h2>
          <ul className="work">
            {work.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span className="soft">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card panel">
          <h2>How this app works</h2>
          <ol className="steps">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <b>{i + 1}</b>
                <span>
                  <strong>{title}</strong>
                  <span className="soft">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="chips">
            {stack.map(s => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <a className="btn" href={profile.repo} target="_blank" rel="noreferrer">
            <Icon name="code" /> Source code on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
