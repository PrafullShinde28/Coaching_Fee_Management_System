import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr } from '../../utils/formatters';

export function ChildrenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.parent.getChildren();
      setChildren(res.children || []);
    } catch (err) {
      setError(err.message || 'Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ height: '32px', width: '220px' }}>
          <SkeletonLoader type="text" count={2} />
        </div>
        <div className="grid grid-cols-2">
          <SkeletonLoader type="card" count={2} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchChildren} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('student.allChildren', 'Enrolled Children')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          Select a child to view their complete academic fee plan, instalments, and receipts.
        </p>
      </div>

      {children.length === 0 ? (
        <EmptyState
          title={t('dashboard.noChildren', 'No students linked')}
          description="No students are currently linked to your parent account."
        />
      ) : (
        <div className="grid grid-cols-2">
          {children.map((child) => {
            const outstanding = child.feeSummary?.outstanding || 0;
            const hasOutstanding = outstanding > 0;
            const feeStatus = hasOutstanding ? (child.feeSummary?.paid > 0 ? 'part_paid' : 'due_soon') : 'paid';

            return (
              <Card
                key={child.id}
                title={child.name}
                subtitle={`${child.studentId} • Centre: ${child.centre?.name || 'Jaipur'}`}
                headerAction={<Badge status={child.status} />}
                footer={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      Batch: {child.batch?.name || 'Standard Batch'}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/parent/children/${child.id}/fees`)}
                    >
                      {t('student.viewFees', 'View Fee Ledger')} →
                    </Button>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {t('student.feeStatus', 'Fee Status')}
                    </span>
                    <Badge status={feeStatus} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {t('student.totalFee', 'Total Fee')}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                      {formatInr(child.feeSummary?.total || 0)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {t('student.paidFee', 'Paid to Date')}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-success)' }}>
                      {formatInr(child.feeSummary?.paid || 0)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                      {t('student.outstanding', 'Outstanding Balance')}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: hasOutstanding ? 'var(--color-danger)' : 'var(--color-success)'
                      }}
                    >
                      {formatInr(outstanding)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
