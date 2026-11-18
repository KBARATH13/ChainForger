// Use relative path '/api' in browser so Vite proxy automatically routes to backend port 4000
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ==========================================
// Token Helpers
// ==========================================
export const getAuthToken = () => localStorage.getItem('cfg_token');
export const setAuthToken = (token) => {
  if (token) localStorage.setItem('cfg_token', token);
  else localStorage.removeItem('cfg_token');
};

export const getAuthRole = () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binaryPayload = atob(encodedPayload);
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).role || null;
  } catch {
    return null;
  }
};

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ==========================================
// Authentication APIs
// ==========================================

export async function loginUser(credentials) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Login failed with HTTP status ${res.status}`);
  }
  setAuthToken(data.token);
  return data;
}

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Registration failed with HTTP status ${res.status}`);
  }
  setAuthToken(data.token);
  return data;
}

export async function getSiweNonce(address) {
  const res = await fetch(`${API_BASE_URL}/auth/nonce?address=${encodeURIComponent(address)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch SIWE nonce');
  }
  return data.nonce;
}

export async function verifySiwe(payload) {
  const res = await fetch(`${API_BASE_URL}/auth/web3-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Wallet verification failed');
  }
  setAuthToken(data.token);
  return data;
}

export async function registerWallet(payload) {
  const res = await fetch(`${API_BASE_URL}/auth/wallet-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Wallet registration failed');
  }
  setAuthToken(data.token);
  return data;
}

export async function fetchUserProfile() {
  const res = await fetch(`${API_BASE_URL}/auth/profile`, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch user profile');
  }
  return data.user;
}

export async function rotateApiKey() {
  const res = await fetch(`${API_BASE_URL}/auth/api-key/rotate`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to rotate API key');
  }
  return data.apiKey;
}

export async function fetchTeamMembers() {
  const res = await fetch(`${API_BASE_URL}/auth/team`, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch team members');
  }
  return data.team;
}

export async function inviteTeamMember(email, role) {
  const res = await fetch(`${API_BASE_URL}/auth/team/invite`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, role })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to invite team member');
  }
  return data.user;
}

// ==========================================
// Network Management APIs
// ==========================================

export async function fetchUserQuota() {
  const res = await fetch(`${API_BASE_URL}/networks/quota`, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch user quota');
  }
  return data.quota;
}

export async function fetchActiveNetworks(all = false) {
  const url = all ? `${API_BASE_URL}/networks?all=true` : `${API_BASE_URL}/networks`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch active networks');
  }
  return data.networks;
}

export async function fetchNetworkDetails(networkId) {
  const res = await fetch(`${API_BASE_URL}/networks/${networkId}`, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch network details');
  }
  return data.network;
}

export async function deployNetwork(config) {
  const res = await fetch(`${API_BASE_URL}/networks/deploy`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(config)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Network deployment failed');
  }
  return data.network;
}

export async function stopNetwork(networkId) {
  const res = await fetch(`${API_BASE_URL}/networks/${networkId}/stop`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to stop network');
  }
  return data;
}

export async function restartNetwork(networkId) {
  const res = await fetch(`${API_BASE_URL}/networks/${networkId}/restart`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to restart network');
  }
  return data.network;
}

export async function deleteNetwork(networkId) {
  const res = await fetch(`${API_BASE_URL}/networks/${networkId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete network');
  }
  return data;
}

export async function fetchNetworkLogs(networkId) {
  const res = await fetch(`${API_BASE_URL}/networks/${networkId}/logs`, {
    headers: getHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to retrieve process logs');
  }
  return data.logs;
}

export async function startIndexer(networkId, rpcUrl, auditVaultAddress) {
  const res = await fetch(`${API_BASE_URL}/indexer/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ networkId, rpcUrl, auditVaultAddress })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to start event indexer');
  }
  return data;
}

export default {
  loginUser,
  registerUser,
  getSiweNonce,
  verifySiwe,
  registerWallet,
  fetchUserProfile,
  rotateApiKey,
  fetchTeamMembers,
  inviteTeamMember,
  fetchUserQuota,
  fetchActiveNetworks,
  fetchNetworkDetails,
  deployNetwork,
  stopNetwork,
  restartNetwork,
  deleteNetwork,
  fetchNetworkLogs,
  startIndexer
};
