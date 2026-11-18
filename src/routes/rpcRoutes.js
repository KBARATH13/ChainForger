const express = require('express');
const router = express.Router();
const networkManager = require('../services/networkManager');

/**
 * GET /api/rpc/:networkId
 * Health check / info for custom RPC clients
 */
router.get('/:networkId', (req, res) => {
  const { networkId } = req.params;
  const network = networkManager.getNetwork(networkId);

  if (!network) {
    return res.status(404).json({
      success: false,
      error: `Network "${networkId}" not found.`
    });
  }

  return res.json({
    status: 'online',
    networkId: network.networkId,
    templateCategory: network.templateCategory,
    chainId: network.chainId,
    service: 'ChainForger Virtual RPC Gateway',
    runtimeStatus: network.status
  });
});

/**
 * POST /api/rpc/:networkId
 * JSON-RPC Reverse Proxy & State Forwarder
 */
router.post('/:networkId', async (req, res) => {
  const { networkId } = req.params;
  const network = networkManager.getNetwork(networkId);

  const reqId = req.body && req.body.id !== undefined ? req.body.id : 1;

  if (!network) {
    return res.status(404).json({
      jsonrpc: '2.0',
      id: reqId,
      error: { code: -32000, message: `Virtual Network "${networkId}" not found.` }
    });
  }

  if (network.status !== 'running') {
    return res.status(503).json({
      jsonrpc: '2.0',
      id: reqId,
      error: { code: -32000, message: `Virtual Network "${networkId}" is currently ${network.status}.` }
    });
  }

  const targetHost = '127.0.0.1';
  const targetPort = network.port || 8545;
  const targetUrl = `http://${targetHost}:${targetPort}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(10000)
    });

    const upstreamData = await upstreamRes.json();
    return res.status(upstreamRes.status).json(upstreamData);
  } catch (err) {
    return res.status(502).json({
      jsonrpc: '2.0',
      id: reqId,
      error: {
        code: -32603,
        message: `ChainForger Gateway failed to forward to engine (${targetUrl}): ${err.message}`
      }
    });
  }
});

module.exports = router;
