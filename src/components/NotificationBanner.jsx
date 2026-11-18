import React from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Ban,
  Info,
  X
} from 'lucide-react';
import './NotificationBanner.css';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    colorClass: 'nb-success'
  },
  error: {
    icon: AlertCircle,
    colorClass: 'nb-error'
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'nb-warning'
  },
  danger: {
    icon: Ban,
    colorClass: 'nb-danger'
  },
  info: {
    icon: Info,
    colorClass: 'nb-info'
  }
};

export default function NotificationBanner({
  type = 'info',
  title,
  message,
  children,
  onClose,
  icon: CustomIcon,
  className = ''
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const IconComponent = CustomIcon || config.icon;

  return (
    <div className={`notification-banner ${config.colorClass} ${className}`} role="alert">
      <div className="nb-icon-wrapper">
        <IconComponent size={20} className="nb-icon shrink-0" />
      </div>

      <div className="nb-content">
        {title && <h4 className="nb-title">{title}</h4>}
        <div className="nb-message">
          {message}
          {children}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="nb-close-btn"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
