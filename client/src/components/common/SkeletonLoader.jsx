import React from 'react';

export function SkeletonLoader({
  type = 'card',
  count = 1,
  height,
  width = '100%',
  className = ''
}) {
  const shimmerStyle = {
    backgroundColor: 'var(--color-surface-subtle)',
    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-md)'
  };

  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-4)', width: '100%' }}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)'
            }}
          >
            <div style={{ ...shimmerStyle, height: '24px', width: '40%' }} />
            <div style={{ ...shimmerStyle, height: '16px', width: '70%' }} />
            <div style={{ ...shimmerStyle, height: '36px', width: '30%', marginTop: 'var(--space-2)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'row') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyle,
              height: height || '48px',
              width,
              borderRadius: 'var(--radius-md)'
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            ...shimmerStyle,
            height: height || '16px',
            width: width || (i === count - 1 ? '60%' : '100%')
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
