import React from 'react';
import { Globe, Coins, Layers, Sliders } from 'lucide-react';
import './PublicNetwork.css';

export default function PublicNetwork({ formData, setFormData }) {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="template-customizer-box public-customizer-box">
      <div className="template-badge public-badge">
        <Globe size={14} /> PUBLIC NETWORK CUSTOMIZER
      </div>

      <div className="form-two-col mt-4">
        <div className="config-input-group">
          <label className="config-input-label">Consensus Mechanism</label>
          <select
            className="config-input-field"
            value={formData.consensus}
            onChange={(e) => updateField('consensus', e.target.value)}
          >
            <option value="clique">Proof-of-Authority (Geth Clique PoA)</option>
            <option value="pos">Proof-of-Stake (Simulated Beacon/PoS)</option>
            <option value="ibft">Istanbul Byzantine Fault Tolerance (IBFT 2.0)</option>
          </select>
        </div>

        <div className="config-input-group">
          <label className="config-input-label">Block Time (Seconds, 0 = Instant Tx)</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.blockTime}
            onChange={(e) => updateField('blockTime', e.target.value)}
            min="0"
            max="30"
            required
          />
        </div>
      </div>

      {/* Native Gas Asset & Faucet */}
      <h4 className="config-sub-title mt-4">
        <Coins size={16} className="text-[#39ff14]" /> Native Currency & Faucet Allocation
      </h4>
      <div className="form-three-col">
        <div className="config-input-group">
          <label className="config-input-label">Native Currency Name</label>
          <input
            type="text"
            className="config-input-field"
            value={formData.nativeName}
            onChange={(e) => updateField('nativeName', e.target.value)}
            required
          />
        </div>

        <div className="config-input-group">
          <label className="config-input-label">Native Currency Ticker</label>
          <input
            type="text"
            className="config-input-field"
            value={formData.nativeSymbol}
            onChange={(e) => updateField('nativeSymbol', e.target.value)}
            required
          />
        </div>

        <div className="config-input-group">
          <label className="config-input-label">Initial Faucet Allocation (Per Account)</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.faucetInitialFunding}
            onChange={(e) => updateField('faucetInitialFunding', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Dual-Token Layer */}
      <h4 className="config-sub-title mt-4">
        <Layers size={16} className="text-[#39ff14]" /> Dual-Token Architecture (FT & NFT Layer)
      </h4>

      {/* FT Settings */}
      <div className="token-toggle-row">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={formData.enableFT}
            onChange={(e) => updateField('enableFT', e.target.checked)}
          />
          <span className="checkbox-label">Deploy Fungible Governance/Utility Token (ERC-20)</span>
        </label>
      </div>

      {formData.enableFT && (
        <div className="form-two-col sub-panel">
          <div className="config-input-group">
            <label className="config-input-label">Token Name</label>
            <input
              type="text"
              className="config-input-field"
              value={formData.tokenName}
              onChange={(e) => updateField('tokenName', e.target.value)}
              required
            />
          </div>
          <div className="config-input-group">
            <label className="config-input-label">Token Symbol</label>
            <input
              type="text"
              className="config-input-field"
              value={formData.tokenSymbol}
              onChange={(e) => updateField('tokenSymbol', e.target.value)}
              required
            />
          </div>
          <div className="config-input-group">
            <label className="config-input-label">Initial Supply</label>
            <input
              type="number"
              className="config-input-field"
              value={formData.initialSupply}
              onChange={(e) => updateField('initialSupply', e.target.value)}
              required
            />
          </div>
          <div className="config-input-group">
            <label className="config-input-label">Decimals</label>
            <input
              type="number"
              className="config-input-field"
              value={formData.tokenDecimals}
              onChange={(e) => updateField('tokenDecimals', e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* NFT Settings */}
      <div className="token-toggle-row mt-3">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={formData.enableNFT}
            onChange={(e) => updateField('enableNFT', e.target.checked)}
          />
          <span className="checkbox-label">Deploy Non-Fungible Asset Suite (ERC-721 Collection)</span>
        </label>
      </div>

      {formData.enableNFT && (
        <div className="form-two-col sub-panel">
          <div className="config-input-group">
            <label className="config-input-label">NFT Collection Name</label>
            <input
              type="text"
              className="config-input-field"
              value={formData.nftName}
              onChange={(e) => updateField('nftName', e.target.value)}
              required
            />
          </div>
          <div className="config-input-group">
            <label className="config-input-label">NFT Symbol</label>
            <input
              type="text"
              className="config-input-field"
              value={formData.nftSymbol}
              onChange={(e) => updateField('nftSymbol', e.target.value)}
              required
            />
          </div>
          <div className="config-input-group">
            <label className="config-input-label">NFT Minting & Scarcity Policy</label>
            <select
              className="config-input-field"
              value={formData.nftPolicy}
              onChange={(e) => updateField('nftPolicy', e.target.value)}
            >
              <option value="STRICT_UNIQUE">Unique 1-of-1 Assets (Digital Twins, Deeds)</option>
              <option value="MULTI_MINT_SERIES">Multi-Mint Series Editions (Series Passes)</option>
            </select>
          </div>
          <div className="config-input-group">
            <label className="config-input-label">Max Collection Supply (0 = Unlimited)</label>
            <input
              type="number"
              className="config-input-field"
              value={formData.nftMaxSupply}
              onChange={(e) => updateField('nftMaxSupply', e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* Gas Metrics */}
      <h4 className="config-sub-title mt-4">
        <Sliders size={16} className="text-[#39ff14]" /> Gas Economics & Block Parameters
      </h4>
      <div className="form-two-col">
        <div className="config-input-group">
          <label className="config-input-label">Block Gas Limit</label>
          <input
            type="text"
            className="config-input-field"
            value={formData.blockGasLimit}
            onChange={(e) => updateField('blockGasLimit', e.target.value)}
            required
          />
        </div>
        <div className="config-input-group">
          <label className="config-input-label">Base Fee (Gwei)</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.baseFee}
            onChange={(e) => updateField('baseFee', e.target.value)}
            required
          />
        </div>
      </div>
    </div>
  );
}
