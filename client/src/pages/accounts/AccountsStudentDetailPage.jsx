import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Badge } from '../../components/common/Badge';
import { formatInr, formatDate, formatPhone } from '../../utils/formatters';

export function AccountsStudentDetailPage() {
  const { studentId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.accounts.getStudentLedger(studentId);
      setLedgerData(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load student fee ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [studentId]);

  if (loading) {
    return <LoadingSpinner text={t('accountsStudentDetail.loading', 'Loading student fee ledger...')} />;
  }

  if (error || !ledgerData) {
    return <ErrorState message={error || 'Student not found'} onRetry={fetchLedger} />;
  }

  const { student, feePlan, instalments = [], payments = [], receipts = [], summary = {} } = ledgerData;

  const instalmentColumns = [
    { key: 'seq', header: t('accountsStudentDetail.instNo', 'Instalment'), align: 'center', render: (r) => `#${r.seq || r.instalmentNumber}` },
    { key: 'dueDate', header: t('accountsStudentDetail.dueDate', 'Due Date'), render: (r) => formatDate(r.dueDate) },
    { key: 'amount', header: t('accountsStudentDetail.amount', 'Amount'), align: 'right', render: (r) => formatInr(r.amount ?? r.amountPaise ?? 0) },
    { key: 'paid', header: t('accountsStudentDetail.paid', 'Paid'), align: 'right', render: (r) => (
      <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>{formatInr(r.paid ?? r.paidPaise ?? 0)}</span>
    )},
    { key: 'outstanding', header: t('accountsStudentDetail.balance', 'Balance'), align: 'right', render: (r) => (
      <span style={{ fontWeight: 'bold' }}>{formatInr(r.outstanding ?? r.remainingPaise ?? 0)}</span>
    )},
    { key: 'status', header: t('accountsStudentDetail.status', 'Status'), align: 'center', render: (r) => <Badge status={r.status} /> }
  ];

  const paymentColumns = [
    { key: 'gatewayRef', header: t('accountsStudentDetail.ref', 'Reference / UTR'), render: (r) => <strong>{r.gatewayRef || r._id}</strong> },
    { key: 'amount', header: t('accountsStudentDetail.amount', 'Amount'), align: 'right', render: (r) => (
      <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{formatInr(r.amount ?? r.amountPaise ?? 0)}</span>
    )},
    { key: 'source', header: t('accountsStudentDetail.method', 'Mode'), render: (r) => (
      <span style={{ textTransform: 'uppercase', fontSize: '11px', background: 'var(--color-surface-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
        {r.source || 'online'}
      </span>
    )},
    { key: 'receivedAt', header: t('accountsStudentDetail.paidOn', 'Paid Date'), render: (r) => formatDate(r.receivedAt || r.paidAt) }
  ];

  const receiptColumns = [
    { key: 'number', header: t('accountsStudentDetail.receiptNo', 'Receipt #'), render: (r) => <strong>{r.number || r.receiptNumber}</strong> },
    { key: 'createdAt', header: t('accountsStudentDetail.issuedOn', 'Issued On'), render: (r) => formatDate(r.createdAt || r.issuedAt) },
    { key: 'baseAmountPaise', header: t('accountsStudentDetail.taxable', 'Taxable'), align: 'right', render: (r) => formatInr(r.baseAmountPaise || r.taxablePaise || 0) },
    { key: 'cgstPaise', header: 'CGST (9%)', align: 'right', render: (r) => formatInr(r.cgstPaise || 0) },
    { key: 'sgstPaise', header: 'SGST (9%)', align: 'right', render: (r) => formatInr(r.sgstPaise || 0) },
    { key: 'totalPaise', header: t('accountsStudentDetail.total', 'Total (INR)'), align: 'right', render: (r) => (
      <span style={{ fontWeight: 'bold' }}>{formatInr(r.totalPaise || 0)}</span>
    )}
  ];

  const overdueInstalments = instalments.filter((i) => i.status === 'overdue');
  const totalOverdue = overdueInstalments.reduce((sum, i) => sum + (i.outstanding || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <Link to="/accounts/students" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            ← {t('accountsStudentDetail.backToStudents', 'Back to Students List')}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
              {student.name}
            </h1>
            <Badge status={student.status || 'active'} />
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Roll No: <strong>{student.rollNumber || student.studentId || 'N/A'}</strong> • Centre: {student.centreId?.name || student.centre?.name} • Batch: {student.batchId?.name || student.batch?.name} • Phone: {formatPhone(student.phone || student.parentUserId?.phone)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {student.status === 'left' && (
            <button
              type="button"
              onClick={() => navigate(`/accounts/refunds?studentId=${student.id || student._id}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer'
              }}
            >
              <span>↩️</span>
              <span>{t('accountsStudentDetail.calculateRefund', 'Process Refund')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(`/accounts/collections?studentId=${student.id || student._id}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            <span>💳</span>
            <span>{t('accountsStudentDetail.recordPayment', 'Record Payment')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4">
        <Card style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('accountsStudentDetail.netFee', 'Net Fee')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginTop: 'var(--space-1)' }}>
            {formatInr(summary.total || feePlan?.total || 0)}
          </div>
          {feePlan?.discount > 0 && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Incl. {formatInr(feePlan.discount)} discount
            </div>
          )}
        </Card>

        <Card style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('accountsStudentDetail.totalPaid', 'Total Paid')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>
            {formatInr(summary.paid || 0)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {payments.length} payment(s) recorded
          </div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('accountsStudentDetail.remaining', 'Remaining Balance')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-warning)', marginTop: 'var(--space-1)' }}>
            {formatInr(summary.outstanding || 0)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {instalments.filter((i) => (i.outstanding || 0) > 0).length} unpaid instalment(s)
          </div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('accountsStudentDetail.overdue', 'Overdue Amount')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: totalOverdue > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {formatInr(totalOverdue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: totalOverdue > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: '2px' }}>
            {totalOverdue > 0 ? `${overdueInstalments.length} overdue instalment(s)` : 'No overdue instalments'}
          </div>
        </Card>
      </div>

      <Card
        title={t('accountsStudentDetail.scheduleTitle', 'Fee Instalments Schedule')}
        subtitle={t('accountsStudentDetail.scheduleSubtitle', 'Breakdown of scheduled fee instalments and authoritative balances')}
      >
        <ResponsiveTable
          columns={instalmentColumns}
          data={instalments}
          keyField="id"
          emptyMessage={t('accountsStudentDetail.noInstalments', 'No instalments found for this student')}
        />
      </Card>

      <div className="grid grid-cols-2">
        <Card
          title={t('accountsStudentDetail.paymentHistory', 'Payment Transactions')}
          subtitle={t('accountsStudentDetail.paymentSubtitle', 'Log of received offline and online payments')}
        >
          <ResponsiveTable
            columns={paymentColumns}
            data={payments}
            keyField="_id"
            emptyMessage={t('accountsStudentDetail.noPayments', 'No payments recorded yet')}
          />
        </Card>

        <Card
          title={t('accountsStudentDetail.gstReceipts', 'GST Tax Invoices')}
          subtitle={t('accountsStudentDetail.receiptsSubtitle', 'Sequential 18% GST receipts issued')}
        >
          <ResponsiveTable
            columns={receiptColumns}
            data={receipts}
            keyField="_id"
            emptyMessage={t('accountsStudentDetail.noReceipts', 'No tax receipts issued yet')}
          />
        </Card>
      </div>
    </div>
  );
}
