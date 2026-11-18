// Private network utilities (Geth POA)
// This module provides Docker container spawning logic for private blockchain networks.

const Docker = require('dockerode');
const fs = require('fs');

/**
 * Spawn a Docker container for a private network (Geth POA).
 * @param {object} networkManager - Instance of NetworkManager for logging.
 * @param {object} networkRecord - Network record containing configuration.
 * @param {object} options - Options such as dockerImage and isGeth flag.
 */
async function spawnDockerContainer(networkManager, networkRecord, { dockerImage, isGeth, networkName } = {}) {
  // Ensure Docker is reachable
  try {
    await networkManager.docker.ping();
  } catch (err) {
    throw new Error(`Docker daemon unavailable: ${err.message}`);
  }

  const containerName = `chainforger-${networkRecord.networkId}-${Date.now()}`;
  const portStr = String(networkRecord.port);
  const defaultImage = 'ethereum/client-go:v1.13.14';
  const imageToUse = dockerImage || defaultImage;
  const isGethImage = imageToUse.includes('client-go') || isGeth;

  const cmd = isGethImage
    ? [
        '--dev',
        '--http',
        '--http.addr', '0.0.0.0',
        '--http.port', '8545',
        '--http.api', 'eth,net,web3,personal',
        '--http.corsdomain', '*',
        '--networkid', String(networkRecord.chainId)
      ]
    : ['anvil', '--host', '0.0.0.0', '--port', '8545', '--chain-id', String(networkRecord.chainId)];

  let container;
  try {
    container = await networkManager.docker.createContainer({
      Image: imageToUse,
      name: containerName,
      Cmd: cmd,
      ExposedPorts: { '8545/tcp': {} },
      HostConfig: { PortBindings: { '8545/tcp': [{ HostPort: portStr }] }, NetworkMode: networkName }
    });
  } catch (createErr) {
    if (createErr.statusCode === 404 || createErr.message.includes('No such image')) {
      networkManager.appendLog(networkRecord.networkId, 'stdout', `Pulling image ${imageToUse} from registry...`);
      await new Promise((resolve, reject) => {
        networkManager.docker.pull(imageToUse, (pullErr, stream) => {
          if (pullErr) return reject(pullErr);
          networkManager.docker.modem.followProgress(stream, (followErr) => {
            if (followErr) return reject(followErr);
            resolve();
          });
        });
      });
      // Retry after pull
      container = await networkManager.docker.createContainer({
        Image: imageToUse,
        name: containerName,
        Cmd: cmd,
        ExposedPorts: { '8545/tcp': {} },
        HostConfig: { PortBindings: { '8545/tcp': [{ HostPort: portStr }] }, NetworkMode: networkName }
      });
    } else {
      throw createErr;
    }
  }

  networkRecord.container = container;
  networkRecord.containerId = container.id;
  await container.start();

  // Stream container logs
  container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
    if (!err && stream) {
      stream.on('data', (chunk) => {
        networkManager.appendLog(networkRecord.networkId, 'stdout', chunk.toString('utf8'));
      });
      stream.on('error', (streamErr) => {
        networkManager.appendLog(networkRecord.networkId, 'stderr', streamErr.message);
      });
    }
  });
}

module.exports = { spawnDockerContainer };

