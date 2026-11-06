import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr, formatDate } from '../../utils/formatters';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.parent.getChildren();
      const kids = res.children || [];
      setChildren(kids);

      // Fetch recent payments across the first few children
      if (kids.length > 0) {
        try {
          const paymentPromises = kids.map((c) => api.parent.getStudentPayments(c.id));
          const paymentResults = await Promise.all(paymentPromises);
          const allPayments = paymentResults.flatMap((r) => r.payments || []);
          allPayments.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
          setPayments(allPayments.slice(0, 5));
        } catch (_err) {
          // Non-critical if payment history load fails
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ height: '40px', width: '260px' }}>
          <SkeletonLoader type="text" count={2} />
        </div>
        <div className="grid grid-cols-3">
          <SkeletonLoader type="card" count={3} />
        </div>
        <SkeletonLoader type="card" count={2} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboardData} />;
  }

  // Authoritative aggregates computed directly from backend summary fields
  const totalOutstandingPaise = children.reduce((sum, c) => sum + (c.feeSummary?.outstanding || 0), 0);
  const totalPaidPaise = children.reduce((sum, c) => sum + (c.feeSummary?.paid || 0), 0);
  const totalFeesPaise = children.reduce((sum, c) => sum + (c.feeSummary?.total || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Welcome Banner */}
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('dashboard.welcome', 'Welcome back')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {t('dashboard.overview', "Overview of your children's fee schedule, upcoming instalments, and payment receipts.")}
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('dashboard.totalChildren', 'Children Enrolled')}
            </span>
            <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {children.length}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {children.filter((c) => c.status === 'active').length} {t('status.active', 'Active')}
            </span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('dashboard.totalOutstanding', 'Total Outstanding')}
            </span>
            <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: totalOutstandingPaise > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {formatInr(totalOutstandingPaise)}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {totalOutstandingPaise === 0 ? t('status.paid', 'All Clear') : `${formatInr(totalPaidPaise)} paid to date`}
            </span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('student.totalFee', 'Total Fee Enrolled')}
            </span>
            <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
              {formatInr(totalFeesPaise)}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Apex Academy Academic Year 2026–27
            </span>
          </div>
        </Card>
      </div>

      {/* Children Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
            {t('dashboard.myChildren', 'My Children')}
          </h2>
          {children.length > 2 && (
            <Button variant="outline" size="sm" onClick={() => navigate('/parent/children')}>
              {t('dashboard.viewAllChildren', 'View All')}
            </Button>
          )}
        </div>

        {children.length === 0 ? (
          <EmptyState
            title={t('dashboard.noChildren', 'No students linked')}
            description="No student profiles are associated with your registered parent phone number."
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
                  subtitle={`${child.studentId} • ${child.centre?.name || 'Jaipur'}`}
                  headerAction={<Badge status={child.status} />}
                  footer={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {child.batch?.name || 'Standard Batch'}
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {t('student.paidFee', 'Paid to Date')}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                        {formatInr(child.feeSummary?.paid || 0)} / {formatInr(child.feeSummary?.total || 0)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Payments Section */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
          {t('dashboard.recentPayments', 'Recent Payments')}
        </h2>

        {payments.length === 0 ? (
          <Card>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              {t('dashboard.noRecentPayments', 'No payments recorded recently.')}
            </p>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {payments.map((p, idx) => (
                <div
                  key={p._id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-5)',
                    borderBottom: idx === payments.length - 1 ? 'none' : '1px solid var(--color-border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}
                    >
                      ₹
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                        {formatInr(p.amount)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {formatDate(p.receivedAt)} • {p.source === 'gateway' ? t('ledger.sourceGateway', 'Gateway') : t('ledger.sourceManual', 'Cash/Bank')}
                      </div>
                    </div>
                  </div>
                  <Badge status="paid" label={p.status} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
