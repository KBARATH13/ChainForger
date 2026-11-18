import { useState } from 'react';
import { loginUser, registerUser, getSiweNonce, verifySiwe, registerWallet } from '../services/api';
import { ethers } from 'ethers';
import NotificationBanner from '../components/NotificationBanner';
import './AuthView.css';

const walletRequestErrorMessage = (error) => {
  const isRejected = error?.code === 'ACTION_REJECTED' ||
    String(error?.code) === '4001' ||
    String(error?.info?.error?.code) === '4001' ||
    String(error?.error?.code) === '4001';

  return isRejected
    ? 'Wallet request canceled. No account was created or signed in.'
    : 'The wallet request could not be completed. Check your wallet and try again.';
};

const normalizeCompanyName = (value) => value.trim().replace(/\s+/g, ' ');
const getEmailError = (value) => {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? ''
    : 'Enter a valid email address.';
};
const getCompanyNameError = (value) => {
  const name = normalizeCompanyName(value);
  if (!name) return 'Company / individual name is required.';
  if (name.length > 100) return 'Company / individual name must be 100 characters or fewer.';
  return '';
};

/**
 * AuthView – Email/password developer access and wallet authentication.
 * Props:
 *   onSuccess(token, user) – called after successful authentication
 *   onBack()         – called when user clicks "← Back to home"
 */
