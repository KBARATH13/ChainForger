const express = require('express');
const router = express.Router();
const networkManager = require('../services/networkManager');
const { authenticate, requireRole } = require('../middleware/auth');

const canAccessNetwork = (req, res, networkId) => {
  const network = networkManager.getNetwork(networkId);
  if (!network) {
    res.status(404).json({ success: false, error: `Network "${networkId}" not found.` });
    return false;
  }

  if (req.user.role !== 'admin' &&
      (!req.user.companyName || network.companyName !== req.user.companyName)) {
    res.status(404).json({ success: false, error: `Network "${networkId}" not found.` });
    return false;
  }

  return true;
};

/**
 * GET /api/networks/quota
 * Returns real-time quota usage and remaining allowance for the authenticated user
 */
router.get('/quota', authenticate, async (req, res) => {
  try {
    await networkManager.syncWithInfrastructure();
    const quota = networkManager.getUserQuota(req.user);
    return res.json({
      success: true,
      quota
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/networks/deploy
 */
router.post('/deploy', authenticate, requireRole('developer'), async (req, res) => {
  try {
    const {
      networkId,
      templateCategory,
      type,
      consensus,
      port,
      chainId,
      blockTime,
      statePath,
      participantCount,
      validatorNodes,
      nativeCurrency,
      tokenSettings,
      nftSettings,
      gasParameters,
      interopRules,
      dockerImage,
      auditVaultAddress
    } = req.body;

    if (!networkId) {
      return res.status(400).json({
        success: false,
        error: 'Field "networkId" is required.'
      });
    }

    const network = await networkManager.deployNetwork({
      networkId,
      templateCategory: templateCategory || 'public',
      type: type || 'anvil',
      consensus: consensus || 'clique',
      port: port ? parseInt(port, 10) : 8545,
      chainId: chainId ? parseInt(chainId, 10) : 31337,
      blockTime: blockTime !== undefined ? parseInt(blockTime, 10) : 0,
      statePath,
      participantCount: participantCount ? parseInt(participantCount, 10) : 1,
      validatorNodes: validatorNodes || [],
      nativeCurrency: nativeCurrency || { name: 'Ethereum', symbol: 'ETH', faucetInitialFunding: 10000 },
      tokenSettings: tokenSettings || {},
      nftSettings: nftSettings || {},
      gasParameters: gasParameters || {},
      interopRules: interopRules || {},
      dockerImage,
      user: req.user,
      auditVaultAddress
    });

    return res.status(201).json({
      success: true,
      message: `Network "${networkId}" initialized and running for ${req.user.companyName}.`,
      network
    });
  } catch (err) {
    console.error('[Deploy Network Error]', err.message);
    const isQuota = err.statusCode === 403 || (typeof err.code === 'string' && err.code.includes('QUOTA')) || err.message.toLowerCase().includes('quota');
    const isConflict = err.message.includes('already assigned') ||
      err.message.includes('already active');
    const isBadRequest = err.message.includes('required') || err.message.includes('Unsupported network type');
    const statusCode = isQuota ? 403 : isConflict ? 409 : isBadRequest ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error during deployment'
    });
  }
});

/**
 * POST /api/networks/:networkId/stop or /api/networks/stop
 */
const stopHandler = async (req, res) => {
  try {
    const networkId = req.params.networkId || req.body.networkId;
    if (!networkId) {
      return res.status(400).json({ success: false, error: 'networkId is required.' });
    }
    if (!canAccessNetwork(req, res, networkId)) return;
    const result = await networkManager.stopNetwork(networkId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: err.message
    });
  }
};

router.post('/:networkId/stop', authenticate, requireRole('developer'), stopHandler);
router.post('/stop', authenticate, requireRole('developer'), stopHandler);

router.post('/:networkId/restart', authenticate, requireRole('developer'), async (req, res) => {
  const { networkId } = req.params;
  if (!canAccessNetwork(req, res, networkId)) return;
  try {
    const network = await networkManager.restartNetwork(networkId);
    return res.json({ success: true, network });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 :
      err.message.includes('still starting') ? 409 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/:networkId', authenticate, requireRole('developer'), async (req, res) => {
  const { networkId } = req.params;
  if (!canAccessNetwork(req, res, networkId)) return;
  try {
    const result = await networkManager.deleteNetwork(networkId);
    return res.json({ success: true, ...result });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/networks (and /active)
 */
const listNetworksHandler = async (req, res) => {
  try {
    await networkManager.syncWithInfrastructure();

    const companyName = req.user.role === 'admin' ? null : req.user.companyName;
    const all = req.user.role === 'admin'
      ? networkManager.getActiveNetworks()
      : companyName
        ? networkManager.getActiveNetworks(companyName)
        : [];

    const active = req.query.status === 'all'
      ? all
      : all.filter((n) => n.status === 'running' || n.status === 'starting');

    return res.json({
      success: true,
      count: active.length,
      organization: req.user.companyName,
      networks: active
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/', authenticate, listNetworksHandler);
router.get('/active', authenticate, listNetworksHandler);

/**
 * GET /api/networks/:networkId
 */
router.get('/:networkId', authenticate, (req, res) => {
  const { networkId } = req.params;
  const network = networkManager.getNetwork(networkId);

  if (!canAccessNetwork(req, res, networkId)) return;

  return res.json({ success: true, network });
});

/**
 * GET /api/networks/:networkId/logs
 */
router.get('/:networkId/logs', authenticate, (req, res) => {
  const { networkId } = req.params;
  if (!canAccessNetwork(req, res, networkId)) return;
  const logs = networkManager.getNetworkLogs(networkId);

  if (!logs) {
    return res.status(404).json({ success: false, error: `Network "${networkId}" not found.` });
  }

  return res.json({ success: true, networkId, logs });
});

module.exports = router;
