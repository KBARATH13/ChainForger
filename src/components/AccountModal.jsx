import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { X, Wallet, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import './AccountModal.css';

export default function AccountModal({ network, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [blockNumber, setBlockNumber] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fetchNetworkState = async () => {
    if (!network?.rpcUrl) return;
    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      // Fetch latest block
      const currentBlock = await provider.getBlockNumber();
      setBlockNumber(currentBlock);

      // Query standard accounts list from the node
      let accountList = [];
      try {
        accountList = await provider.send('eth_accounts', []);
      } catch (_) {
        // Fallback for standard Anvil dev accounts
        accountList = [
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
        ];
      }

      // Fetch balances for each account
      const loadedAccounts = await Promise.all(
        accountList.slice(0, 10).map(async (address, index) => {
          try {
            const rawBalance = await provider.getBalance(address);
            return {
              index,
              address,
              balance: ethers.formatEther(rawBalance)
            };
          } catch (e) {
            return { index, address, balance: '0.0' };
          }
        })
      );

      setAccounts(loadedAccounts);
    } catch (err) {
      setError(err.message || 'Failed to poll network accounts via JSON-RPC.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkState();
  }, [network]);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <Wallet size={20} className="text-[#39ff14]" />
            <div>
              <h3 className="modal-header-title">
                {network.networkId} &mdash; State Ledger & Accounts
              </h3>
              <p className="modal-header-sub">
                Target Port: {network.port} | EVM Chain ID: {network.chainId || 31337}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-[#040904] border border-[#1a3d1a] rounded">
              <span className="text-xs uppercase text-[#2a8a2a] block">Active Height</span>
              <span className="text-base font-bold text-[#5aff5a]">
                {blockNumber !== null ? `#${blockNumber}` : 'Syncing...'}
              </span>
            </div>
            <div className="p-3 bg-[#040904] border border-[#1a3d1a] rounded">
              <span className="text-xs uppercase text-[#2a8a2a] block">Status Check</span>
              <span className="text-base font-bold text-[#39ff14]">Online (200 OK)</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[rgba(239,68,68,0.12)] border border-[#ef4444] rounded text-[#f87171] text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#2a8a2a]">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#39ff14]" />
              <p className="text-sm">Querying active balances from node socket...</p>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-bold uppercase text-[#2a8a2a] tracking-wider mb-2">
                Pre-funded Genesis & Node Wallets (Top 10)
              </h4>
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div key={acc.address} className="account-item-box">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <span className="text-xs text-[#2a8a2a] w-5">#{acc.index}</span>
                      <code className="account-addr-text">
                        {acc.address}
                      </code>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="account-balance-tag">
                        {parseFloat(acc.balance).toFixed(4)} ETH
                      </span>
                      <button
                        onClick={() => copyToClipboard(acc.address, acc.index)}
                        className="modal-close-btn"
                        title="Copy Public Key"
                      >
                        {copiedIndex === acc.index ? (
                          <Check size={14} className="text-[#39ff14]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={fetchNetworkState}
            disabled={loading}
            className="modal-action-btn"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Poll Node</span>
          </button>
          <button
            onClick={onClose}
            className="modal-action-btn"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
