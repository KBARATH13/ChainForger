import { useState, useEffect } from 'react';
import LandingPage from './views/LandingPage';
import AuthView from './views/AuthView';
import Navbar from './components/Navbar';
import ActiveNetworksView from './views/ActiveNetworksView';
import NetworkConfigView from './views/NetworkConfigView';
import { fetchActiveNetworks, getAuthRole, getAuthToken, setAuthToken } from './services/api';
import './App.css';

/**
 * App-level routing (no react-router needed).
 *
 * Pages:
 *   'home'      – LandingPage (everyone sees this first)
 *   'auth'      – Login / Register screen
 *   'dashboard' – Protected dashboard (Active Networks + Deploy)
 */
export default function App() {
  const [page, setPage] = useState(() => {
    const token = getAuthToken();
    const saved = localStorage.getItem('cfg_current_page');
    if (token) {
      return saved === 'home' ? 'home' : 'dashboard';
    }
    return saved === 'auth' ? 'auth' : 'home';
  });

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('cfg_current_tab') || 'active';
  });

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!getAuthToken());
  const [userRole, setUserRole] = useState(getAuthRole());

  const navigatePage = (newPage) => {
    setPage(newPage);
    localStorage.setItem('cfg_current_page', newPage);
  };

  const navigateTab = (newTab) => {
    setActiveTab(newTab);
    localStorage.setItem('cfg_current_tab', newTab);
  };

  /* ── On mount: ensure auth state matches storage ── */
  useEffect(() => {
    if (getAuthToken()) {
      setIsLoggedIn(true);
      setUserRole(getAuthRole());
    }
  }, []);

  /* ── Poll networks every 4 s when on the dashboard ── */
  const loadNetworks = async () => {
    setLoading(true);
    try {
      const data = await fetchActiveNetworks(false);
      setNetworks(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Cannot connect to ChainForger backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page !== 'dashboard') return;
    loadNetworks();
    const interval = setInterval(loadNetworks, 4000);
    return () => clearInterval(interval);
  }, [page]);

  /* ── Auth callbacks ── */
  const handleAuthSuccess = (token, user) => {
    setAuthToken(token);
    setUserRole(user?.role || getAuthRole());
    setIsLoggedIn(true);
    navigateTab('active');
    navigatePage('dashboard');
  };

  const handleDashboardNavigation = (tab) => {
    navigateTab(tab);
    navigatePage('dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUserRole(null);
    setIsLoggedIn(false);
    navigateTab('active');
    navigatePage('home');
    setNetworks([]);
  };

  /* ── Page router ── */
  if (page === 'auth') {
    return (
      <AuthView
        onSuccess={handleAuthSuccess}
        onRegisterSuccess={handleAuthSuccess}
        onBack={() => navigatePage('home')}
      />
    );
  }

  if (page === 'dashboard') {
    return (
      <div className="app-container">
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleDashboardNavigation}
          activeCount={networks.length}
          userRole={userRole}
          onHome={() => navigatePage('home')}
          onLogout={handleLogout}
        />
        <main className="main-content">
          {activeTab === 'active' || userRole === 'admin' ? (
            <ActiveNetworksView
              networks={networks}
              loading={loading}
              error={error}
              onRefresh={loadNetworks}
              onDeployClick={() => handleDashboardNavigation('deploy')}
              userRole={userRole}
            />
          ) : (
            <NetworkConfigView
              onDeploySuccess={() => { loadNetworks(); handleDashboardNavigation('active'); }}
            />
          )}
        </main>
        <footer className="app-footer">
          ChainForger &copy; {new Date().getFullYear()} &mdash; Phosphor CRT Local-First BaaS Sandbox
        </footer>
      </div>
    );
  }

  /* ── Default: Landing home page ── */
  return (
    <LandingPage
      isLoggedIn={isLoggedIn}
      userRole={userRole}
      activeCount={networks.length}
      onGoToApp={() => handleDashboardNavigation('active')}
      onSelectTab={handleDashboardNavigation}
      onGoToLogin={() => navigatePage('auth')}
      onLogout={handleLogout}
    />
  );
}
