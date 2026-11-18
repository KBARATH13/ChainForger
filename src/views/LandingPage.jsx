import './LandingPage.css';
import Navbar from '../components/Navbar';

/**
 * LandingPage – shown to ALL visitors (logged-in & logged-out).
 * Props:
 *   isLoggedIn  boolean     – true when a JWT exists in localStorage
 *   onGoToApp   () => void  – called when "Go to Dashboard" is clicked (logged-in)
 *   onGoToLogin () => void  – called when "Sign in" or "Get Started" is clicked (logged-out)
 */
export default function LandingPage({
  isLoggedIn,
  userRole,
  activeCount,
  onGoToApp,
  onSelectTab,
  onGoToLogin,
  onLogout
}) {
  if (isLoggedIn && userRole === 'admin') {
    return (
      <AdminLandingPage
        activeCount={activeCount}
        onGoToApp={onGoToApp}
        onSelectTab={onSelectTab}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="landing-root">

      {/* ─── NAVBAR ─────────────────────────────────── */}
      {isLoggedIn ? (
        <Navbar
          activeTab="home"
          setActiveTab={onSelectTab}
          activeCount={activeCount}
          userRole={userRole}
          onLogout={onLogout}
          showHomeButton={false}
        />
      ) : (
        <header className="landing-nav">
          <div className="landing-nav-brand">
            <span className="landing-logo-icon">⛓</span>
            <span className="landing-logo-text">ChainForger</span>
          </div>
          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
              <button className="landing-btn-ghost" onClick={onGoToLogin}>Sign in</button>
              <button className="landing-btn-primary" onClick={onGoToLogin}>Get Started</button>
          </nav>
        </header>
      )}

      {/* ─── HERO (full-width split layout) ─────────── */}
      <section className="landing-hero">
        <div className="landing-hero-left">
          <div className="landing-hero-badge">🚀 Local-First Blockchain-as-a-Service</div>
          <h1 className="landing-hero-title">
            Deploy Private<br />
            <span className="landing-gradient-text">Blockchain Networks</span><br />
            in Seconds
          </h1>
          <p className="landing-hero-sub">
            ChainForger gives you a full Ethereum PoA consortium, smart-contract sandbox,
            real-time telemetry, and an auditable on-chain log — running entirely on your
            machine or in a Docker cluster. No cloud. No fees. Full control.
          </p>

          {isLoggedIn ? (
            <>
              <div className="landing-logged-in-banner">
                ✅ You're signed in — your networks are ready.
              </div>
              <div className="landing-hero-actions">
                <button className="landing-btn-primary landing-btn-lg" onClick={onGoToApp}>
                  Open Dashboard →
                </button>
              </div>
            </>
          ) : (
            <div className="landing-hero-actions">
              <button className="landing-btn-primary landing-btn-lg" onClick={onGoToLogin}>
                Get Started — it's free
              </button>
              <button className="landing-btn-ghost landing-btn-lg" onClick={onGoToLogin}>
                Sign in
              </button>
            </div>
          )}

          {/* Stats row */}
          <div className="landing-stats">
            {STATS.map((s) => (
              <div key={s.label} className="landing-stat">
                <span className="landing-stat-value">{s.value}</span>
                <span className="landing-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side — mock terminal */}
        <div className="landing-hero-right">
          <div className="landing-terminal">
            <div className="landing-terminal-bar">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="landing-terminal-title">chainforger — control-plane</span>
            </div>
            <pre className="landing-terminal-body">{`$ chainforger deploy --type poa \\
    --validators 2 --chain-id 1337

 ✔  Generating genesis block …
 ✔  Spinning up validator1
     → 172.28.0.10:8545
 ✔  Spinning up validator2
     → 172.28.0.11:8545
 ✔  Deploying BaseRBAC
     → 0x5FbDB231…
 ✔  Deploying AuditVault
     → 0xe7f1725E…
 ✔  Deploying CustomToken
     → 0x9fE46736…
 ──────────────────────────────
 🟢 Network online
    Chain ID  1337
    RPC       http://localhost:8545
    WS        ws://localhost:8546
    Block     #1  (5s period)
 ──────────────────────────────
 ✔  Indexer attached to AuditVault
 ✔  API key: cfg_live_a3f9…`}</pre>
          </div>
        </div>
      </section>

      {/* ─── FEATURES (full-width) ───────────────────── */}
      <section id="features" className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Everything you need to build on-chain</h2>
            <p className="landing-section-sub">
              All the infrastructure, tooling, and security primitives — packaged into one dashboard.
            </p>
          </div>
          <div className="landing-cards">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS (full-width alt bg) ──────── */}
      <section id="how" className="landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How it works</h2>
            <p className="landing-section-sub">
              From zero to a live private blockchain in four steps.
            </p>
          </div>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="landing-step">
                <div className="landing-step-num">{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA (full-width) ───────────────────────── */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <h2>Ready to forge your chain?</h2>
          <p>Spin up a private PoA network with smart contracts in under 60 seconds.</p>
          {isLoggedIn ? (
            <button className="landing-btn-primary landing-btn-lg" onClick={onGoToApp}>
              Go to Dashboard →
            </button>
          ) : (
            <div className="landing-hero-actions" style={{ justifyContent: 'center' }}>
              <button className="landing-btn-primary landing-btn-lg" onClick={onGoToLogin}>
                Create a free account
              </button>
              <button className="landing-btn-ghost landing-btn-lg" onClick={onGoToLogin}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span>⛓</span>
            <span><strong>ChainForger</strong> — Local-First BaaS Control Plane</span>
          </div>
          <span>© {new Date().getFullYear()} ChainForger. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}

function AdminLandingPage({ activeCount, onGoToApp, onSelectTab, onLogout }) {
  return (
    <div className="landing-root admin-landing-root">
      <Navbar
        activeTab="home"
        setActiveTab={onSelectTab}
        activeCount={activeCount}
        userRole="admin"
        onLogout={onLogout}
        showHomeButton={false}
      />

      <main className="admin-landing-main">
        <section className="admin-landing-panel" aria-labelledby="admin-landing-title">
          <span className="landing-hero-badge">ADMINISTRATOR</span>
          <h1 id="admin-landing-title" className="admin-landing-title">
            Platform control center
          </h1>
          <p className="admin-landing-description">
            Review network activity across organizations from your read-only admin dashboard.
          </p>
          <button className="landing-btn-primary landing-btn-lg" onClick={onGoToApp}>
            Open Network Overview →
          </button>

          <div className="admin-landing-capabilities">
            <div>
              <strong>All-network visibility</strong>
              <span>Review networks across organizations</span>
            </div>
            <div>
              <strong>Read-only access</strong>
              <span>Monitor activity without changing deployments</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span>⛓</span>
            <span><strong>ChainForger</strong> — Admin Control Center</span>
          </div>
          <span>© {new Date().getFullYear()} ChainForger</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Static data ─────────────────────────────────── */

const STATS = [
  { value: '< 60s', label: 'Network deploy time' },
  { value: '2+', label: 'PoA Validators' },
  { value: '3', label: 'Contracts included' },
  { value: '100%', label: 'Local — no cloud' },
];

const FEATURES = [
  {
    icon: '⛓',
    title: 'PoA Consortium Network',
    desc: 'Spin up a Geth Clique Proof-of-Authority network with multiple validators in a Docker bridge network.',
  },
  {
    icon: '📜',
    title: 'Smart-Contract Sandbox',
    desc: 'Deploy and interact with Solidity contracts (BaseRBAC, AuditVault, CustomToken) using Foundry scripts.',
  },
  {
    icon: '📊',
    title: 'Live Telemetry',
    desc: 'Real-time network cards show RPC URLs, block height, gas price, and status badges — refreshed every 4 s.',
  },
  {
    icon: '🔒',
    title: 'Role-Based Access Control',
    desc: 'On-chain RBAC with Admin, Operator, and Auditor roles enforced by OpenZeppelin AccessControl.',
  },
  {
    icon: '📋',
    title: 'Immutable Audit Log',
    desc: 'AuditVault records state-hash snapshots and metadata on-chain — tamper-proof and queryable.',
  },
  {
    icon: '🔑',
    title: 'Hybrid Auth (Email + SIWE)',
    desc: 'Register with email/password, verify wallet ownership via EIP-4361 Sign-In with Ethereum.',
  },
];

const STEPS = [
  {
    title: 'Create your account',
    desc: 'Register with your email, company name, and an optional wallet address. Verify wallet ownership with MetaMask (SIWE).',
  },
  {
    title: 'Configure your network',
    desc: 'Choose a network type (Anvil sandbox or PoA Docker), set chain ID, gas limit, token supply, and consensus rules.',
  },
  {
    title: 'Deploy & monitor',
    desc: 'ChainForger spins up nodes, deploys contracts, and shows live telemetry in the Active Networks dashboard.',
  },
  {
    title: 'Build & audit',
    desc: 'Use the built-in block explorer, contract sandbox, and AuditVault to build and verify your dApp logic.',
  },
];
