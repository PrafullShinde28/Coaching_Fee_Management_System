import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { toast } from '../../components/common/Toast';
import { formatInr, formatDate } from '../../utils/formatters';

export function AccountsReportsPage() {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState('centre_collections');
  const [centreId, setCentreId] = useState('');
  const [centres, setCentres] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.accounts.getCentres()
      .then((res) => {
        const list = res.centres || res.data || (Array.isArray(res) ? res : []);
        setCentres(list);
      })
      .catch((e) => console.error(e));
  }, []);

  const fetchReportPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      if (reportType === 'centre_collections') {
        const res = await api.accounts.getDashboard(centreId ? { centreId } : {});
        setReportData(res.centreSummaries || []);
      } else if (reportType === 'batch_collections') {
        const res = await api.accounts.getDashboard(centreId ? { centreId } : {});
        setReportData(res.batchSummaries || []);
      } else if (reportType === 'outstanding_fees') {
        const res = await api.accounts.getStudents(centreId ? { centreId } : {});
        const list = res.students || res.data || (Array.isArray(res) ? res : []);
        setReportData(list.filter((s) => (s.feeSummary?.outstanding || s.feeSummary?.balancePaise || 0) > 0));
      } else if (reportType === 'payment_history') {
        const res = await api.accounts.getDashboard();
        setReportData(res.recentPayments || []);
      } else if (reportType === 'unmatched') {
        const res = await api.accounts.getUnmatchedPayments();
        setReportData(res.unmatchedPayments || res.data || (Array.isArray(res) ? res : []));
      } else if (reportType === 'refunds') {
        const res = await api.accounts.getRefunds();
        setReportData(res.refunds || res.data || (Array.isArray(res) ? res : []));
      }
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportPreview();
  }, [reportType, centreId]);

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      const params = { type: reportType };
      if (centreId) params.centreId = centreId;
      const blob = await api.accounts.exportReportCsv(params);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feetrack_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Sanitized CSV report downloaded successfully!');
    } catch (err) {
      toast.error(err.message || 'CSV download failed');
    } finally {
      setDownloading(false);
    }
  };

  const getColumns = () => {
    if (reportType === 'centre_collections') {
      return [
        { key: 'name', header: 'Centre Name', render: (r) => <strong>{r.name}</strong> },
        { key: 'code', header: 'Code' },
        { key: 'city', header: 'City' },
        { key: 'totalStudents', header: 'Students', align: 'center', render: (r) => r.totalStudents ?? r.studentsCount ?? 0 },
        { key: 'totalScheduled', header: 'Target (INR)', align: 'right', render: (r) => formatInr(r.totalScheduled ?? r.totalExpectedPaise ?? 0) },
        { key: 'totalCollected', header: 'Collected (INR)', align: 'right', render: (r) => formatInr(r.totalCollected ?? r.totalCollectedPaise ?? 0) },
        { key: 'outstanding', header: 'Outstanding (INR)', align: 'right', render: (r) => formatInr(r.outstanding ?? r.totalOutstandingPaise ?? 0) },
        { key: 'collectionPct', header: 'Collection %', align: 'center', render: (r) => `${r.collectionPct ?? r.collectionPercentage ?? 0}%` }
      ];
    }
    if (reportType === 'batch_collections') {
      return [
        { key: 'name', header: 'Batch' },
        { key: 'centreName', header: 'Centre' },
        { key: 'studentCount', header: 'Students', align: 'center', render: (r) => r.studentCount ?? r.studentsCount ?? 0 },
        { key: 'totalScheduled', header: 'Expected (INR)', align: 'right', render: (r) => formatInr(r.totalScheduled ?? r.totalExpectedPaise ?? 0) },
        { key: 'totalCollected', header: 'Collected (INR)', align: 'right', render: (r) => formatInr(r.totalCollected ?? r.totalCollectedPaise ?? 0) },
        { key: 'outstanding', header: 'Outstanding (INR)', align: 'right', render: (r) => formatInr(r.outstanding ?? 0) },
        { key: 'collectionPct', header: 'Rate %', align: 'center', render: (r) => `${r.collectionPct ?? r.collectionPercentage ?? 0}%` }
      ];
    }
    if (reportType === 'outstanding_fees') {
      return [
        { key: 'name', header: 'Student Name' },
        { key: 'studentId', header: 'Student ID', render: (r) => r.studentId || r.id },
        { key: 'centre', header: 'Centre', render: (r) => r.centre?.name || '—' },
        { key: 'totalFee', header: 'Total Fee', align: 'right', render: (r) => formatInr(r.feeSummary?.total || r.feeSummary?.totalFeePaise || 0) },
        { key: 'paid', header: 'Paid', align: 'right', render: (r) => formatInr(r.feeSummary?.paid || r.feeSummary?.paidPaise || 0) },
        { key: 'balance', header: 'Outstanding Balance', align: 'right', render: (r) => (
          <span style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>
            {formatInr(r.feeSummary?.outstanding || r.feeSummary?.balancePaise || 0)}
          </span>
        )}
      ];
    }
    if (reportType === 'unmatched') {
      return [
        { key: 'reference', header: 'UTR / Ref', render: (r) => r.paymentId?.gatewayRef || r.reference || r._id },
        { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatInr(r.paymentId?.amount ?? r.amount ?? 0) },
        { key: 'status', header: 'Status', align: 'center', render: (r) => r.status },
        { key: 'createdAt', header: 'Received Date', render: (r) => formatDate(r.createdAt) }
      ];
    }
    if (reportType === 'refunds') {
      return [
        { key: 'student', header: 'Student', render: (r) => r.studentId?.name || r.student?.name || r.studentName },
        { key: 'netRefund', header: 'Net Refund (INR)', align: 'right', render: (r) => formatInr(r.netRefund ?? r.amount ?? 0) },
        { key: 'processingFee', header: 'Processing Fee (INR)', align: 'right', render: (r) => formatInr(r.processingFee ?? 0) },
        { key: 'status', header: 'Status', align: 'center', render: (r) => r.status },
        { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) }
      ];
    }
    return [
      { key: 'gatewayRef', header: 'Reference', render: (r) => r.gatewayRef || r._id },
      { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatInr(r.amount) },
      { key: 'source', header: 'Mode', render: (r) => r.source || 'online' },
      { key: 'receivedAt', header: 'Paid Date', render: (r) => formatDate(r.receivedAt || r.createdAt) }
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('accountsReports.title', 'Financial Reports & CSV Exports')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsReports.subtitle', 'Export audit-compliant CSV reports with formula injection protection')}
          </p>
        </div>

        <div>
          <Button
            onClick={handleDownloadCsv}
            disabled={downloading}
          >
            <span>📥</span>
            <span>{downloading ? 'Generating CSV...' : 'Export Clean CSV'}</span>
          </Button>
        </div>
      </div>

      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Select Report:
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)',
                minWidth: '240px'
              }}
            >
              <option value="centre_collections">Centre Collections & Targets Summary</option>
              <option value="batch_collections">Batch-wise Performance Breakdown</option>
              <option value="outstanding_fees">Outstanding Fees Register</option>
              <option value="payment_history">Payment Transactions Audit Log</option>
              <option value="unmatched">Unmatched Bank Payments Register</option>
              <option value="refunds">Course Withdrawals & Refunds Register</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Centre Filter:
            </label>
            <select
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)',
                minWidth: '180px'
              }}
            >
              <option value="">All 4 Centres</option>
              {centres.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>🔒</span>
        <span>
          CSV export includes automatic RFC-4180 escaping and prefixing against spreadsheet formula injection (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, <code>'</code>).
        </span>
      </div>

      {error && <ErrorState message={error} onRetry={fetchReportPreview} />}

      <Card
        title={`Report Preview: ${reportType.replace(/_/g, ' ').toUpperCase()}`}
        subtitle={`Showing ${reportData.length} records`}
      >
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsReports.loading', 'Loading preview...')} />
          </div>
        ) : (
          <ResponsiveTable
            columns={getColumns()}
            data={reportData}
            keyField="_id"
            emptyMessage="No records available for the selected report and filters."
          />
        )}
      </Card>
    </div>
  );
}
