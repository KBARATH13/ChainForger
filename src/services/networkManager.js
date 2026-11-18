const { spawnAnvilProcess, isAnvilRunningAt } = require('./publicNetwork');
const { spawnDockerContainer: spawnDockerPrivate } = require('./privateNetwork');
const { spawnDockerContainer: spawnDockerConsortium } = require('./consortiumNetwork');
const { ensureTemplate, cleanupTemplates } = require('./templateContainer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const Docker = require('dockerode');
const Deployment = require('../models/Deployment');
const indexer = require('./indexer');

class NetworkManager {
  constructor() {
    this.activeNetworks = new Map();
    this.statesDir = process.env.STATES_DIR || path.resolve(process.cwd(), 'states');
    this._masterAnvil = null;

    // Ensure state persistence directory exists
    try {
      if (!fs.existsSync(this.statesDir)) {
        fs.mkdirSync(this.statesDir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[NetworkManager] Could not initialize statesDir (${this.statesDir}):`, err.message);
    }

    this.docker = new Docker(
      process.env.DOCKER_HOST
        ? { host: process.env.DOCKER_HOST }
        : process.platform === 'win32'
        ? { socketPath: '//./pipe/docker_engine' }
        : { socketPath: '/var/run/docker.sock' }
    );

    this.setupExitHandlers();
  }

  setupExitHandlers() {
    const cleanup = async () => {
      console.log('\n[NetworkManager] Cleaning up active networks before shutdown...');
      const stopPromises = [];
      for (const [networkId] of this.activeNetworks.entries()) {
        stopPromises.push(
          this.stopNetwork(networkId).catch(err =>
            console.error(`[NetworkManager] Failed to stop network ${networkId} during exit:`, err.message)
          )
        );
      }
      await Promise.all(stopPromises);
      // Cleanup template containers and networks
      await cleanupTemplates(this);
    };

    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
  }

  appendLog(networkId, stream, message) {
    const network = this.activeNetworks.get(networkId);
    if (!network) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      stream,
      message: message.trim()
    };

    if (logEntry.message.length > 0) {
      network.logs.push(logEntry);
      if (network.logs.length > 500) network.logs.shift();
    }
  }

  checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Calculate active network counts and remaining quota per user
   * Policy: 3 Public, 3 Private, 3 Consortium = 9 Total Ceiling
   */
  getUserQuota(user) {
    const userId = (user?._id || user?.id || '').toString();
    const company = user?.companyName;

    const counts = {
      public: 0,
      private: 0,
      consortium: 0,
      total: 0
    };

    for (const net of this.activeNetworks.values()) {
      const match =
        (userId && net.creatorId && net.creatorId.toString() === userId) ||
        (company && net.companyName === company);

      if (match && (net.status === 'running' || net.status === 'starting')) {
        const cat = (net.templateCategory || 'public').toLowerCase();
        if (counts[cat] !== undefined) {
          counts[cat]++;
        }
        counts.total++;
      }
    }

    return {
      used: counts,
      limits: {
        public: 3,
        private: 3,
        consortium: 3,
        total: 9
      },
      remaining: {
        public: Math.max(0, 3 - counts.public),
        private: Math.max(0, 3 - counts.private),
        consortium: Math.max(0, 3 - counts.consortium),
        total: Math.max(0, 9 - counts.total)
      }
    };
  }

  /**
   * Enforce strict 3/category and 9/total network quota
   */
  assertUserWithinQuota(user, category = 'public') {
    if (user?.role === 'admin') {
      return; // Admin auditor is exempt
    }

    const { used, limits } = this.getUserQuota(user);
    const cat = (category || 'public').toLowerCase();

    if (used.total >= limits.total) {
      const err = new Error(`Quota limit reached: You have reached the maximum total quota of ${limits.total} active networks across all categories (3 Public, 3 Private, 3 Consortium). To deploy a new network, please stop an unused network or delete an existing network from your Active Networks dashboard.`);
      err.code = 'QUOTA_EXCEEDED';
      err.statusCode = 403;
      throw err;
    }

    if (used[cat] !== undefined && used[cat] >= limits[cat]) {
      const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
      const err = new Error(`Quota limit reached: You have reached the maximum allowed limit of ${limits[cat]} active ${catName} networks. You cannot create more than 3 ${catName} networks regardless of unused slots in other network types. To deploy another ${catName} network, please stop an unused ${catName} network or delete an existing ${catName} network from your Active Networks dashboard.`);
      err.code = 'CATEGORY_QUOTA_EXCEEDED';
      err.statusCode = 403;
      throw err;
    }
  }

  async deployNetwork(options) {
    const {
      networkId,
      templateCategory = 'public',
      type = 'anvil',
      consensus = 'clique',
      port = 8545,
      chainId = 31337,
      blockTime = 0,
      participantCount = 1,
      validatorNodes = [],
      nativeCurrency = { name: 'Ethereum', symbol: 'ETH', faucetInitialFunding: 10000 },
      tokenSettings = {},
      nftSettings = {},
      gasParameters = {},
      interopRules = {},
      dockerImage,
      user,
      auditVaultAddress
    } = options;

    if (!networkId) throw new Error('networkId is required.');

    // 1. Strict Quota Enforcement (3 per category, 9 total)
    this.assertUserWithinQuota(user, templateCategory);

    // 2. Prevent duplicate active ID
    if (this.activeNetworks.has(networkId)) {
      const existing = this.activeNetworks.get(networkId);
      if (existing.status === 'running' || existing.status === 'starting') {
        throw new Error(`Network with id "${networkId}" is already active.`);
      }
    }

    const gatewayPort = process.env.PORT || 4000;
    const isPublicCategory = templateCategory === 'public' || type === 'anvil';

    // 3. Port Allocation & Virtualization Logic
    // For non-public (Docker) networks, ensure no host container port collisions
    if (!isPublicCategory) {
      for (const [id, net] of this.activeNetworks.entries()) {
        if (id !== networkId && net.type !== 'anvil' && net.port === Number(port) && net.status === 'running') {
          throw new Error(`Port ${port} is already assigned to active container network "${id}".`);
        }
      }
    }

    const statePath = options.statePath || path.join(this.statesDir, `${networkId}.json`);
    const virtualRpcUrl = `http://127.0.0.1:${gatewayPort}/api/rpc/${networkId}`;
    const directRpcUrl = `http://127.0.0.1:${port}`;

    const networkRecord = {
      networkId,
      templateCategory,
      type,
      consensus,
      port: Number(port),
      chainId: Number(chainId),
      rpcUrl: virtualRpcUrl,
      directRpcUrl,
      status: 'starting',
      statePath,
      participantCount: Number(participantCount),
      validatorNodes,
      blockTime: Number(blockTime),
      nativeCurrency,
      tokenSettings,
      nftSettings,
      gasParameters,
      interopRules,
      creatorId: user?._id || user?.id,
      companyName: user?.companyName || 'Default Org',
      apiKey: user?.apiKey,
      auditVaultAddress,
      dockerImage,
      logs: [],
      process: null,
      container: null,
      containerId: null,
      isVirtualSlice: isPublicCategory,
      createdAt: new Date().toISOString(),
      error: null
    };

    this.activeNetworks.set(networkId, networkRecord);

    try {
      if (type === 'anvil') {
        // Public network – use/attach to Master Anvil Engine
        await spawnAnvilProcess(this, networkRecord, { blockTime });
      } else if (type === 'docker' || type === 'geth') {
        // Private or consortium – use template container
        const category = templateCategory; // 'private' or 'consortium'
        const { networkName } = await ensureTemplate(this, category);
        const spawnFn = category === 'private' ? spawnDockerPrivate : spawnDockerConsortium;
        await spawnFn(this, networkRecord, { dockerImage, isGeth: type === 'geth', networkName });
      } else {
        throw new Error(`Unsupported network type "${type}". Supported types: anvil, docker, geth.`);
      }

      networkRecord.status = 'running';
      this.appendLog(
        networkId,
        'stdout',
        `Network "${networkId}" (${templateCategory}/${type}/${consensus}) running. Virtual RPC: ${virtualRpcUrl} (Direct: ${directRpcUrl}, Chain ID: ${chainId}). State: ${statePath}`
      );

      // Persist / update in MongoDB if available
      try {
        if (Deployment.db && Deployment.db.readyState === 1 && user) {
          await Deployment.findOneAndUpdate(
            { networkId },
            {
              networkId,
              templateCategory,
              type,
              consensus,
              port: networkRecord.port,
              chainId: networkRecord.chainId,
              rpcUrl: networkRecord.rpcUrl,
              containerId: networkRecord.containerId,
              creator: user._id || user.id,
              companyName: user.companyName,
              apiKey: user.apiKey,
              participantCount: networkRecord.participantCount,
              validatorNodes: networkRecord.validatorNodes,
              nativeCurrency: networkRecord.nativeCurrency,
              tokenSettings: networkRecord.tokenSettings,
              nftSettings: networkRecord.nftSettings,
              gasParameters: networkRecord.gasParameters,
              interopRules: networkRecord.interopRules,
              statePath,
              status: 'running',
              blockTime
            },
            { upsert: true, returnDocument: 'after' }
          );
        }
      } catch (dbErr) {
        console.warn(`[NetworkManager] DB sync warning for ${networkId}:`, dbErr.message);
      }

      if (auditVaultAddress) {
        indexer.startIndexing(networkId, networkRecord.directRpcUrl || networkRecord.rpcUrl, auditVaultAddress);
      }

      return this.serializeNetwork(networkRecord);
    } catch (err) {
      networkRecord.status = 'failed';
      networkRecord.error = err.message;
      this.appendLog(networkId, 'stderr', `Failed to start network: ${err.message}`);
      throw err;
    }
  }

  async stopNetwork(networkId) {
    const network = this.activeNetworks.get(networkId);
    if (!network) throw new Error(`Network "${networkId}" not found.`);

    indexer.stopIndexing(networkId);

    if (network.status === 'stopped') {
      return { networkId, status: 'stopped', message: 'Network was already stopped.' };
    }

    if (network.type === 'anvil') {
      network.status = 'stopped';
      this.appendLog(networkId, 'stdout', `Public virtual network "${networkId}" stopped.`);

      // Check if any other public network slice is still running or starting
      const otherActivePublic = Array.from(this.activeNetworks.values()).some(
        n => n.networkId !== networkId && n.type === 'anvil' && (n.status === 'running' || n.status === 'starting')
      );

      // Only kill the master anvil process if no other virtual slices require it
      if (!otherActivePublic && this._masterAnvil && this._masterAnvil.process && !this._masterAnvil.external) {
        const pid = this._masterAnvil.process.pid;
        if (pid) {
          if (process.platform === 'win32') {
            await new Promise(resolve => exec(`taskkill /pid ${pid} /T /F`, () => resolve()));
          } else {
            try { this._masterAnvil.process.kill('SIGTERM'); } catch (_) {}
          }
        }
        this._masterAnvil = null;
        this.appendLog(networkId, 'stdout', `Master Anvil engine terminated as no active public slices remain.`);
      }
    } else if ((network.type === 'docker' || network.type === 'geth') && network.container) {
      try {
        await network.container.stop({ t: 3 });
        await network.container.remove({ force: true });
      } catch (dockerErr) {
        this.appendLog(networkId, 'stderr', `Error stopping Docker container: ${dockerErr.message}`);
      }
      network.status = 'stopped';
      this.appendLog(networkId, 'stdout', `Docker container stopped and removed.`);
    } else {
      network.status = 'stopped';
    }

    try {
      if (Deployment.db && Deployment.db.readyState === 1) {
        await Deployment.findOneAndUpdate({ networkId }, { status: 'stopped' });
      }
    } catch (dbErr) {
      console.warn(`[NetworkManager] Could not persist stopped status for ${networkId}:`, dbErr.message);
    }

    return { networkId, status: 'stopped', message: `Network "${networkId}" stopped successfully.` };
  }

  async restartNetwork(networkId) {
    const network = this.activeNetworks.get(networkId);
    if (!network) throw new Error(`Network "${networkId}" not found.`);
    if (network.status === 'starting') {
      throw new Error(`Network "${networkId}" is still starting.`);
    }

    await this.stopNetwork(networkId);
    return this.deployNetwork({
      ...network,
      user: {
        id: network.creatorId,
        companyName: network.companyName,
        apiKey: network.apiKey
      }
    });
  }

  async deleteNetwork(networkId) {
    if (!this.activeNetworks.has(networkId)) {
      throw new Error(`Network "${networkId}" not found.`);
    }

    await this.stopNetwork(networkId);
    if (Deployment.db && Deployment.db.readyState === 1) {
      await Deployment.deleteOne({ networkId });
    }
    this.activeNetworks.delete(networkId);
    return { networkId, status: 'deleted', message: `Network "${networkId}" deleted successfully.` };
  }

  async getDockerContainers() {
    // 1. Try Dockerode API
    try {
      const containers = await this.docker.listContainers({ all: true });
      if (Array.isArray(containers)) return containers;
    } catch (_) {}

    // 2. Fallback to docker CLI (robust across Windows named pipe permissions)
    try {
      const stdout = await new Promise((resolve, reject) => {
        exec('docker ps -a --format "{{json .}}"', { windowsHide: true }, (err, out) => {
          if (err) return reject(err);
          resolve(out);
        });
      });

      if (stdout && stdout.trim()) {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const parsed = lines.map((line) => {
          try {
            const raw = JSON.parse(line);
            return {
              Id: raw.ID || raw.Id,
              Names: raw.Names ? (Array.isArray(raw.Names) ? raw.Names : [raw.Names]) : [],
              State: (raw.State || raw.Status || '').toLowerCase().includes('up') ? 'running' : 'exited',
              Status: raw.Status
            };
          } catch (_) {
            return null;
          }
        }).filter(Boolean);
        return parsed;
      }
      return [];
    } catch (_) {
      return null;
    }
  }

  async hydrateFromDatabase() {
    if (!Deployment.db || Deployment.db.readyState !== 1) return;
    try {
      const records = await Deployment.find({ status: { $in: ['running', 'starting'] } });
      for (const rec of records) {
        if (!this.activeNetworks.has(rec.networkId)) {
          this.activeNetworks.set(rec.networkId, {
            networkId: rec.networkId,
            templateCategory: rec.templateCategory,
            type: rec.type,
            consensus: rec.consensus,
            port: rec.port,
            chainId: rec.chainId,
            rpcUrl: rec.rpcUrl,
            directRpcUrl: `http://127.0.0.1:${rec.port}`,
            status: rec.status,
            statePath: rec.statePath,
            participantCount: rec.participantCount,
            validatorNodes: rec.validatorNodes,
            nativeCurrency: rec.nativeCurrency,
            tokenSettings: rec.tokenSettings,
            nftSettings: rec.nftSettings,
            gasParameters: rec.gasParameters,
            interopRules: rec.interopRules,
            creatorId: rec.creator,
            companyName: rec.companyName,
            apiKey: rec.apiKey,
            containerId: rec.containerId,
            logs: [],
            isVirtualSlice: rec.templateCategory === 'public' || rec.type === 'anvil',
            createdAt: rec.createdAt ? rec.createdAt.toISOString() : new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn('[NetworkManager] DB Hydration warning:', err.message);
    }
  }

  async syncWithInfrastructure() {
    await this.hydrateFromDatabase();

    const containers = await this.getDockerContainers();
    const dockerAvailable = Array.isArray(containers);

    const toDelete = [];

    for (const [networkId, net] of this.activeNetworks.entries()) {
      if (net.type === 'docker' || net.type === 'geth' || net.containerId) {
        if (!dockerAvailable) continue;

        // Check if the container still exists in Docker
        const match = containers.find((c) => {
          const idMatch = net.containerId && (
            (c.Id && (c.Id.startsWith(net.containerId) || net.containerId.startsWith(c.Id)))
          );
          const nameMatch = c.Names && c.Names.some((name) =>
            name.toLowerCase().includes(networkId.toLowerCase())
          );
          return idMatch || nameMatch;
        });

        if (!match) {
          // The container was removed/deleted from Docker server-side!
          console.log(`[NetworkManager Sync] Container for network "${networkId}" was removed from Docker. Removing network record.`);
          toDelete.push(networkId);
        } else if (match.State !== 'running' && net.status === 'running') {
          console.log(`[NetworkManager Sync] Container for network "${networkId}" is no longer running in Docker (State: ${match.State}). Marking stopped.`);
          net.status = 'stopped';
          if (Deployment.db && Deployment.db.readyState === 1) {
            Deployment.findOneAndUpdate({ networkId }, { status: 'stopped' }).catch(() => {});
          }
        }
      } else if (net.type === 'anvil') {
        if (net.status === 'running') {
          try {
            const isAlive = await isAnvilRunningAt(net.port);
            if (!isAlive) {
              console.log(`[NetworkManager Sync] Anvil engine for "${networkId}" on port ${net.port} is down. Marking stopped.`);
              net.status = 'stopped';
              if (Deployment.db && Deployment.db.readyState === 1) {
                Deployment.findOneAndUpdate({ networkId }, { status: 'stopped' }).catch(() => {});
              }
            }
          } catch (_) {}
        }
      }
    }

    for (const networkId of toDelete) {
      this.activeNetworks.delete(networkId);
      if (Deployment.db && Deployment.db.readyState === 1) {
        try {
          await Deployment.deleteOne({ networkId });
        } catch (_) {}
      }
    }
  }

  getActiveNetworks(companyName = null) {
    const list = [];
    for (const network of this.activeNetworks.values()) {
      if (!companyName || network.companyName === companyName) {
        list.push(this.serializeNetwork(network));
      }
    }
    return list;
  }

  getNetwork(networkId) {
    const network = this.activeNetworks.get(networkId);
    if (!network) return null;
    return this.serializeNetwork(network);
  }

  getNetworkLogs(networkId) {
    const network = this.activeNetworks.get(networkId);
    if (!network) return null;
    return network.logs;
  }

  serializeNetwork(network) {
    return {
      networkId: network.networkId,
      templateCategory: network.templateCategory,
      type: network.type,
      consensus: network.consensus,
      port: network.port,
      chainId: network.chainId,
      rpcUrl: network.rpcUrl,
      directRpcUrl: network.directRpcUrl || `http://127.0.0.1:${network.port}`,
      isVirtualSlice: Boolean(network.isVirtualSlice),
      status: network.status,
      statePath: network.statePath,
      participantCount: network.participantCount,
      validatorNodes: network.validatorNodes,
      nativeCurrency: network.nativeCurrency,
      tokenSettings: network.tokenSettings,
      nftSettings: network.nftSettings,
      gasParameters: network.gasParameters,
      interopRules: network.interopRules,
      companyName: network.companyName,
      apiKey: network.apiKey,
      createdAt: network.createdAt,
      error: network.error,
      recentLogs: (network.logs || []).slice(-20)
    };
  }
}

module.exports = new NetworkManager();
