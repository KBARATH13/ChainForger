const { ethers } = require('ethers');
const AuditLog = require('../models/AuditLog');

const AUDIT_VAULT_ABI = [
  'event AuditRecordAppended(uint256 indexed id, bytes32 indexed stateHash, address indexed operator, string metadata, uint256 timestamp)',
  'function totalRecords() external view returns (uint256)',
  'function getRecord(uint256 id) external view returns (tuple(uint256 id, bytes32 stateHash, string metadata, address operator, uint256 timestamp, uint256 blockNumber))'
];

class ContractIndexer {
  constructor() {
    this.activeListeners = new Map(); // networkId -> { provider, contract, intervalId }
  }

  /**
   * Start listening to contract events on an active local blockchain
   * @param {string} networkId
   * @param {string} rpcUrl
   * @param {string} auditVaultAddress
   */
  async startIndexing(networkId, rpcUrl, auditVaultAddress) {
    if (this.activeListeners.has(networkId)) {
      this.stopIndexing(networkId);
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Verify connection
      await provider.getBlockNumber();

      let contract = null;
      if (auditVaultAddress && ethers.isAddress(auditVaultAddress)) {
        contract = new ethers.Contract(auditVaultAddress, AUDIT_VAULT_ABI, provider);

        // Listen for live AuditRecordAppended events
        contract.on('AuditRecordAppended', async (id, stateHash, operator, metadata, timestamp, event) => {
          console.log(`[Indexer:${networkId}] New Audit Event Detected: Record #${id}`);
          try {
            await AuditLog.findOneAndUpdate(
              {
                networkId,
                contractAddress: auditVaultAddress.toLowerCase(),
                recordId: Number(id)
              },
              {
                networkId,
                contractAddress: auditVaultAddress.toLowerCase(),
                recordId: Number(id),
                stateHash,
                metadata,
                operator: operator.toLowerCase(),
                blockNumber: event?.log?.blockNumber || 0,
                transactionHash: event?.log?.transactionHash || '',
                eventTimestamp: new Date(Number(timestamp) * 1000),
                syncedFromChain: true
              },
              { upsert: true, new: true }
            );
          } catch (dbErr) {
            console.error(`[Indexer:${networkId}] DB Sync Error:`, dbErr.message);
          }
        });
      }

      // Background poller to catch up on any historical/missed blocks
      const poller = setInterval(async () => {
        try {
          if (contract && auditVaultAddress) {
            await this.syncHistoricalEvents(networkId, contract, auditVaultAddress);
          }
        } catch (_) {}
      }, 10000);

      this.activeListeners.set(networkId, { provider, contract, poller });
      console.log(`[Indexer] Started event indexing for network "${networkId}" at ${rpcUrl}`);
    } catch (err) {
      console.warn(`[Indexer] Could not connect to network "${networkId}" (${rpcUrl}): ${err.message}`);
    }
  }

  /**
   * Sync historical AuditVault events
   */
  async syncHistoricalEvents(networkId, contract, auditVaultAddress) {
    try {
      const total = await contract.totalRecords();
      const count = Number(total);

      for (let i = 0; i < count; i++) {
        const exists = await AuditLog.findOne({
          networkId,
          contractAddress: auditVaultAddress.toLowerCase(),
          recordId: i
        });

        if (!exists) {
          const rec = await contract.getRecord(i);
          await AuditLog.create({
            networkId,
            contractAddress: auditVaultAddress.toLowerCase(),
            recordId: Number(rec.id),
            stateHash: rec.stateHash,
            metadata: rec.metadata,
            operator: rec.operator.toLowerCase(),
            blockNumber: Number(rec.blockNumber),
            eventTimestamp: new Date(Number(rec.timestamp) * 1000),
            syncedFromChain: true
          });
        }
      }
    } catch (_) {}
  }

  /**
   * Stop indexing an inactive network
   * @param {string} networkId
   */
  stopIndexing(networkId) {
    const listener = this.activeListeners.get(networkId);
    if (listener) {
      if (listener.poller) clearInterval(listener.poller);
      if (listener.contract) listener.contract.removeAllListeners();
      this.activeListeners.delete(networkId);
      console.log(`[Indexer] Stopped event indexing for network "${networkId}"`);
    }
  }

  /**
   * Fetch indexed audit logs from database
   */
  async getAuditLogs(networkId, limit = 50) {
    try {
      const query = Array.isArray(networkId)
        ? { networkId: { $in: networkId } }
        : networkId ? { networkId } : {};
      return await AuditLog.find(query).sort({ createdAt: -1 }).limit(limit);
    } catch (err) {
      return [];
    }
  }
}

module.exports = new ContractIndexer();
