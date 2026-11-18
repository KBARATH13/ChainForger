import { useState, useMemo, useEffect } from 'react';
import {
  Rocket,
  Server,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Globe,
  Lock,
  Network,
  Terminal,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { deployNetwork, fetchUserQuota } from '../services/api';
import PublicNetwork from '../components/PublicNetwork';
import PrivateNetwork from '../components/PrivateNetwork';
import ConsortiumNetwork from '../components/ConsortiumNetwork';
import NotificationBanner from '../components/NotificationBanner';
import './NetworkConfigView.css';

const createNetworkId = (name) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const NETWORK_OPTIONS = [
  {
    id: 'public',
    title: 'Public network',
    description: 'A quick network on this machine for learning, testing, and prototypes.',
    requirement: 'Runs with Anvil'
  },
  {
    id: 'private',
    title: 'Private network',
    description: 'A dedicated network for an organization or internal application.',
    requirement: 'Requires Docker'
  },
  {
    id: 'consortium',
    title: 'Consortium starter',
    description: 'A starter for multi-organization setups. Currently launches a single node.',
    requirement: 'Requires Docker'
  }
];

export default function NetworkConfigView({ onDeploySuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [quota, setQuota] = useState(null);

  const loadQuota = () => {
    fetchUserQuota().then(setQuota).catch(() => {});
  };

  useEffect(() => {
    loadQuota();
  }, []);

  // Active Template Archetype: 'public' | 'private' | 'consortium'
  const [activeTemplate, setActiveTemplate] = useState('public');
  const [isIdCustomized, setIsIdCustomized] = useState(false);

  const isCategoryFull = Boolean(
    quota?.used &&
    quota?.limits &&
    quota.used[activeTemplate] >= quota.limits[activeTemplate]
  );
  const isTotalFull = Boolean(
    quota?.used &&
    quota?.limits &&
    quota.used.total >= quota.limits.total
  );
  const isDeployBlocked = isCategoryFull || isTotalFull;

  // Unified Form Configuration State
  const [formData, setFormData] = useState({
    networkName: '',
    networkId: '',
    port: 8545,
    chainId: 31337,
    blockTime: 2,
    driverType: 'anvil', // 'anvil' | 'docker' | 'geth'

    // 1. Public Customizer Parameters
    consensus: 'clique', // 'clique' (PoA), 'pos' (Simulated PoS), 'ibft' (IBFT 2.0)
    nativeName: 'ChainForger Ether',
    nativeSymbol: 'CFE',
    faucetInitialFunding: 10000,
    enableFT: true,
    tokenName: 'ChainForger Governance',
    tokenSymbol: 'CFG',
    tokenDecimals: 18,
    initialSupply: 1000000,
    enableNFT: true,
    nftName: 'Enterprise Proof-of-Asset',
    nftSymbol: 'EPOA',
    nftPolicy: 'STRICT_UNIQUE', // 'STRICT_UNIQUE' (1-of-1) | 'MULTI_MINT_SERIES' (Series)
    nftMaxSupply: 1000,
    blockGasLimit: '30000000',
    baseFee: 1,

    // 2. Private Customizer Parameters
    participantCount: 3,
    zeroGasMode: true,
    privateStateEncryption: true,
    strictWhitelist: true,

    // 3. Consortium Customizer Parameters
    hybridMode: 'bridge', // 'bridge' | 'relay' | 'dual'
    quorumPercentage: 66,
    crossModulePermissions: true,
    validatorSignerCount: 4
  });

  const handleTemplateSwitch = (template) => {
    setActiveTemplate(template);
    if (template === 'public') {
      setFormData((prev) => ({
        ...prev,
        port: 8545,
        chainId: 31337,
        blockTime: 2,
        driverType: 'anvil',
        consensus: 'clique'
      }));
    } else if (template === 'private') {
      setFormData((prev) => ({
        ...prev,
        port: 8550,
        chainId: 1337,
        blockTime: 1,
        driverType: 'docker',
        consensus: 'ibft',
        zeroGasMode: true
      }));
    } else if (template === 'consortium') {
      setFormData((prev) => ({
        ...prev,
        port: 8552,
        chainId: 2026,
        blockTime: 3,
        driverType: 'docker',
        consensus: 'clique',
        quorumPercentage: 66
      }));
    }
  };

  // Live Genesis / Config Preview calculation
  const livePreview = useMemo(() => {
    return JSON.stringify(
      {
        networkId: formData.networkId,
        templateCategory: activeTemplate,
        engine: {
          driver: formData.driverType,
          consensus: formData.consensus,
          chainId: parseInt(formData.chainId),
          port: parseInt(formData.port),
          blockTime: parseInt(formData.blockTime)
        },
        gasAndFees: {
          gasLimit: formData.blockGasLimit,
          zeroGasMode: formData.zeroGasMode,
          baseFeeGwei: formData.baseFee
        },
        nativeCurrency: {
          name: formData.nativeName,
          symbol: formData.nativeSymbol,
          faucetAllocationPerAccount: formData.faucetInitialFunding
        },
        assetLayer: {
          fungibleToken: formData.enableFT
            ? {
                name: formData.tokenName,
                symbol: formData.tokenSymbol,
                initialSupply: parseInt(formData.initialSupply),
                decimals: parseInt(formData.tokenDecimals)
              }
            : null,
          nonFungibleToken: formData.enableNFT
            ? {
                name: formData.nftName,
                symbol: formData.nftSymbol,
                policy: formData.nftPolicy,
                maxSupply: parseInt(formData.nftMaxSupply)
              }
            : null
        },
        topology:
          activeTemplate === 'public'
            ? { mode: 'open-access-nodes' }
            : activeTemplate === 'private'
            ? {
                participatingEntities: parseInt(formData.participantCount),
                strictWhitelist: formData.strictWhitelist,
                privateStateEncryption: formData.privateStateEncryption
              }
            : {
                hybridArchitecture: formData.hybridMode,
                quorumPercentage: parseInt(formData.quorumPercentage),
                crossModulePermissions: formData.crossModulePermissions,
                validatorSigners: parseInt(formData.validatorSignerCount)
              }
      },
      null,
      2
    );
  }, [formData, activeTemplate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const networkId = createNetworkId(formData.networkId || formData.networkName);
    if (!networkId) {
      setError('Enter a network name with at least one English letter or number.');
      return;
    }

    if (isTotalFull) {
      setError(`Account Quota Reached: You have reached the maximum total quota of ${quota.limits.total} active networks across all categories (3 Public, 3 Private, 3 Consortium). To create a new network, please stop an unused network or delete an existing network from your Active Networks dashboard.`);
      return;
    }

    if (isCategoryFull) {
      const catName = activeTemplate.charAt(0).toUpperCase() + activeTemplate.slice(1);
      setError(`Category Limit Reached: You already have ${quota.used[activeTemplate]}/${quota.limits[activeTemplate]} active ${catName} networks. You cannot create more than 3 ${catName} networks regardless of available slots in other network categories. To create a new ${catName} network, please stop an unused ${catName} network or delete an existing ${catName} network from your Active Networks dashboard.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        networkId,
        templateCategory: activeTemplate,
        type: formData.driverType,
        consensus: formData.consensus,
        port: parseInt(formData.port),
        chainId: parseInt(formData.chainId),
        blockTime: parseInt(formData.blockTime),
        participantCount: parseInt(formData.participantCount),
        nativeCurrency: {
          name: formData.nativeName,
          symbol: formData.nativeSymbol,
          faucetInitialFunding: parseInt(formData.faucetInitialFunding)
        },
        tokenSettings: {
          enabled: formData.enableFT,
          name: formData.tokenName,
          symbol: formData.tokenSymbol,
          initialSupply: parseInt(formData.initialSupply),
          decimals: parseInt(formData.tokenDecimals)
        },
        nftSettings: {
          enabled: formData.enableNFT,
          name: formData.nftName,
          symbol: formData.nftSymbol,
          policy: formData.nftPolicy,
          maxSupply: parseInt(formData.nftMaxSupply)
        },
        gasParameters: {
          blockGasLimit: formData.blockGasLimit,
          baseFee: parseInt(formData.baseFee),
          zeroGasMode: formData.zeroGasMode
        },
        interopRules: {
          crossModulePermissions: formData.crossModulePermissions,
          quorumPercentage: parseInt(formData.quorumPercentage)
        }
      };

      const result = await deployNetwork(payload);
      const displayName = (formData.networkName || networkId).trim();
      setSuccessMsg(
        `Your ${NETWORK_OPTIONS.find((option) => option.id === activeTemplate).title.toLowerCase()} "${displayName}" is starting.`
      );
      loadQuota();

      setTimeout(() => {
        if (onDeploySuccess) onDeploySuccess(result);
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to initialize and deploy network instance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="config-wrapper">
      {/* Header */}
      <div className="config-header">
        <h2 className="config-title">
          <Rocket className="text-[#39ff14]" size={28} />
          Create a blockchain network
        </h2>
        <p className="config-desc">
          Choose what you need and give your network a name. We’ve selected sensible defaults; technical options are available if you want them.
        </p>
      </div>

      {/* Network type selector */}
      {quota && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-lg bg-[#0c121e] border border-[#1e293b] text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#39ff14]" />
            <span className="text-slate-400">Account Network Quota:</span>
            <span className="font-semibold text-slate-200">{quota.used.total} / {quota.limits.total} Total</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={quota.used.public >= quota.limits.public ? 'text-[#f87171] font-semibold' : 'text-slate-300'}>
              Public: <strong>{quota.used.public}/{quota.limits.public}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className={quota.used.private >= quota.limits.private ? 'text-[#f87171] font-semibold' : 'text-slate-300'}>
              Private: <strong>{quota.used.private}/{quota.limits.private}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className={quota.used.consortium >= quota.limits.consortium ? 'text-[#f87171] font-semibold' : 'text-slate-300'}>
              Consortium: <strong>{quota.used.consortium}/{quota.limits.consortium}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="archetype-tabs-container">
        {NETWORK_OPTIONS.map((option, index) => {
          const Icon = option.id === 'public' ? Globe : option.id === 'private' ? Lock : Network;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleTemplateSwitch(option.id)}
              className={`archetype-tab-btn ${activeTemplate === option.id ? 'archetype-tab-active' : ''}`}
              aria-pressed={activeTemplate === option.id}
            >
              <Icon size={20} />
              <span className="network-option-content">
                <strong>{option.title}</strong>
                <span>{option.description}</span>
                <small>{option.requirement}{index === 0 ? ' · Recommended to get started' : ''}</small>
              </span>
            </button>
          );
        })}
      </div>

      {/* Quota limit notification banners */}
      {isTotalFull && (
        <NotificationBanner
          type="danger"
          title="Maximum Account Network Capacity Reached (9/9)"
          message={
            <span>
              You have reached the maximum allowed limit of <strong>9 total active networks</strong> (3 Public, 3 Private, 3 Consortium).
              To create a new network, please <strong>stop an unused network</strong> or <strong>delete an existing network</strong> from your Active Networks dashboard.
            </span>
          }
        />
      )}

      {!isTotalFull && isCategoryFull && (
        <NotificationBanner
          type="warning"
          title={`${activeTemplate.charAt(0).toUpperCase() + activeTemplate.slice(1)} Network Limit Reached (${quota?.used?.[activeTemplate] || 3}/3)`}
          message={
            <span>
              You already have <strong>{quota?.used?.[activeTemplate] || 3} of 3</strong> active {activeTemplate} networks.
              Each user can create at most 3 networks in this category regardless of unused slots in other network types.
              To create a new {activeTemplate} network, please <strong>stop an unused {activeTemplate} network</strong> or <strong>delete an existing {activeTemplate} network</strong> from your Active Networks dashboard.
            </span>
          }
        />
      )}

      {error && (
        <NotificationBanner
          type="error"
          title="We couldn’t create your network"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {successMsg && (
        <NotificationBanner
          type="success"
          title="Network starting"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="config-form">
        <div className="network-name-field">
          <label className="config-input-label" htmlFor="network-name">What would you like to call your network?</label>
          <input
            id="network-name"
            type="text"
            className="config-input-field"
            placeholder="For example, My First Network"
            value={formData.networkName || formData.networkId}
            onChange={(e) => {
              const val = e.target.value;
              setFormData((prev) => ({
                ...prev,
                networkName: val,
                networkId: isIdCustomized ? prev.networkId : createNetworkId(val)
              }));
            }}
            maxLength={80}
            required={!formData.networkId}
          />
          <span className="network-name-hint">We’ll turn it into a simple network ID for your dashboard, like my-first-network.</span>
        </div>

        <details className="advanced-config">
          <summary>
            <span>Advanced settings</span>
            <small>Optional network and asset configuration</small>
          </summary>
          <div className="advanced-config-content">
            {/* Core Identifiers & Sockets */}
            <h3 className="config-section-title">
              <Server className="text-[#39ff14]" size={18} />
              Network connection settings
            </h3>

            <div className="form-three-col">
              <div className="config-input-group">
                <label className="config-input-label" htmlFor="internal-network-id">Internal network ID</label>
                <input
                  id="internal-network-id"
                  type="text"
                  className="config-input-field"
                  placeholder="e.g. my-network-01"
                  value={formData.networkId}
                  onChange={(e) => {
                    setIsIdCustomized(true);
                    setFormData((prev) => ({
                      ...prev,
                      networkId: createNetworkId(e.target.value)
                    }));
                  }}
                  required={!formData.networkName}
                />
              </div>

              <div className="config-input-group">
                <label className="config-input-label" htmlFor="network-chain-id">Chain ID</label>
                <input
                  id="network-chain-id"
                  type="number"
                  className="config-input-field"
                  value={formData.chainId}
                  onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
                  min="1"
                  required
                />
              </div>

              <div className="config-input-group">
                <label className="config-input-label" htmlFor="network-rpc-port">RPC port</label>
                <input
                  id="network-rpc-port"
                  type="number"
                  className="config-input-field"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  min="1"
                  max="65535"
                  required
                />
              </div>
            </div>

            {/* Modular Archetype Customizers */}
            {activeTemplate === 'public' && (
              <PublicNetwork formData={formData} setFormData={setFormData} />
            )}
            {activeTemplate === 'private' && (
              <PrivateNetwork formData={formData} setFormData={setFormData} />
            )}
            {activeTemplate === 'consortium' && (
              <ConsortiumNetwork formData={formData} setFormData={setFormData} />
            )}

            {/* Advanced configuration preview */}
            <h3 className="config-section-title mt-6">
              <Terminal size={18} className="text-[#39ff14]" />
              Configuration preview
            </h3>
            <div className="live-preview-box">
              <div className="live-preview-header">
                <span>Network settings</span>
                <span className="live-preview-status">Updates as you configure</span>
              </div>
              <pre className="live-preview-code">{livePreview}</pre>
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading || isDeployBlocked}
          className={`config-submit-btn mt-6 ${isDeployBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isDeployBlocked ? `Quota limit reached for ${activeTemplate} networks (3/3). Stop or delete an existing network to continue.` : 'Create network'}
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Creating your network...</span>
            </>
          ) : isDeployBlocked ? (
            <>
              <Ban size={18} className="text-[#f87171]" />
              <span>Quota Limit Reached ({quota?.used?.[activeTemplate] || 3}/3) — Stop or Delete an Active Network</span>
            </>
          ) : (
            <>
              <Rocket size={18} />
              <span>Create network</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
