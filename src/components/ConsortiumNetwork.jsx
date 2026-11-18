import React from 'react';
import { Network } from 'lucide-react';
import './ConsortiumNetwork.css';

export default function ConsortiumNetwork({ formData, setFormData }) {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="template-customizer-box consortium-customizer-box">
      <div className="template-badge consortium-badge">
        <Network size={14} /> CONSORTIUM HYBRID CUSTOMIZER
      </div>

      <div className="form-two-col mt-4">
        <div className="config-input-group">
          <label className="config-input-label">Hybrid Composition Mode</label>
          <select
            className="config-input-field"
            value={formData.hybridMode}
            onChange={(e) => updateField('hybridMode', e.target.value)}
          >
            <option value="bridge">Public Relay + Private Ring Bridge</option>
            <option value="relay">Federated Consortium Gateway</option>
            <option value="dual">Dual Layer Execution & Settlement</option>
          </select>
        </div>

        <div className="config-input-group">
          <label className="config-input-label">Quorum Threshold (%)</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.quorumPercentage}
            onChange={(e) => updateField('quorumPercentage', e.target.value)}
            min="51"
            max="100"
            required
          />
        </div>
      </div>

      <div className="form-two-col mt-4">
        <div className="config-input-group">
          <label className="config-input-label">Validator Signer Pool Size</label>
          <input
            type="number"
            className="config-input-field"
            value={formData.validatorSignerCount}
            onChange={(e) => updateField('validatorSignerCount', e.target.value)}
            min="2"
            max="16"
            required
          />
        </div>

        <div className="token-toggle-row">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={formData.crossModulePermissions}
              onChange={(e) => updateField('crossModulePermissions', e.target.checked)}
            />
            <span className="checkbox-label">Cross-Module Smart Contract Interoperability</span>
          </label>
        </div>
      </div>
    </div>
  );
}
