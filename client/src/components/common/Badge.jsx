import React from 'react';
import { useTranslation } from 'react-i18next';

export function Badge({
  status = 'upcoming',
  label,
  size = 'md',
  className = '',
  style = {}
}) {
  const { t } = useTranslation();

  const normalizedStatus = String(status).toLowerCase().replace(/[-\s]/g, '_');

  const statusConfigs = {
    paid: {
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      defaultLabel: t('status.paid', 'Paid'),
      symbol: '✓'
    },
    part_paid: {
      color: 'var(--color-part-paid)',
      bg: 'var(--color-part-paid-bg)',
      border: 'var(--color-part-paid-border)',
      defaultLabel: t('status.part_paid', 'Part Paid'),
      symbol: '◑'
    },
    due_soon: {
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
      border: 'var(--color-warning-border)',
      defaultLabel: t('status.due_soon', 'Due Soon'),
      symbol: '⏱'
    },
    overdue: {
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-bg)',
      border: 'var(--color-danger-border)',
      defaultLabel: t('status.overdue', 'Overdue'),
      symbol: '!'
    },
    upcoming: {
      color: 'var(--color-info)',
      bg: 'var(--color-info-bg)',
      border: 'var(--color-info-border)',
      defaultLabel: t('status.upcoming', 'Upcoming'),
      symbol: '•'
    },
    active: {
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      defaultLabel: t('status.active', 'Active'),
      symbol: '●'
    },
    left: {
      color: 'var(--color-text-muted)',
      bg: 'var(--color-surface-subtle)',
      border: 'var(--color-border)',
      defaultLabel: t('status.left', 'Left'),
      symbol: '○'
    }
  };

  const config = statusConfigs[normalizedStatus] || statusConfigs.upcoming;
  const displayText = label || config.defaultLabel;

  const sizeStyles = {
    sm: {
      padding: '2px var(--space-2)',
      fontSize: 'var(--font-size-xs)',
      gap: '4px'
    },
    md: {
      padding: 'var(--space-1) var(--space-3)',
      fontSize: 'var(--font-size-xs)',
      gap: '6px'
    }
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 'var(--font-weight-medium)',
    borderRadius: 'var(--radius-full)',
    color: config.color,
    backgroundColor: config.bg,
    border: `1px solid ${config.border}`,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...style
  };

  return (
    <span style={badgeStyle} className={`badge badge-${normalizedStatus} ${className}`}>
      <span aria-hidden="true" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
        {config.symbol}
      </span>
      <span>{displayText}</span>
    </span>
  );
}
