const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const indexer = require('../services/indexer');
const networkManager = require('../services/networkManager');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * GET /api/audit-logs
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { networkId, limit } = req.query;
    if (networkId !== undefined && typeof networkId !== 'string') {
      return res.status(400).json({ success: false, error: 'networkId must be a single value.' });
    }
    const parsedLimit = limit === undefined ? 50 : Number.parseInt(limit, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
      return res.status(400).json({ success: false, error: 'limit must be an integer between 1 and 500.' });
    }

    let visibleNetworkIds = networkId;
    if (req.user.role !== 'admin') {
      if (networkId) {
        const network = networkManager.getNetwork(networkId);
        if (!network || !req.user.companyName || network.companyName !== req.user.companyName) {
          return res.status(404).json({ success: false, error: `Network "${networkId}" not found.` });
        }
      } else {
        visibleNetworkIds = req.user.companyName
          ? networkManager.getActiveNetworks(req.user.companyName).map((network) => network.networkId)
          : [];
      }
    }

    const logs = await indexer.getAuditLogs(visibleNetworkIds, parsedLimit);
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/audit-logs/indexer/start
 */
router.post('/indexer/start', authenticate, requireRole('developer'), async (req, res) => {
  try {
    const { networkId, auditVaultAddress } = req.body;

    if (typeof networkId !== 'string' || !networkId || !ethers.isAddress(auditVaultAddress)) {
      return res.status(400).json({
        success: false,
        error: 'networkId and a valid auditVaultAddress are required.'
      });
    }

    const network = networkManager.getNetwork(networkId);
    if (!network || !req.user.companyName || network.companyName !== req.user.companyName) {
      return res.status(404).json({ success: false, error: `Network "${networkId}" not found.` });
    }

    await indexer.startIndexing(networkId, network.rpcUrl, auditVaultAddress);

    return res.json({
      success: true,
      message: `Event indexer started for AuditVault at ${auditVaultAddress}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
