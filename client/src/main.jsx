import React from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
function PhaseOneShell(){return <main className="shell"><div className="mark">F</div><p className="eyebrow">JAIPUR · COACHING ACCOUNTS</p><h1>FeeTrack</h1><p className="intro">A clearer way to stay on top of tuition fees.</p><div className="phase-card"><span className="dot"/> Phase 1 foundation is ready</div><p className="muted">The secure API, data models, demo accounts and seed data are being built first. Parent and accounts experiences arrive in the next phases.</p></main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><PhaseOneShell/></React.StrictMode>);
