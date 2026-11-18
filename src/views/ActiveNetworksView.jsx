import React, { useState } from 'react';
import { Activity, RefreshCw, PlusCircle } from 'lucide-react';
import NetworkCard from '../components/NetworkCard';
import AccountModal from '../components/AccountModal';
import LogsModal from '../components/LogsModal';
import NotificationBanner from '../components/NotificationBanner';
import { deleteNetwork, restartNetwork, stopNetwork } from '../services/api';
import './ActiveNetworksView.css';

export default function ActiveNetworksView({
  networks = [],
  loading = false,
  error = null,
  onRefresh,
  onDeployClick,
  userRole
}) {
  const [selectedAccountNetwork, setSelectedAccountNetwork] = useState(null);
  const [selectedLogNetwork, setSelectedLogNetwork] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const runNetworkAction = async (networkId, action, confirmMessage, actionFn) => {
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBusyAction({ networkId, action });
    setActionError(null);
    setActionSuccess(null);
    try {
      await actionFn(networkId);
      const actionLabels = {
        stop: 'stopped',
        restart: 'restarted',
        delete: 'deleted and removed'
      };
      setActionSuccess(`Network "${networkId}" was successfully ${actionLabels[action] || action}.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(err.message || `Failed to ${action} network ${networkId}`);
    } finally {
      setBusyAction(null);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <div>
      {/* Top Header */}
      <div className="networks-header">
        <div>
          <h2 className="networks-title">
            <Activity className="text-[#39ff14]" size={28} />
            Active Sandbox Networks
          </h2>
          <p className="networks-desc">
            {isAdmin
              ? 'View all network deployments and inspect their states and console logs.'
              : 'Manage your EVM networks, inspect states, and monitor console logs.'}
          </p>
        </div>

        <div className="networks-actions">
          <button
            className="action-btn"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {!isAdmin && <button
            className="action-btn action-btn-primary"
            onClick={onDeployClick}
          >
            <PlusCircle size={16} />
            <span>Deploy New Sandbox</span>
          </button>}
        </div>
      </div>

      {/* Action Success Notification */}
      {actionSuccess && (
        <NotificationBanner
          type="success"
          title="Action Completed"
          message={actionSuccess}
          onClose={() => setActionSuccess(null)}
        />
      )}

      {/* Global Errors or Action Errors */}
      {(error || actionError) && (
        <NotificationBanner
          type="error"
          title="Control Plane Connection Issue"
          message={error || actionError}
          onClose={() => setActionError(null)}
        />
      )}

      {/* Empty State */}
      {!loading && networks.length === 0 && (
        <div className="networks-empty-state">
          <div className="empty-icon-wrapper">
            <Activity size={32} />
          </div>
          <h3 className="empty-title">No Active Blockchain Networks</h3>
          <p className="empty-desc">
            {isAdmin
              ? 'There are no network deployments to display.'
              : 'You do not currently have any localized Anvil sandboxes or Docker consortium networks initialized. Create one in seconds.'}
          </p>
          {!isAdmin && <button
            className="action-btn action-btn-primary"
            onClick={onDeployClick}
          >
            <PlusCircle size={16} />
            <span>Deploy Your First Sandbox</span>
          </button>}
        </div>
      )}

      {/* Active Grid */}
      <div className="networks-grid">
        {networks.map((network) => (
          <NetworkCard
            key={network.networkId}
            network={network}
            userRole={userRole}
            onInspect={() => setSelectedAccountNetwork(network)}
            onViewLogs={() => setSelectedLogNetwork(network)}
            onStop={() => runNetworkAction(
              network.networkId,
              'stop',
              `Are you sure you want to stop network "${network.networkId}"?`,
              stopNetwork
            )}
            onRestart={() => runNetworkAction(
              network.networkId,
              'restart',
              `Restart network "${network.networkId}"?`,
              restartNetwork
            )}
            onDelete={() => runNetworkAction(
              network.networkId,
              'delete',
              `Delete network "${network.networkId}"? This will stop it and remove its deployment record.`,
              deleteNetwork
            )}
            busyAction={busyAction?.networkId === network.networkId ? busyAction.action : null}
          />
        ))}
      </div>

      {/* Account Inspector Modal */}
      {selectedAccountNetwork && (
        <AccountModal
          network={selectedAccountNetwork}
          onClose={() => setSelectedAccountNetwork(null)}
        />
      )}

      {/* Logs Modal */}
      {selectedLogNetwork && (
        <LogsModal
          network={selectedLogNetwork}
          onClose={() => setSelectedLogNetwork(null)}
        />
      )}
    </div>
  );
}
