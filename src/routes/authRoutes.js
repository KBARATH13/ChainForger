const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/auth');

const pendingNonces = new Map();
const PENDING_NONCE_TTL_MS = 5 * 60 * 1000;

const normalizeCompanyName = (name) => name.trim().replace(/\s+/g, ' ');
const isValidEmail = (email) =>
  typeof email === 'string' &&
  email.trim().length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findCompany = (companyName) =>
  User.findOne({ companyName: new RegExp(`^${escapeRegex(companyName)}$`, 'i') });
const isDuplicateCompanyName = (err) =>
  err?.code === 11000 && err.keyPattern?.companyNameKey === 1;

/**
 * Token Generation Helper
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      walletAddress: user.walletAddress
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ==========================================
// Public Authentication Routes
// ==========================================

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, companyName, walletAddress } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedCompanyName = typeof companyName === 'string'
      ? normalizeCompanyName(companyName)
      : '';

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }
    if (typeof password !== 'string' || password.trim().length === 0 ||
        password.length < 6 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password must be 6 to 128 characters and cannot be blank.'
      });
    }
    if (!normalizedCompanyName || normalizedCompanyName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Company/individual name is required and must be 100 characters or fewer.'
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email address already exists.'
      });
    }

    const existingCompany = await findCompany(normalizedCompanyName);
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        error: 'This company name is already registered. Join the existing organization by invitation.'
      });
    }

    if (walletAddress) {
      if (typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
        return res.status(400).json({ success: false, error: 'A valid public wallet address is required.' });
      }

      const existingWallet = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
      if (existingWallet) {
        return res.status(400).json({
          success: false,
          error: 'This public wallet address is already associated with another account.'
        });
      }
    }

    const user = await User.create({
      email: normalizedEmail,
      password,
      companyName: normalizedCompanyName,
      companyNameKey: normalizedCompanyName.toLowerCase(),
      isOrganizationOwner: true,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : undefined,
      role: 'developer'
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        walletAddress: user.walletAddress,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (err) {
    if (isDuplicateCompanyName(err)) {
      return res.status(409).json({
        success: false,
        error: 'This company name is already registered. Join the existing organization by invitation.'
      });
    }
    console.error('[Auth Error] Register:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address and password are required.'
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (user.role === 'admin') {
      return res.status(401).json({ success: false, error: 'Admin accounts must sign in with their Web3 wallet.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        walletAddress: user.walletAddress,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (err) {
    console.error('[Auth Error] Login:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/nonce
 */
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;
    if (typeof address !== 'string' || !ethers.isAddress(address)) {
      return res.status(400).json({ success: false, error: 'A valid wallet address is required.' });
    }

    const normalizedAddress = address.toLowerCase();
    const user = await User.findOne({ walletAddress: normalizedAddress });

    let nonce;
    if (user) {
      nonce = user.nonce;
    } else {
      nonce = crypto.randomBytes(16).toString('hex');
      pendingNonces.set(normalizedAddress, {
        nonce,
        expiresAt: Date.now() + PENDING_NONCE_TTL_MS
      });
    }
    return res.json({ success: true, address: normalizedAddress, nonce });
  } catch (err) {
    console.error('[Auth Error] getNonce:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/web3-login
 */
const web3LoginHandler = async (req, res) => {
  try {
    const { address, message, signature } = req.body;

    if (typeof address !== 'string' || !ethers.isAddress(address) ||
        typeof message !== 'string' || !message ||
        typeof signature !== 'string' || !signature) {
      return res.status(400).json({ success: false, error: 'Address, message, and signature are required.' });
    }

    const normalizedAddress = address.toLowerCase();
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    } catch {
      return res.status(401).json({ success: false, error: 'Cryptographic signature verification failed.' });
    }

    if (recoveredAddress !== normalizedAddress) {
      return res.status(401).json({ success: false, error: 'Cryptographic signature verification failed.' });
    }

    const configuredAdminWallet = process.env.ADMIN_WALLET_ADDRESS;
    if (configuredAdminWallet && !ethers.isAddress(configuredAdminWallet)) {
      console.error('[Auth Error] ADMIN_WALLET_ADDRESS is not a valid Ethereum address.');
      return res.status(500).json({ success: false, error: 'Web3 login is not configured correctly.' });
    }

    const user = await User.findOne({ walletAddress: normalizedAddress });
    const nonceMatch = typeof message === 'string' && message.match(/^Nonce:\s*(\S+)\s*$/m);

    if (user) {
      if (!nonceMatch || nonceMatch[1] !== user.nonce) {
        return res.status(401).json({ success: false, error: 'Invalid or expired SIWE nonce.' });
      }
      user.generateNonce();
      if (configuredAdminWallet?.toLowerCase() === normalizedAddress) {
        user.role = 'admin';
      } else if (user.role === 'admin') {
        user.role = 'developer';
      }
      await user.save();
    } else {
      const pendingNonce = pendingNonces.get(normalizedAddress);
      if (!nonceMatch || !pendingNonce || pendingNonce.expiresAt < Date.now() ||
          nonceMatch[1] !== pendingNonce.nonce) {
        pendingNonces.delete(normalizedAddress);
        return res.status(401).json({ success: false, error: 'Invalid or expired SIWE nonce.' });
      }

      pendingNonces.delete(normalizedAddress);
      return res.status(404).json({
        success: false,
        error: 'No account is registered for this wallet. Register the wallet before signing in.'
      });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      message: 'SIWE verification successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        walletAddress: user.walletAddress,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (err) {
    console.error('[Auth Error] web3Login:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/auth/wallet-register
 */
const walletRegistrationHandler = async (req, res) => {
  try {
    const { address, message, signature, companyName } = req.body;
    const normalizedCompanyName = typeof companyName === 'string'
      ? normalizeCompanyName(companyName)
      : '';

    if (typeof address !== 'string' || !ethers.isAddress(address) ||
        typeof message !== 'string' || !message ||
        typeof signature !== 'string' || !signature ||
        !normalizedCompanyName || normalizedCompanyName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'A valid address, message, signature, and company name of at most 100 characters are required.'
      });
    }

    const normalizedAddress = address.toLowerCase();
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    } catch {
      return res.status(401).json({ success: false, error: 'Cryptographic signature verification failed.' });
    }

    if (recoveredAddress !== normalizedAddress) {
      return res.status(401).json({ success: false, error: 'Cryptographic signature verification failed.' });
    }

    const configuredAdminWallet = process.env.ADMIN_WALLET_ADDRESS;
    if (configuredAdminWallet && !ethers.isAddress(configuredAdminWallet)) {
      console.error('[Auth Error] ADMIN_WALLET_ADDRESS is not a valid Ethereum address.');
      return res.status(500).json({ success: false, error: 'Web3 registration is not configured correctly.' });
    }

    const pendingNonce = pendingNonces.get(normalizedAddress);
    const nonceMatch = message.match(/^Nonce:\s*(\S+)\s*$/m);
    if (!nonceMatch || !pendingNonce || pendingNonce.expiresAt < Date.now() ||
        nonceMatch[1] !== pendingNonce.nonce) {
      pendingNonces.delete(normalizedAddress);
      return res.status(401).json({ success: false, error: 'Invalid or expired SIWE nonce.' });
    }
    pendingNonces.delete(normalizedAddress);

    const existingWallet = await User.findOne({ walletAddress: normalizedAddress });
    if (existingWallet) {
      return res.status(409).json({
        success: false,
        error: 'This wallet is already registered. Sign in with the wallet instead.'
      });
    }

    const existingCompany = await findCompany(normalizedCompanyName);
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        error: 'This company name is already registered. Join the existing organization by invitation.'
      });
    }

    const user = await User.create({
      email: `${normalizedAddress}@chainforger.eth`,
      companyName: normalizedCompanyName,
      companyNameKey: normalizedCompanyName.toLowerCase(),
      isOrganizationOwner: true,
      walletAddress: normalizedAddress,
      role: configuredAdminWallet?.toLowerCase() === normalizedAddress ? 'admin' : 'developer'
    });

    const token = generateToken(user);
    return res.status(201).json({
      success: true,
      message: 'Wallet registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        walletAddress: user.walletAddress,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (err) {
    if (isDuplicateCompanyName(err)) {
      return res.status(409).json({
        success: false,
        error: 'This company name is already registered. Join the existing organization by invitation.'
      });
    }
    console.error('[Auth Error] walletRegistration:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.post('/web3-login', web3LoginHandler);
router.post('/verify-siwe', web3LoginHandler);
router.post('/wallet-register', walletRegistrationHandler);

// ==========================================
// Protected Routes
// ==========================================

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        walletAddress: user.walletAddress,
        role: user.role,
        apiKey: user.apiKey,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api-key/rotate', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const newApiKey = user.rotateApiKey();
    await user.save();
    return res.json({ success: true, message: 'API Key rotated successfully', apiKey: newApiKey });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/team', authenticate, async (req, res) => {
  try {
    const team = await User.find({ companyName: req.user.companyName }).select('-nonce');
    return res.json({ success: true, count: team.length, team });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/team/invite', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { email, role = 'developer' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Member email is required.' });
    }
    if (!['developer', 'auditor'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invited members can only be developers or auditors.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const newUser = await User.create({
      email,
      password: tempPassword,
      companyName: req.user.companyName,
      role
    });

    return res.status(201).json({
      success: true,
      message: 'Team member invited successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        companyName: newUser.companyName,
        role: newUser.role,
        tempPassword
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
