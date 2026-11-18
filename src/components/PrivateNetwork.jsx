import React from 'react';
import { Lock } from 'lucide-react';
import './PrivateNetwork.css';

export default function PrivateNetwork({ formData, setFormData }) {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="template-customizer-box private-customizer-box">
      <div className="template-badge private-badge">
        <Lock size={14} /> PRIVATE ENTERPRISE CUSTOMIZER
      </div>

      <div className="form-two-col mt-4">
        <div className="config-input-group">
          <label className="config-input-label">Participant Scaling (Company/Node Count)</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.participantCount}
            onChange={(e) => updateField('participantCount', e.target.value)}
            min="1"
            max="20"
            required
          />
        </div>

        <div className="config-input-group">
          <label className="config-input-label">Consensus Engine</label>
          <select
            className="config-input-field"
            value={formData.consensus}
            onChange={(e) => updateField('consensus', e.target.value)}
          >
            <option value="ibft">Istanbul BFT (Instant Finality, Enterprise Strict)</option>
            <option value="clique">Private Clique PoA</option>
          </select>
        </div>
      </div>

      <div className="form-two-col mt-4">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={formData.zeroGasMode}
            onChange={(e) => updateField('zeroGasMode', e.target.checked)}
          />
          <span className="checkbox-label">Zero-Gas Mode (Free Internal Transactions)</span>
        </label>

        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={formData.privateStateEncryption}
            onChange={(e) => updateField('privateStateEncryption', e.target.checked)}
          />
          <span className="checkbox-label">Private Enclave State Isolation</span>
        </label>
      </div>
    </div>
  );
}
