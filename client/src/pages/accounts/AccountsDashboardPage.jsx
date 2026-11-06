import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr, formatDate } from '../../utils/formatters';

export function AccountsDashboardPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [centres, setCentres] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');

  const fetchDashboard = async (centreId = '', batchId = '') => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (centreId) params.centreId = centreId;
      if (batchId) params.batchId = batchId;

      const [dashRes, centresRes, batchesRes] = await Promise.all([
        api.accounts.getDashboard(params),
        api.accounts.getCentres(),
        api.accounts.getBatches(centreId ? { centreId } : {})
      ]);

      setDashboardData(dashRes);
      setCentres(centresRes.centres || centresRes.data || (Array.isArray(centresRes) ? centresRes : []));
      setBatches(batchesRes.batches || batchesRes.data || (Array.isArray(batchesRes) ? batchesRes : []));
    } catch (err) {
      setError(err.message || 'Failed to load accounts dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedCentre, selectedBatch);
  }, [selectedCentre, selectedBatch]);

  if (loading && !dashboardData) {
    return <LoadingSpinner text={t('accountsDashboard.loading', 'Loading accounts dashboard...')} />;
  }

  if (error && !dashboardData) {
    return <ErrorState message={error} onRetry={() => fetchDashboard(selectedCentre, selectedBatch)} />;
  }

  const summary = dashboardData?.summary || dashboardData?.kpis || {};
  const totalExpected = summary.totalExpectedFee || summary.totalExpectedPaise || 0;
  const totalCollected = summary.totalCollected || summary.totalCollectedPaise || 0;
  const totalOutstanding = summary.totalOutstanding || summary.totalOutstandingPaise || 0;
  const totalOverdue = summary.totalOverdue || summary.totalOverduePaise || 0;
  const overdueCount = summary.overdueCount || summary.overdueStudentsCount || 0;
  const collectionPercentage = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const centreSummaries = dashboardData?.centreSummaries || [];
  const batchSummaries = dashboardData?.batchSummaries || [];
  const recentPayments = dashboardData?.recentPayments || [];

  const centreColumns = [
    { key: 'name', header: t('accountsDashboard.centreName', 'Centre'), render: (row) => (
      <div>
        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{row.name}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{row.code} • {row.city}</div>
      </div>
    )},
    { key: 'totalStudents', header: t('accountsDashboard.students', 'Students'), align: 'center', render: (r) => r.totalStudents ?? r.studentsCount ?? 0 },
    { key: 'totalScheduled', header: t('accountsDashboard.expected', 'Expected Fee'), align: 'right', render: (r) => formatInr(r.totalScheduled ?? r.totalExpectedPaise ?? 0) },
    { key: 'totalCollected', header: t('accountsDashboard.collected', 'Collected'), align: 'right', render: (r) => (
      <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
        {formatInr(r.totalCollected ?? r.totalCollectedPaise ?? 0)}
      </span>
    )},
    { key: 'outstanding', header: t('accountsDashboard.outstanding', 'Outstanding'), align: 'right', render: (r) => formatInr(r.outstanding ?? r.totalOutstandingPaise ?? 0) },
    { key: 'collectionPct', header: t('accountsDashboard.progress', 'Progress'), align: 'center', render: (r) => {
      const pct = r.collectionPct ?? r.collectionPercentage ?? 0;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold' }}>{pct}%</span>
        </div>
      );
    }}
  ];

  const batchColumns = [
    { key: 'name', header: t('accountsDashboard.batchName', 'Batch'), render: (row) => (
      <div>
        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{row.name}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{row.centreName}</div>
      </div>
    )},
    { key: 'studentCount', header: t('accountsDashboard.students', 'Students'), align: 'center', render: (r) => r.studentCount ?? r.studentsCount ?? 0 },
    { key: 'totalScheduled', header: t('accountsDashboard.expected', 'Expected'), align: 'right', render: (r) => formatInr(r.totalScheduled ?? r.totalExpectedPaise ?? 0) },
    { key: 'totalCollected', header: t('accountsDashboard.collected', 'Collected'), align: 'right', render: (r) => (
      <span style={{ color: 'var(--color-success)' }}>{formatInr(r.totalCollected ?? r.totalCollectedPaise ?? 0)}</span>
    )},
    { key: 'collectionPct', header: t('accountsDashboard.rate', 'Rate'), align: 'center', render: (r) => `${r.collectionPct ?? r.collectionPercentage ?? 0}%` }
  ];

  const paymentColumns = [
    { key: 'gatewayRef', header: t('accountsDashboard.receiptNo', 'Reference'), render: (r) => <strong>{r.gatewayRef || r._id?.slice(-8) || '—'}</strong> },
    { key: 'amount', header: t('accountsDashboard.amount', 'Amount'), align: 'right', render: (r) => (
      <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{formatInr(r.amount ?? r.amountPaise ?? 0)}</span>
    )},
    { key: 'source', header: t('accountsDashboard.method', 'Method'), render: (r) => (
      <span style={{ textTransform: 'uppercase', fontSize: '11px', background: 'var(--color-surface-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
        {r.source || 'online'}
      </span>
    )},
    { key: 'receivedAt', header: t('accountsDashboard.date', 'Date'), render: (r) => formatDate(r.receivedAt || r.createdAt) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header & Quick Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('accountsDashboard.title', 'Accounts Overview')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsDashboard.subtitle', 'Financial health, fee collections, and centre breakdown')}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Link
            to="/accounts/collections"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <span>💳</span>
            <span>{t('accountsDashboard.recordPayment', 'Record Payment')}</span>
          </Link>
          <Link
            to="/accounts/reports"
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
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <span>📑</span>
            <span>{t('accountsDashboard.reports', 'Export Reports')}</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              {t('accountsDashboard.filterCentre', 'Filter Centre:')}
            </span>
            <select
              value={selectedCentre}
              onChange={(e) => {
                setSelectedCentre(e.target.value);
                setSelectedBatch('');
              }}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)',
                minWidth: '180px'
              }}
            >
              <option value="">{t('accountsDashboard.allCentres', 'All 4 Centres')}</option>
              {centres.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              {t('accountsDashboard.filterBatch', 'Batch:')}
            </span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)',
                minWidth: '180px'
              }}
            >
              <option value="">{t('accountsDashboard.allBatches', 'All Batches')}</option>
              {batches.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {(selectedCentre || selectedBatch) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCentre('');
                setSelectedBatch('');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {t('accountsDashboard.clearFilters', 'Reset filters')}
            </button>
          )}
        </div>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4">
        {/* Total Collected */}
        <Card style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('accountsDashboard.totalCollected', 'Total Collected')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-success)', marginTop: 'var(--space-2)' }}>
            {formatInr(totalCollected)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {collectionPercentage}% {t('accountsDashboard.ofTarget', 'of expected target')}
          </div>
        </Card>

        {/* Total Expected */}
        <Card style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('accountsDashboard.totalExpected', 'Total Expected Target')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-text)', marginTop: 'var(--space-2)' }}>
            {formatInr(totalExpected)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {centres.length || 4} {t('accountsDashboard.centresActive', 'Centres Active')}
          </div>
        </Card>

        {/* Total Outstanding */}
        <Card style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('accountsDashboard.totalOutstanding', 'Total Outstanding')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-warning)', marginTop: 'var(--space-2)' }}>
            {formatInr(totalOutstanding)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {t('accountsDashboard.futureAndDue', 'Future & due instalments')}
          </div>
        </Card>

        {/* Total Overdue */}
        <Card style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('accountsDashboard.overdueFees', 'Overdue Fees')}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: 'var(--space-2)' }}>
            {formatInr(totalOverdue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
            {overdueCount} {t('accountsDashboard.studentsOverdue', 'students with overdue fees')}
          </div>
        </Card>
      </div>

      {/* Centre-wise Performance Table */}
      <Card
        title={t('accountsDashboard.centreBreakdown', 'Centre-wise Collection Performance')}
        subtitle={t('accountsDashboard.centreSubtitle', 'Collection targets and realization across all 4 campuses')}
      >
        <ResponsiveTable
          columns={centreColumns}
          data={centreSummaries}
          keyField="id"
          emptyMessage={t('accountsDashboard.noCentres', 'No centre summaries available')}
        />
      </Card>

      {/* Grid: Batch Breakdown & Recent Collections */}
      <div className="grid grid-cols-2">
        <Card
          title={t('accountsDashboard.batchBreakdown', 'Batch Collections')}
          subtitle={t('accountsDashboard.batchSubtitle', 'Performance segmented by class and stream')}
        >
          <ResponsiveTable
            columns={batchColumns}
            data={batchSummaries.slice(0, 8)}
            keyField="id"
            emptyMessage={t('accountsDashboard.noBatches', 'No batch records available')}
          />
        </Card>

        <Card
          title={t('accountsDashboard.recentCollections', 'Recent Collections')}
          subtitle={t('accountsDashboard.recentSubtitle', 'Latest payments processed across centres')}
          headerAction={
            <Link to="/accounts/students" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
              {t('accountsDashboard.viewAllStudents', 'View all students →')}
            </Link>
          }
        >
          <ResponsiveTable
            columns={paymentColumns}
            data={recentPayments}
            keyField="_id"
            emptyMessage={t('accountsDashboard.noRecentPayments', 'No recent payments found')}
          />
        </Card>
      </div>
    </div>
  );
}