export default function AuthView({ onSuccess, onRegisterSuccess = onSuccess, onBack }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [authTab, setAuthTab] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (field) => {
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  // Standard Email & Password Submit (works without wallet or gas)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = {};

    const emailError = getEmailError(email);
    if (emailError) errors.email = emailError;
    if (!password) errors.password = 'Password is required.';
    else if (mode === 'register' && password.trim().length === 0) {
      errors.password = 'Password cannot contain only spaces.';
    } else if (mode === 'register' && password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    } else if (mode === 'register' && password.length > 128) {
      errors.password = 'Password must be 128 characters or fewer.';
    }

    if (mode === 'register') {
      const companyError = getCompanyNameError(company);
      if (companyError) errors.companyName = companyError;
      if (wallet.trim() && !ethers.isAddress(wallet.trim())) {
        errors.walletAddress = 'Enter a valid Ethereum address or leave this optional field blank.';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      if (mode === 'register') {
        const data = await registerUser({
          email: email.trim(),
          password,
          companyName: normalizeCompanyName(company),
          walletAddress: wallet ? wallet.trim() : undefined,
        });
        onRegisterSuccess(data.token, data.user);
      } else {
        const data = await loginUser({ email: email.trim(), password });
        onSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials or backend status.');
    } finally {
      setLoading(false);
    }
  };

  // Web3 sign-in uses the configured admin wallet for admin access.
  const handleSiweLogin = async () => {
    setError('');
    setFieldErrors({});

    if (!window.ethereum) {
      setError('MetaMask or Web3 wallet extension was not detected in this browser.');
      return;
    }

    if (mode === 'register') {
      const companyError = getCompanyNameError(company);
      if (companyError) {
        setFieldErrors({ companyName: companyError });
        return;
      }
    }

    setLoading(true);
    try {
      let signer;
      let address;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        signer = await provider.getSigner();
        address = await signer.getAddress();
      } catch (walletError) {
        throw new Error(walletRequestErrorMessage(walletError), { cause: walletError });
      }

      // 1. Get cryptographic nonce for this wallet address
      const nonce = await getSiweNonce(address);

      // 2. Prepare EIP-4361 standard statement message
      const siweMsg = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address,
        '',
        'Sign in to ChainForger dashboard (No Gas Required)',
        '',
        `URI: ${window.location.origin}`,
        'Version: 1',
        'Chain ID: 1',
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join('\n');

      // 3. Request off-chain zero-gas cryptographic signature from user's wallet
      let signature;
      try {
        signature = await signer.signMessage(siweMsg);
      } catch (walletError) {
        throw new Error(walletRequestErrorMessage(walletError), { cause: walletError });
      }

      // 4. Send signature to backend for validation
      const payload = {
        address,
        message: siweMsg,
        signature
      };
      const verifyData = mode === 'register'
        ? await registerWallet({ ...payload, companyName: normalizeCompanyName(company) })
        : await verifySiwe(payload);

      if (mode === 'register') {
        onRegisterSuccess(verifyData.token, verifyData.user);
      } else {
        onSuccess(verifyData.token, verifyData.user);
      }
    } catch (err) {
      setError(err.message || 'Web3 wallet signature verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-topbar">
        <button className="auth-back-btn" onClick={onBack}>← Back to home</button>
      </div>

      <main className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-aside-brand">
            <span className="auth-brand-icon">⛓</span>
            <span>CHAINFORGER</span>
          </div>
          <div className="auth-aside-copy">
            <span className="auth-aside-kicker">BLOCKCHAIN CONTROL PLANE</span>
            <h1>Infrastructure<br /><span>under your control.</span></h1>
            <p>Secure access to your networks, deployments, and on-chain audit tools.</p>
          </div>
          <div className="auth-aside-security">
            <span className="auth-security-indicator" />
            <div>
              <strong>Wallet keys stay yours</strong>
              <span>Wallet verification is gas-free. Your private key never leaves your wallet.</span>
            </div>
          </div>
          <div className="auth-aside-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </aside>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand">
            <span className="auth-brand-icon">⛓</span>
            <span className="auth-brand-name">ChainForger</span>
          </div>

          <div className="auth-card-heading">
            <span className="auth-card-kicker">
              {authTab === 'wallet' ? 'WALLET ACCESS' : 'ACCOUNT ACCESS'}
            </span>
            <h2 id="auth-title" className="auth-title">
              {authTab === 'wallet'
                ? mode === 'register' ? 'Create wallet account' : 'Welcome back'
                : mode === 'register' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="auth-subtitle">
              {authTab === 'wallet'
                ? mode === 'register'
                  ? 'Create a new organization with your wallet.'
                  : 'Sign in securely with a registered wallet.'
                : mode === 'register'
                  ? 'Set up your organization access.'
                  : 'Sign in to continue to ChainForger.'}
            </p>
          </div>

          {error && (
            <NotificationBanner
              type="error"
              title="Authentication Issue"
              message={error}
              onClose={() => setError('')}
            />
          )}

          <div className="auth-tabs" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'email'}
              className={`auth-tab ${authTab === 'email' ? 'auth-tab-active' : ''}`}
              onClick={() => { setAuthTab('email'); setError(''); setFieldErrors({}); }}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'wallet'}
              className={`auth-tab ${authTab === 'wallet' ? 'auth-tab-active' : ''}`}
              onClick={() => { setAuthTab('wallet'); setError(''); setFieldErrors({}); }}
            >
              Wallet
            </button>
          </div>

          {authTab === 'email' ? (
            <form noValidate onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                />
                {fieldErrors.email && <span id="auth-email-error" className="auth-field-error">{fieldErrors.email}</span>}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                  minLength={mode === 'register' ? 6 : undefined}
                  maxLength={mode === 'register' ? 128 : undefined}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                />
                {fieldErrors.password && <span id="auth-password-error" className="auth-field-error">{fieldErrors.password}</span>}
              </div>

              {mode === 'register' && (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-company-email">Company / individual name</label>
                    <input
                      id="auth-company-email"
                      type="text"
                      className="auth-input"
                      placeholder="Acme Corp"
                      value={company}
                      onChange={(e) => { setCompany(e.target.value); clearFieldError('companyName'); }}
                      maxLength={100}
                      aria-invalid={Boolean(fieldErrors.companyName)}
                      aria-describedby={fieldErrors.companyName ? 'auth-company-email-error' : undefined}
                    />
                    {fieldErrors.companyName && <span id="auth-company-email-error" className="auth-field-error">{fieldErrors.companyName}</span>}
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-wallet">Public Ethereum address <span className="auth-optional">Optional</span></label>
                    <input
                      id="auth-wallet"
                      type="text"
                      className="auth-input"
                      placeholder="0x..."
                      value={wallet}
                      onChange={(e) => { setWallet(e.target.value); clearFieldError('walletAddress'); }}
                      maxLength={42}
                      aria-invalid={Boolean(fieldErrors.walletAddress)}
                      aria-describedby={fieldErrors.walletAddress ? 'auth-wallet-error' : undefined}
                    />
                    {fieldErrors.walletAddress && <span id="auth-wallet-error" className="auth-field-error">{fieldErrors.walletAddress}</span>}
                  </div>
                </>
              )}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading
                  ? 'Please wait...'
                  : mode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          ) : (
            <div className="auth-form">
              {mode === 'register' && (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-company-wallet">Company / individual name</label>
                  <input
                    id="auth-company-wallet"
                    type="text"
                    className="auth-input"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={(e) => { setCompany(e.target.value); clearFieldError('companyName'); }}
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors.companyName)}
                    aria-describedby={fieldErrors.companyName ? 'auth-company-wallet-error' : undefined}
                  />
                  {fieldErrors.companyName && <span id="auth-company-wallet-error" className="auth-field-error">{fieldErrors.companyName}</span>}
                </div>
              )}
              <p className="auth-wallet-note">
                {mode === 'register'
                  ? 'Company names are unique. Invite teammates after registration.'
                  : 'Only registered wallets can sign in. No transaction or gas fee is required.'}
              </p>
              <button
                type="button"
                onClick={handleSiweLogin}
                disabled={loading}
                className="auth-btn auth-btn-wallet"
              >
                {loading
                  ? mode === 'register' ? 'Registering...' : 'Signing in...'
                  : mode === 'register' ? 'Register wallet' : 'Continue with wallet'}
              </button>
            </div>
          )}

          {authTab === 'wallet' ? (
            <p className="auth-toggle">
              {mode === 'register' ? (
                <>
                  Already registered?{' '}
                  <button type="button" className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}>
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New organization?{' '}
                  <button type="button" className="auth-toggle-btn" onClick={() => { setMode('register'); setError(''); setFieldErrors({}); }}>
                    Register a wallet
                  </button>
                </>
              )}
            </p>
          ) : (
            <p className="auth-toggle">
              {mode === 'register' ? (
                <>
                  Already have an account?{' '}
                  <button type="button" className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}>
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New to ChainForger?{' '}
                  <button type="button" className="auth-toggle-btn" onClick={() => { setMode('register'); setError(''); setFieldErrors({}); }}>
                    Create an account
                  </button>
                </>
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
