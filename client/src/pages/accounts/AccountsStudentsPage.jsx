import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Badge } from '../../components/common/Badge';
import { formatInr } from '../../utils/formatters';

export function AccountsStudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState('');
  const [centreId, setCentreId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');

  // Dropdown lists
  const [centres, setCentres] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    Promise.all([
      api.accounts.getCentres(),
      api.accounts.getBatches()
    ]).then(([cRes, bRes]) => {
      setCentres(cRes.centres || cRes.data || (Array.isArray(cRes) ? cRes : []));
      setBatches(bRes.batches || bRes.data || (Array.isArray(bRes) ? bRes : []));
    }).catch((e) => console.error('Failed to load filter options:', e));
  }, []);

  const fetchStudents = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (centreId) params.centreId = centreId;
      if (batchId) params.batchId = batchId;
      if (status) params.status = status;

      const res = await api.accounts.getStudents(params);
      const studentList = res.students || res.data || (Array.isArray(res) ? res : []);
      setStudents(studentList);
      if (res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({ page: 1, limit: 15, total: studentList.length, totalPages: 1 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, centreId, batchId, status]);

  const columns = [
    {
      key: 'name',
      header: t('accountsStudents.student', 'Student'),
      render: (r) => (
        <div>
          <Link
            to={`/accounts/students/${r.id || r._id}`}
            style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }}
          >
            {r.name}
          </Link>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Roll: {r.rollNumber || r.studentId || 'N/A'} • {r.studentId || r.id}
          </div>
        </div>
      )
    },
    {
      key: 'centre',
      header: t('accountsStudents.centre', 'Centre / Batch'),
      render: (r) => (
        <div>
          <div style={{ fontWeight: '500' }}>{r.centre?.name || '—'}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{r.batch?.name || '—'}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: t('accountsStudents.academicStatus', 'Academic'),
      align: 'center',
      render: (r) => <Badge status={r.status || 'active'} />
    },
    {
      key: 'totalFeePaise',
      header: t('accountsStudents.totalFee', 'Total Fee'),
      align: 'right',
      render: (r) => formatInr(r.feeSummary?.total || r.feeSummary?.totalFeePaise || 0)
    },
    {
      key: 'paidPaise',
      header: t('accountsStudents.paid', 'Paid'),
      align: 'right',
      render: (r) => (
        <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>
          {formatInr(r.feeSummary?.paid || r.feeSummary?.paidPaise || 0)}
        </span>
      )
    },
    {
      key: 'balancePaise',
      header: t('accountsStudents.balance', 'Balance'),
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: '500' }}>
          {formatInr(r.feeSummary?.outstanding || r.feeSummary?.balancePaise || 0)}
        </span>
      )
    },
    {
      key: 'actions',
      header: t('accountsStudents.actions', 'Actions'),
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => navigate(`/accounts/students/${r.id || r._id}`)}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer'
            }}
          >
            {t('accountsStudents.viewLedger', 'Ledger')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/accounts/collections?studentId=${r.id || r._id}`)}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer'
            }}
          >
            {t('accountsStudents.pay', 'Pay')}
          </button>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Title */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('accountsStudents.title', 'Students & Fee Ledgers')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsStudents.subtitle', 'Search enrolled students, view instalment balances, and collect payments')}
          </p>
        </div>
        <div>
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
            <span>{t('accountsStudents.recordNewPayment', 'Record Offline Payment')}</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('accountsStudents.searchPlaceholder', 'Search name, roll no, phone...')}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>

          <div>
            <select
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="">{t('accountsStudents.allCentres', 'All Centres')}</option>
              {centres.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="">{t('accountsStudents.allBatches', 'All Batches')}</option>
              {batches.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="">{t('accountsStudents.allStatuses', 'All Student Statuses')}</option>
              <option value="active">{t('accountsStudents.activeOnly', 'Active')}</option>
              <option value="left">{t('accountsStudents.leftOnly', 'Left (Withdrawal)')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Students Table */}
      {error && <ErrorState message={error} onRetry={() => fetchStudents(pagination.page)} />}

      <Card>
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsStudents.loading', 'Loading student fee records...')} />
          </div>
        ) : (
          <>
            <ResponsiveTable
              columns={columns}
              data={students}
              keyField="id"
              emptyMessage={t('accountsStudents.noRecords', 'No students match your search filters')}
            />

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total students)
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchStudents(pagination.page - 1)}
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: pagination.page <= 1 ? 0.5 : 1,
                      fontSize: 'var(--font-size-xs)'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchStudents(pagination.page + 1)}
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                      opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                      fontSize: 'var(--font-size-xs)'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
