import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, RefreshCw, Check } from 'lucide-react';
import { fetchNetworkLogs } from '../services/api';
import './LogsModal.css';

export default function LogsModal({ network, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logEndRef = useRef(null);

  const loadLogs = async () => {
    if (!network?.networkId) return;
    try {
      const data = await fetchNetworkLogs(network.networkId);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [network]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, network]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="logs-modal-backdrop" onClick={onClose}>
      <div className="logs-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="logs-header">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-[#39ff14]" />
            <div>
              <h3 className="logs-title">
                {network.networkId} &mdash; Process Log Stream
              </h3>
              <p className="logs-sub">
                Target: {network.type} on port {network.port}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 bg-[#070d07]">
          <div className="logs-terminal-box">
            {loading && logs.length === 0 ? (
              <div className="text-center py-12 text-[#2a8a2a]">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#39ff14]" />
                <p>Initializing tail stream buffer...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-[#2a8a2a] italic">No console logs output yet.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 leading-relaxed">
                  <span className="text-[#2a8a2a] select-none mr-2">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="logs-footer">
          <div className="logs-status-indicator">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-[#39ff14] shadow-[0_0_8px_#39ff14]' : 'bg-[#2a8a2a]'}`} />
            <span>{autoRefresh ? 'Streaming real-time stdout/stderr' : 'Live stream paused'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`logs-toggle-btn ${autoRefresh ? 'logs-toggle-active' : ''}`}
            >
              {autoRefresh ? <Check size={14} /> : null}
              <span>Auto-refresh</span>
            </button>
            <button
              onClick={onClose}
              className="modal-action-btn"
            >
              Close Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
