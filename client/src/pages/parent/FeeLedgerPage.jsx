import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr, formatDate } from '../../utils/formatters';

export function FeeLedgerPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [ledgerData, setLedgerData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment Link Modal state
  const [selectedInstalment, setSelectedInstalment] = useState(null);
  const [paymentLink, setPaymentLink] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ledgerRes, paymentsRes] = await Promise.all([
        api.parent.getStudentLedger(studentId),
        api.parent.getStudentPayments(studentId)
      ]);
      setLedgerData(ledgerRes);
      setPayments(paymentsRes.payments || []);
    } catch (err) {
      setError(err.message || 'Unable to retrieve fee ledger');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleOpenPaymentModal = async (instalment) => {
    setSelectedInstalment(instalment);
    setPaymentLink(null);
    setPaymentError(null);
    setGeneratingLink(true);

    try {
      const res = await api.parent.createPaymentLink(instalment.id);
      if (res?.paymentLink) {
        setPaymentLink(res.paymentLink);
      } else {
        throw new Error('Failed to obtain payment link from gateway');
      }
    } catch (err) {
      setPaymentError(err.message || 'Error generating secure payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (paymentLink?.url) {
      navigator.clipboard.writeText(paymentLink.url);
      addToast(t('payment.linkCopied', 'Payment link copied to clipboard!'), 'success');
    }
  };

  const handleClosePaymentModal = () => {
    setSelectedInstalment(null);
    setPaymentLink(null);
    setPaymentError(null);
    // Refresh ledger to pick up any webhook-confirmed payment
    fetchLedger();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SkeletonLoader type="text" count={2} />
        <div className="grid grid-cols-3">
          <SkeletonLoader type="card" count={3} />
        </div>
        <SkeletonLoader type="row" count={4} height="52px" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchLedger} />;
  }

  const student = ledgerData?.student;
  const summary = ledgerData?.summary;
  const instalments = ledgerData?.instalments || [];

  const columns = [
    {
      header: t('ledger.instalmentNumber', 'Instalment #'),
      key: 'seq',
      render: (row) => <strong>#{row.seq}</strong>
    },
    {
      header: t('ledger.dueDate', 'Due Date'),
      key: 'dueDate',
      render: (row) => formatDate(row.dueDate)
    },
    {
      header: t('ledger.amount', 'Instalment Amount'),
      key: 'amount',
      render: (row) => formatInr(row.amount)
    },
    {
      header: t('ledger.paid', 'Paid'),
      key: 'paid',
      render: (row) => (
        <span style={{ color: row.paid > 0 ? 'var(--color-success)' : 'inherit' }}>
          {formatInr(row.paid || 0)}
        </span>
      )
    },
    {
      header: t('ledger.balance', 'Balance Due'),
      key: 'outstanding',
      render: (row) => (
        <strong style={{ color: row.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
          {formatInr(row.outstanding)}
        </strong>
      )
    },
    {
      header: t('ledger.status', 'Status'),
      key: 'status',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
          <Badge status={row.status} />
          {row.daysOverdue > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' }}>
              {t('ledger.daysOverdue', { days: row.daysOverdue })}
            </span>
          )}
        </div>
      )
    },
    {
      header: t('ledger.action', 'Action'),
      key: 'action',
      render: (row) => {
        if (row.outstanding > 0) {
          return (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenPaymentModal(row)}
            >
              {t('ledger.payNow', 'Pay Now')}
            </Button>
          );
        }
        return (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            ✓ {t('ledger.fullyPaid', 'Fully Paid')}
          </span>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Title & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <button
              type="button"
              onClick={() => navigate('/parent/children')}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
            >
              ← {t('nav.children', 'My Children')}
            </button>
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{student?.name}</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {student?.name} — {t('ledger.title', 'Fee Ledger')}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            ID: {student?.studentId} • Centre: {student?.centre?.name || 'Jaipur Central'} • Batch: {student?.batch?.name || 'Standard'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('student.totalFee', 'Total Course Fee')}
            </span>
            <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
              {formatInr(summary?.total || 0)}
            </span>
            {ledgerData?.feePlan?.discount > 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
                Discount applied: {formatInr(ledgerData.feePlan.discount)}
              </span>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('student.paidFee', 'Total Paid to Date')}
            </span>
            <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {formatInr(summary?.paid || 0)}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Verified via accounts & gateway
            </span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('student.outstanding', 'Remaining Balance')}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: (summary?.outstanding || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'
              }}
            >
              {formatInr(summary?.outstanding || 0)}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {(summary?.outstanding || 0) === 0 ? 'Fee obligations cleared' : 'Payable by scheduled due dates'}
            </span>
          </div>
        </Card>
      </div>

      {/* Instalments Schedule Table */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
          {t('ledger.title', 'Fee Instalment Schedule')}
        </h2>
        {instalments.length === 0 ? (
          <EmptyState
            title={t('ledger.noInstalments', 'No fee instalments found')}
            description="No fee plan is assigned to this student."
          />
        ) : (
          <ResponsiveTable
            columns={columns}
            data={instalments}
            keyField="id"
          />
        )}
      </div>

      {/* Payment History Section */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
          {t('ledger.paymentHistory', 'Payment History')}
        </h2>
        {payments.length === 0 ? (
          <Card>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              {t('ledger.noPayments', 'No payment transactions recorded yet.')}
            </p>
          </Card>
        ) : (
          <ResponsiveTable
            columns={[
              {
                header: t('ledger.receivedAt', 'Received Date'),
                key: 'receivedAt',
                render: (row) => formatDate(row.receivedAt)
              },
              {
                header: t('ledger.amount', 'Amount'),
                key: 'amount',
                render: (row) => <strong>{formatInr(row.amount)}</strong>
              },
              {
                header: t('ledger.paymentMethod', 'Method'),
                key: 'source',
                render: (row) => (
                  <span>
                    {row.source === 'gateway' ? t('ledger.sourceGateway', 'Online Gateway') : t('ledger.sourceManual', 'Centre Cash/Bank')}
                  </span>
                )
              },
              {
                header: t('ledger.reference', 'Reference / UTR'),
                key: 'gatewayRef',
                render: (row) => (
                  <code style={{ fontSize: '11px', backgroundColor: 'var(--color-surface-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                    {row.gatewayRef || 'MANUAL-REF'}
                  </code>
                )
              },
              {
                header: t('ledger.status', 'Status'),
                key: 'status',
                render: (row) => <Badge status="paid" label={row.status} />
              }
            ]}
            data={payments}
            keyField="_id"
          />
        )}
      </div>

      {/* Payment Initiation Modal */}
      <Modal
        isOpen={Boolean(selectedInstalment)}
        onClose={handleClosePaymentModal}
        title={t('payment.modalTitle', 'Initiate Fee Payment')}
        subtitle={t('payment.modalSubtitle', { seq: selectedInstalment?.seq })}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={handleClosePaymentModal}>
              {t('payment.close', 'Close')}
            </Button>
            {paymentLink?.url && (
              <Button variant="outline" onClick={handleCopyLink}>
                {t('payment.copyLink', 'Copy Payment Link')}
              </Button>
            )}
            {paymentLink?.url && (
              <a
                href={paymentLink.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button variant="primary">
                  {t('payment.payViaGateway', 'Proceed to Gateway')} →
                </Button>
              </a>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {generatingLink ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <SkeletonLoader type="text" count={3} />
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
                {t('payment.generatingLink', 'Connecting to secure gateway...')}
              </p>
            </div>
          ) : paymentError ? (
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
              {paymentError}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{t('payment.studentName', 'Student')}:</span>
                  <strong>{student?.name} ({student?.studentId})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{t('ledger.instalmentNumber', 'Instalment')}:</span>
                  <span>Instalment #{selectedInstalment?.seq}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-base)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{t('payment.amountToPay', 'Payable Amount')}:</span>
                  <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-xl)' }}>
                    {formatInr(selectedInstalment?.outstanding || 0)}
                  </strong>
                </div>
              </div>

              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {t('payment.gatewayNotice', 'Payments are processed securely via our verified payment gateway. Once completed, your fee ledger and GST receipt will update automatically via gateway webhooks.')}
              </p>

              {paymentLink && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-info)' }}>
                  <strong>Gateway Link Ready:</strong> {paymentLink.url}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
