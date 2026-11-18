import { Layers, PlusCircle, Activity, Home, LogOut } from 'lucide-react';
import './Navbar.css';

export default function Navbar({
  activeTab,
  setActiveTab,
  activeCount = 0,
  userRole,
  onHome,
  onLogout,
  showHomeButton = true
}) {
  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand-wrapper">
          <div className="navbar-icon-badge">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="navbar-title">
              ChainForger
              <span className="navbar-sub-badge">
                BaaS Sandbox
              </span>
            </h1>
            <p className="navbar-desc">
              Local Blockchain Control Plane & Multi-Network Orchestrator
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-nav">
          {showHomeButton && (
            <button className="nav-btn" onClick={onHome}>
              <Home size={16} />
              <span>Back to Home</span>
            </button>
          )}

          <button
            className={`nav-btn ${activeTab === 'active' ? 'nav-btn-active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <Activity size={16} />
            <span>Active Networks</span>
            {activeCount > 0 && (
              <span className="nav-count-badge">
                {activeCount}
              </span>
            )}
          </button>

          {userRole !== 'admin' && (
            <button
              className={`nav-btn ${activeTab === 'deploy' ? 'nav-btn-active' : ''}`}
              onClick={() => setActiveTab('deploy')}
            >
              <PlusCircle size={16} />
              <span>Deploy Network</span>
            </button>
          )}

          {onLogout && (
            <button
              className="nav-btn nav-btn-logout ml-2"
              onClick={onLogout}
              title="Sign out"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
