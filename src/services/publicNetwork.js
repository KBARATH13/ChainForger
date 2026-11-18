// Public network utilities (Anvil)
// Provides functions for resolving the Anvil executable, spawning the Master Anvil Engine,
// and multiplexing virtual tenant network slices on top of it.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Resolve anvil binary executable path across Windows, WSL, and Git Bash installations.
 */
function resolveAnvilExecutable() {
  if (process.env.ANVIL_PATH && process.env.ANVIL_PATH.trim().length > 0 && process.env.ANVIL_PATH.trim() !== 'anvil') {
    const customPath = process.env.ANVIL_PATH.trim();
    if (fs.existsSync(customPath)) {
      return customPath;
    }
  }

  const homeDir = os.homedir();
  const candidatePaths = [
    path.join(homeDir, '.foundry', 'bin', 'anvil.exe'),
    path.join(homeDir, '.foundry', 'bin', 'anvil'),
    path.join(homeDir, 'AppData', 'Local', '.foundry', 'bin', 'anvil.exe')
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }

  return process.env.ANVIL_PATH ? process.env.ANVIL_PATH.trim() : 'anvil';
}

async function isAnvilRunningAt(port = 8545) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 1 }),
      signal: AbortSignal.timeout(1000)
    });
    const data = await res.json();
    return Boolean(data && typeof data.result === 'string' && data.result.toLowerCase().includes('anvil'));
  } catch (_) {
    return false;
  }
}

/**
 * Spawn a Foundry Anvil process or attach to Master Anvil Engine.
 * @param {object} networkManager - Instance of NetworkManager.
 * @param {object} networkRecord - Network record.
 * @param {object} options - Options such as blockTime.
 */
async function spawnAnvilProcess(networkManager, networkRecord, { blockTime } = {}) {
  const targetPort = Number(networkRecord.port) || 8545;

  // 1. Check if Master Anvil instance is already running in NetworkManager
  if (networkManager._masterAnvil && networkManager._masterAnvil.process && !networkManager._masterAnvil.process.killed) {
    networkRecord.process = networkManager._masterAnvil.process;
    networkRecord.port = networkManager._masterAnvil.port || targetPort;
    networkRecord.isVirtualSlice = true;
    networkManager.appendLog(
      networkRecord.networkId,
      'stdout',
      `Attached virtual slice "${networkRecord.networkId}" to Master Anvil Engine on port ${networkRecord.port}.`
    );
    return networkRecord.process;
  }

  // 2. Check if an external or pre-existing Anvil is already listening on the requested port
  const isExistingAnvil = await isAnvilRunningAt(targetPort);
  if (isExistingAnvil) {
    networkRecord.process = null;
    networkRecord.isVirtualSlice = true;
    networkManager._masterAnvil = { process: null, port: targetPort, external: true };
    networkManager.appendLog(
      networkRecord.networkId,
      'stdout',
      `Reusing active Master Anvil Engine detected on port ${targetPort} for virtual slice "${networkRecord.networkId}".`
    );
    return null;
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--port', String(targetPort),
      '--chain-id', String(networkRecord.chainId),
      '--host', '0.0.0.0'
    ];

    // State persistence configuration
    if (networkRecord.statePath) {
      if (fs.existsSync(networkRecord.statePath)) {
        args.push('--state', networkRecord.statePath);
      }
      args.push('--dump-state', networkRecord.statePath);
    }

    if (blockTime && Number(blockTime) > 0) {
      args.push('--block-time', String(blockTime));
    }

    const isWindows = process.platform === 'win32';
    const anvilBin = resolveAnvilExecutable();

    let child;
    try {
      child = spawn(anvilBin, args, { shell: isWindows, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(new Error(`Failed to invoke anvil executable (${anvilBin}): ${err.message}. Ensure Foundry anvil is installed or set ANVIL_PATH.`));
    }

    networkRecord.process = child;
    networkManager._masterAnvil = { process: child, port: targetPort, external: false };
    let hasStarted = false;
    let stderrBuffer = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      networkManager.appendLog(networkRecord.networkId, 'stdout', text);
      if (!hasStarted && (text.includes('Listening on') || text.includes('0.0.0.0:') || text.includes('127.0.0.1:'))) {
        hasStarted = true;
        resolve(child);
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderrBuffer += text;
      networkManager.appendLog(networkRecord.networkId, 'stderr', text);
      console.error(`[Anvil ${networkRecord.networkId} stderr] ${text.trim()}`);
    });

    child.on('error', (err) => {
      networkRecord.status = 'failed';
      networkRecord.error = err.message;
      if (!hasStarted) {
        reject(new Error(`Anvil process error: ${err.message}`));
      }
    });

    child.on('exit', (code, signal) => {
      const exitMsg = `Anvil process exited with code ${code} and signal ${signal}`;
      networkManager.appendLog(networkRecord.networkId, 'stdout', exitMsg);
      if (networkRecord.status === 'running' || networkRecord.status === 'starting') {
        networkRecord.status = 'stopped';
      }
      if (networkManager._masterAnvil && networkManager._masterAnvil.process === child) {
        networkManager._masterAnvil = null;
      }
      if (!hasStarted) {
        let detailedError = exitMsg;
        const trimmed = stderrBuffer.trim();
        if (trimmed) {
          if (trimmed.includes('os error 10048') || trimmed.toLowerCase().includes('address already in use')) {
            detailedError = `Port ${targetPort} is already in use by another non-Anvil service.`;
          } else {
            detailedError = trimmed;
          }
        }
        reject(new Error(`Anvil exited prematurely: ${detailedError}`));
      }
    });

    // Fallback timeout in case stdout banner differed
    setTimeout(() => {
      if (!hasStarted) {
        if (child && !child.killed && child.exitCode === null) {
          hasStarted = true;
          resolve(child);
        } else {
          reject(new Error('Anvil startup timed out or process did not start properly.'));
        }
      }
    }, 2500);
  });
}

module.exports = {
  resolveAnvilExecutable,
  spawnAnvilProcess,
  isAnvilRunningAt
};
