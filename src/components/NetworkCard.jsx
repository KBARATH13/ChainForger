import React, { useState } from 'react';
import {
  Copy,
  Check,
  Terminal,
  Wallet,
  StopCircle,
  HardDrive,
  Shield,
  RefreshCw,
  RotateCw,
  Trash2
} from 'lucide-react';
import './NetworkCard.css';

export default function NetworkCard({
  network,
  userRole,
  onInspect,
  onViewLogs,
  onStop,
  onRestart,
  onDelete,
  busyAction
}) {
  const [copied, setCopied] = useState(false);

  const copyRpc = () => {
    navigator.clipboard.writeText(network.rpcUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = network.status === 'running';
  const isStarting = network.status === 'starting';
  const isAdmin = userRole === 'admin';
  const isBusy = Boolean(busyAction);

  const category = (network.templateCategory || '').toLowerCase();
  const isPublic = category === 'public' || network.type === 'anvil';
  const isPrivate = category === 'private';
  const isConsortium = category === 'consortium';

  const typeLabel = isPublic
    ? 'Public Network'
    : isPrivate
    ? 'Private Network'
    : isConsortium
    ? 'Consortium Network'
    : network.type;

  const typeClass = isPublic
    ? 'card-type-public'
    : isPrivate
    ? 'card-type-private'
    : isConsortium
    ? 'card-type-consortium'
    : '';

  return (
    <div className="network-card">
      <div>
        {/* Card Header */}
        <div className="card-top">
          <div className="card-header-main">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="card-title">
                {network.networkId}
              </h3>
              <span className={`card-type-tag ${typeClass}`}>
                {typeLabel}
              </span>
            </div>
            <p className="card-created">
              Created: {new Date(network.createdAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Status Badge */}
          <div className={`badge-wrapper ${isRunning ? 'badge-running' : isStarting ? 'badge-starting' : 'badge-stopped'}`}>
            <div className="pulse-dot" />
            <span>{network.status}</span>
          </div>
        </div>

        {/* RPC & Connection Info */}
        <div className="card-info-box">
          <div className="card-info-label">
            JSON-RPC Endpoint
          </div>
          <div className="card-rpc-row">
            <code className="card-rpc-code">
              {network.rpcUrl}
            </code>
            <button
              onClick={copyRpc}
              className="card-copy-btn"
              title="Copy RPC"
            >
              {copied ? <Check size={14} className="text-[#39ff14]" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="card-meta-grid">
          <div className="card-meta-item">
            <span className="card-meta-sub">Chain ID</span>
            <span className="card-meta-val">{network.chainId || 31337}</span>
          </div>
          <div className="card-meta-item">
            <span className="card-meta-sub">Port Assigned</span>
            <span className="card-meta-val">:{network.port}</span>
          </div>
          <div className="card-meta-item">
            <span className="card-meta-sub">
              <HardDrive size={12} /> Gas Limit
            </span>
            <span className="card-meta-val">30,000,000</span>
          </div>
          <div className="card-meta-item">
            <span className="card-meta-sub">
              <Shield size={12} /> RBAC Vault
            </span>
            <span className="card-meta-val text-[#39ff14]">Active</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="card-actions-container">
        <div className="card-actions-row">
          <button
            onClick={onInspect}
            className="card-action-btn"
            title="Inspect Genesis & Account Balances"
          >
            <Wallet size={14} />
            <span>Accounts</span>
          </button>

          <button
            onClick={onViewLogs}
            className="card-action-btn"
            title="View Stream Logs"
          >
            <Terminal size={14} />
            <span>Logs</span>
          </button>
        </div>

        {!isAdmin && (
          <div className="card-actions-row card-actions-manage">
            {isRunning && (
              <button
                onClick={onStop}
                disabled={isBusy}
                className="card-action-btn card-stop-btn"
                title="Stop network"
              >
                {busyAction === 'stop' ? <RefreshCw size={14} className="animate-spin" /> : <StopCircle size={14} />}
                <span>{busyAction === 'stop' ? 'Stopping...' : 'Stop'}</span>
              </button>
            )}
            <button
              onClick={onRestart}
              disabled={isBusy || isStarting}
              className="card-action-btn"
              title="Restart network"
            >
              {busyAction === 'restart' ? <RefreshCw size={14} className="animate-spin" /> : <RotateCw size={14} />}
              <span>{busyAction === 'restart' ? 'Restarting...' : 'Restart'}</span>
            </button>
            <button
              onClick={onDelete}
              disabled={isBusy}
              className="card-action-btn card-delete-btn"
              title="Delete network"
            >
              {busyAction === 'delete' ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>{busyAction === 'delete' ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
