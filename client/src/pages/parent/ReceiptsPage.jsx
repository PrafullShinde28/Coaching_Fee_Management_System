import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr, formatDate } from '../../utils/formatters';

export function ReceiptsPage() {
  const { t } = useTranslation();

  const [receipts, setReceipts] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const kidsRes = await api.parent.getChildren();
      const kids = kidsRes.children || [];
      setChildren(kids);

      if (kids.length > 0) {
        const receiptPromises = kids.map((c) =>
          api.parent.getStudentReceipts(c.id).then((res) =>
            (res.receipts || []).map((r) => ({
              ...r,
              studentName: c.name,
              studentCode: c.studentId
            }))
          )
        );
        const results = await Promise.all(receiptPromises);
        const combined = results.flat();
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setReceipts(combined);
      } else {
        setReceipts([]);
      }
    } catch (err) {
      setError(err.message || 'Unable to load GST receipts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SkeletonLoader type="text" count={2} />
        <SkeletonLoader type="row" count={4} height="52px" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchReceipts} />;
  }

  const columns = [
    {
      header: t('receipts.receiptNumber', 'Receipt Number'),
      key: 'number',
      render: (row) => (
        <code style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
          {row.number}
        </code>
      )
    },
    {
      header: t('receipts.student', 'Student'),
      key: 'studentName',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{row.studentName}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.studentCode}</div>
        </div>
      )
    },
    {
      header: t('receipts.date', 'Issue Date'),
      key: 'createdAt',
      render: (row) => formatDate(row.createdAt)
    },
    {
      header: t('receipts.baseAmount', 'Base Amount'),
      key: 'base',
      render: (row) => formatInr(row.base)
    },
    {
      header: t('receipts.gstAmount', 'GST (18%)'),
      key: 'gst',
      render: (row) => formatInr(row.gst)
    },
    {
      header: t('receipts.totalAmount', 'Total Paid'),
      key: 'total',
      render: (row) => <strong>{formatInr(row.total)}</strong>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(row)}>
          {t('receipts.viewDetails', 'View Receipt')}
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('receipts.title', 'GST Receipts')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {t('receipts.subtitle', 'Official tax receipts issued for coaching tuition fee payments.')}
        </p>
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          title={t('receipts.noReceipts', 'No GST receipts issued')}
          description="Receipts will be generated automatically as payments are confirmed for your children."
          icon="🧾"
        />
      ) : (
        <ResponsiveTable
          columns={columns}
          data={receipts}
          keyField="_id"
        />
      )}

      {/* Official Notice */}
      <Card style={{ backgroundColor: 'var(--color-surface-subtle)', borderStyle: 'dashed' }}>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
          ℹ️ {t('receipts.noticePdf', 'Receipt data is verified on the database. Official printed copies with authorized seal can also be obtained from the institute accounts desk.')}
        </p>
      </Card>

      {/* View Receipt Details Modal */}
      <Modal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title={`Receipt ${selectedReceipt?.number}`}
        subtitle={`Issued on ${formatDate(selectedReceipt?.createdAt)}`}
        footer={
          <Button variant="primary" onClick={() => setSelectedReceipt(null)}>
            {t('common.back', 'Close')}
          </Button>
        }
      >
        {selectedReceipt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Issued To</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>{selectedReceipt.studentName}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Student ID: {selectedReceipt.studentCode}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Institute</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Apex Academy Jaipur</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>GSTIN: 08AAACA1234A1Z5</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', backgroundColor: 'var(--color-surface-subtle)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span>Coaching Tuition Fee (Base)</span>
                <span>{formatInr(selectedReceipt.base)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span>CGST (9%)</span>
                <span>{formatInr(Math.round(selectedReceipt.gst / 2))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span>SGST (9%)</span>
                <span>{formatInr(selectedReceipt.gst - Math.round(selectedReceipt.gst / 2))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <span>Total Tax Invoice Amount</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatInr(selectedReceipt.total)}</span>
              </div>
            </div>

            {selectedReceipt.paymentId && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Payment Ref: <code>{selectedReceipt.paymentId.gatewayRef || selectedReceipt.paymentId._id}</code>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
