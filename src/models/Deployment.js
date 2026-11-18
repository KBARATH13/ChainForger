const mongoose = require('mongoose');

const DeploymentSchema = new mongoose.Schema(
  {
    networkId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    // Template Archetype: 'public', 'private', 'consortium'
    templateCategory: {
      type: String,
      enum: ['public', 'private', 'consortium'],
      default: 'public'
    },
    // Runtime execution driver: 'anvil', 'docker', 'geth'
    type: {
      type: String,
      enum: ['anvil', 'docker', 'geth'],
      default: 'anvil'
    },
    consensus: {
      type: String,
      enum: ['clique', 'pos', 'ibft', 'instant'],
      default: 'clique'
    },
    port: {
      type: Number,
      required: true
    },
    chainId: {
      type: Number,
      required: true
    },
    rpcUrl: {
      type: String,
      required: true
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    companyName: {
      type: String,
      trim: true
    },
    apiKey: {
      type: String,
      index: true
    },
    containerId: {
      type: String,
      default: null
    },
    // Participant Scaling for Private / Consortium
    participantCount: {
      type: Number,
      default: 1
    },
    validatorNodes: [
      {
        nodeId: String,
        address: String,
        role: { type: String, enum: ['validator', 'signer', 'observer', 'gateway'], default: 'validator' },
        port: Number
      }
    ],
    // Native Gas Asset Settings
    nativeCurrency: {
      name: { type: String, default: 'Ethereum' },
      symbol: { type: String, default: 'ETH' },
      faucetInitialFunding: { type: Number, default: 10000 }
    },
    // Dual-Token Layer: FT (ERC20)
    tokenSettings: {
      enabled: { type: Boolean, default: true },
      name: String,
      symbol: String,
      decimals: { type: Number, default: 18 },
      initialSupply: { type: Number, default: 0 }
    },
    // Dual-Token Layer: NFT (ERC721)
    nftSettings: {
      enabled: { type: Boolean, default: false },
      name: String,
      symbol: String,
      policy: { type: String, enum: ['STRICT_UNIQUE', 'MULTI_MINT_SERIES'], default: 'STRICT_UNIQUE' },
      maxSupply: { type: Number, default: 0 }
    },
    // Operational & Gas Parameters
    gasParameters: {
      blockGasLimit: { type: String, default: '30000000' },
      baseFee: { type: Number, default: 0 },
      zeroGasMode: { type: Boolean, default: false }
    },
    // Consortium & Interop Rules
    interopRules: {
      crossModulePermissions: { type: Boolean, default: false },
      quorumPercentage: { type: Number, default: 66 }
    },
    statePath: {
      type: String
    },
    status: {
      type: String,
      enum: ['starting', 'running', 'stopped', 'failed'],
      default: 'starting'
    },
    blockTime: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Deployment', DeploymentSchema);
