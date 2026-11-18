const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email must be 254 characters or fewer'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be valid']
    },
    password: {
      type: String,
      minlength: 6,
      maxlength: 128,
      select: false // Exclude from query results by default
    },
    companyName: {
      type: String,
      required: [true, 'Company or individual name is required'],
      trim: true,
      maxlength: [100, 'Company or individual name must be 100 characters or fewer']
    },
    companyNameKey: {
      type: String,
      select: false
    },
    isOrganizationOwner: {
      type: Boolean,
      default: false,
      select: false
    },
    walletAddress: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      sparse: true
    },
    nonce: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex')
    },
    role: {
      type: String,
      enum: ['admin', 'developer', 'auditor'],
      default: 'developer'
    },
    apiKey: {
      type: String,
      unique: true,
      index: true,
      default: () => `cfg_live_${crypto.randomBytes(24).toString('hex')}`
    }
  },
  {
    timestamps: true
  }
);

UserSchema.index(
  { companyNameKey: 1 },
  { unique: true, partialFilterExpression: { isOrganizationOwner: true } }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to regenerate SIWE nonce
UserSchema.methods.generateNonce = function () {
  this.nonce = crypto.randomBytes(16).toString('hex');
  return this.nonce;
};

// Instance method to rotate API key
UserSchema.methods.rotateApiKey = function () {
  this.apiKey = `cfg_live_${crypto.randomBytes(24).toString('hex')}`;
  return this.apiKey;
};

module.exports = mongoose.model('User', UserSchema);
