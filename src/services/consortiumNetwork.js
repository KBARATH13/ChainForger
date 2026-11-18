// Consortium network utilities (Validator set)
// This module currently reuses the private network Docker spawning logic.
// Future enhancements can add validator-specific configuration.

const { spawnDockerContainer } = require('./privateNetwork'); // Reuse implementation

module.exports = { spawnDockerContainer };

