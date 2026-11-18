// Template container utilities
// Provides a lightweight long‑living container per network category (private, consortium).
// The template container holds a Docker network and can be reused for spawning child containers.

const Docker = require('dockerode');

/**
 * Ensure a template container exists for the given category.
 * @param {object} networkManager - Instance of NetworkManager (holds docker client).
 * @param {string} category - Template category, e.g., 'private' or 'consortium'.
 * @returns {Promise<object>} Resolves with { container, networkName }.
 */
async function ensureTemplate(networkManager, category) {
  if (!networkManager._templateContainers) {
    networkManager._templateContainers = {};
  }

  if (networkManager._templateContainers[category]) {
    return networkManager._templateContainers[category];
  }

  const docker = networkManager.docker;
  const templateName = `chainforger-${category}-template-${Date.now()}`;
  const networkName = `chainforger-${category}-net`;

  // Ensure Docker network exists (create if missing)
  let network;
  try {
    network = docker.getNetwork(networkName);
    await network.inspect();
  } catch (_) {
    network = await docker.createNetwork({ Name: networkName, Driver: 'bridge' });
  }

  // Use a tiny image that just sleeps forever. Alpine is commonly available.
  const image = 'alpine:latest';
  // Pull if not present
  try {
    await docker.createContainer({ Image: image, name: `${templateName}-pull-test` });
  } catch (e) {
    // Pull image
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (pullErr) => (pullErr ? reject(pullErr) : resolve()));
      });
    });
  }

  const container = await docker.createContainer({
    Image: image,
    name: templateName,
    Cmd: ['sh', '-c', 'while true; do sleep 3600; done'],
    HostConfig: { NetworkMode: networkName }
  });
  await container.start();

  const result = { container, networkName };
  networkManager._templateContainers[category] = result;
  return result;
}

/**
 * Cleanup all template containers and networks.
 * Called during process exit.
 */
async function cleanupTemplates(networkManager) {
  if (!networkManager._templateContainers) return;
  for (const cat of Object.keys(networkManager._templateContainers)) {
    const { container, networkName } = networkManager._templateContainers[cat];
    try {
      await container.stop({ t: 2 });
      await container.remove({ force: true });
    } catch (_) {}
    try {
      const net = networkManager.docker.getNetwork(networkName);
      await net.remove();
    } catch (_) {}
  }
  networkManager._templateContainers = {};
}

module.exports = { ensureTemplate, cleanupTemplates };

