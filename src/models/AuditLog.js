const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    networkId: {
      type: String,
      required: true,
      index: true
    },
    contractAddress: {
      type: String,
      lowercase: true,
      trim: true
    },
    recordId: {
      type: Number,
      required: true
    },
    stateHash: {
      type: String,
      required: true
    },
    metadata: {
      type: String,
      default: ''
    },
    operator: {
      type: String,
      lowercase: true,
      required: true
    },
    blockNumber: {
      type: Number,
      required: true
    },
    transactionHash: {
      type: String,
      default: ''
    },
    eventTimestamp: {
      type: Date,
      default: Date.now
    },
    syncedFromChain: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for unique records per network & contract
AuditLogSchema.index({ networkId: 1, contractAddress: 1, recordId: 1 }, { unique: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);

