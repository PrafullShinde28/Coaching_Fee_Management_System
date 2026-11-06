import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { formatInr, formatDate } from '../../utils/formatters';

export function AccountsUnmatchedPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unmatchedList, setUnmatchedList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');

  // Match Modal states
  const [matchingItem, setMatchingItem] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedInstalmentId, setSelectedInstalmentId] = useState('');
  const [studentLedger, setStudentLedger] = useState(null);
  const [matchNotes, setMatchNotes] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);

  // Dismiss Modal states
  const [dismissingItem, setDismissingItem] = useState(null);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissLoading, setDismissLoading] = useState(false);

  const fetchUnmatched = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.accounts.getUnmatchedPayments(params);
      const list = res.unmatchedPayments || res.data || (Array.isArray(res) ? res : []);
      setUnmatchedList(list);
    } catch (err) {
      setError(err.message || 'Failed to load unmatched payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnmatched();
  }, [statusFilter]);

  const handleSearchStudents = async (query) => {
    setStudentSearch(query);
    if (!query || query.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    try {
      const res = await api.accounts.getStudents({ search: query, limit: 8 });
      const list = res.students || res.data || (Array.isArray(res) ? res : []);
      setStudentResults(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectStudentForMatch = async (stu) => {
    setSelectedStudent(stu);
    setStudentResults([]);
    try {
      const res = await api.accounts.getStudentLedger(stu.id || stu._id);
      const data = res.data || res;
      setStudentLedger(data);
      const firstUnpaid = (data.instalments || []).find((i) => (i.outstanding ?? i.remainingPaise ?? (i.amount - i.paid)) > 0);
      if (firstUnpaid) {
        setSelectedInstalmentId(firstUnpaid.id || firstUnpaid._id);
      }
    } catch (e) {
      toast.error('Failed to load student instalments');
    }
  };

  const handleConfirmMatch = async () => {
    if (!matchingItem || !selectedStudent) return;
    try {
      setMatchLoading(true);
      const payload = {
        studentId: selectedStudent.id || selectedStudent._id
      };
      if (selectedInstalmentId) {
        payload.instalmentId = selectedInstalmentId;
      }

      await api.accounts.matchUnmatchedPayment(matchingItem.id || matchingItem._id, payload);
      toast.success('Unmatched payment successfully reconciled and allocated!');
      setMatchingItem(null);
      setSelectedStudent(null);
      setStudentLedger(null);
      fetchUnmatched();
    } catch (err) {
      toast.error(err.message || 'Failed to reconcile payment');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleConfirmDismiss = async () => {
    if (!dismissingItem || !dismissReason.trim()) {
      toast.error('A dismissal reason is mandatory.');
      return;
    }
    try {
      setDismissLoading(true);
      await api.accounts.dismissUnmatchedPayment(dismissingItem.id || dismissingItem._id, {
        reason: dismissReason.trim()
      });
      toast.success('Unmatched payment dismissed.');
      setDismissingItem(null);
      setDismissReason('');
      fetchUnmatched();
    } catch (err) {
      toast.error(err.message || 'Failed to dismiss payment');
    } finally {
      setDismissLoading(false);
    }
  };

  const columns = [
    {
      key: 'utr',
      header: t('accountsUnmatched.utr', 'UTR / Reference'),
      render: (r) => {
        const ref = r.paymentId?.gatewayRef || r.reference || r.utr || r.reason || 'N/A';
        return (
          <div>
            <strong style={{ fontFamily: 'monospace' }}>{ref}</strong>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Source: {r.paymentId?.source || 'bank_transfer'}
            </div>
          </div>
        );
      }
    },
    {
      key: 'amount',
      header: t('accountsUnmatched.amount', 'Amount'),
      align: 'right',
      render: (r) => {
        const amt = r.paymentId?.amount ?? r.amountPaise ?? r.amount ?? 0;
        return (
          <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {formatInr(amt)}
          </span>
        );
      }
    },
    {
      key: 'receivedAt',
      header: t('accountsUnmatched.receivedAt', 'Received Date'),
      render: (r) => formatDate(r.paymentId?.receivedAt || r.receivedAt || r.createdAt)
    },
    {
      key: 'status',
      header: t('accountsUnmatched.status', 'Status'),
      align: 'center',
      render: (r) => {
        const s = r.status || 'open';
        const colorMap = {
          open: 'var(--color-warning)',
          matched: 'var(--color-success)',
          dismissed: 'var(--color-text-muted)'
        };
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              backgroundColor: s === 'matched' ? 'var(--color-success-bg)' : s === 'dismissed' ? 'var(--color-surface-subtle)' : 'var(--color-warning-bg)',
              color: colorMap[s] || 'var(--color-text)'
            }}
          >
            {s}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: t('accountsUnmatched.actions', 'Actions'),
      align: 'right',
      render: (r) => {
        if (r.status !== 'open') {
          return (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {r.status === 'matched' ? 'Reconciled' : 'Dismissed'}
            </span>
          );
        }
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              onClick={() => {
                setMatchingItem(r);
                setSelectedStudent(null);
                setStudentLedger(null);
                setStudentSearch('');
              }}
            >
              Match
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDismissingItem(r);
                setDismissReason('');
              }}
            >
              Dismiss
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('accountsUnmatched.title', 'Unmatched Payments Reconciliation Queue')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsUnmatched.subtitle', 'Direct bank credits without reference; match to student ledger or dismiss')}
          </p>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <option value="open">Open / Pending Queue Only</option>
            <option value="matched">Matched Records</option>
            <option value="dismissed">Dismissed Records</option>
            <option value="">All Records</option>
          </select>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchUnmatched} />}

      <Card>
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsUnmatched.loading', 'Loading reconciliation queue...')} />
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={unmatchedList}
            keyField="_id"
            emptyMessage={t('accountsUnmatched.empty', 'No unmatched payments found matching the filter.')}
          />
        )}
      </Card>

      {matchingItem && (
        <Modal
          isOpen={!!matchingItem}
          onClose={() => setMatchingItem(null)}
          title={`Match Payment: ${formatInr(matchingItem.paymentId?.amount ?? matchingItem.amount ?? 0)}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
              <div><strong>UTR / Ref:</strong> {matchingItem.paymentId?.gatewayRef || matchingItem.reason || matchingItem._id}</div>
              <div><strong>Amount:</strong> {formatInr(matchingItem.paymentId?.amount ?? matchingItem.amount ?? 0)}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                Target Student:
              </label>
              {!selectedStudent ? (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => handleSearchStudents(e.target.value)}
                    placeholder="Search student name or roll no..."
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  />
                  {studentResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 20,
                        marginTop: '4px',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}
                    >
                      {studentResults.map((s) => (
                        <div
                          key={s.id || s._id}
                          onClick={() => handleSelectStudentForMatch(s)}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--color-border-subtle)',
                            fontSize: 'var(--font-size-sm)'
                          }}
                        >
                          <strong>{s.name}</strong> ({s.rollNumber || s.studentId || 'N/A'}) • {s.centre?.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <strong>{selectedStudent.name}</strong> ({selectedStudent.rollNumber || selectedStudent.studentId || 'N/A'})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentLedger(null);
                    }}
                    style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {selectedStudent && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  Allocate To:
                </label>
                <select
                  value={selectedInstalmentId}
                  onChange={(e) => setSelectedInstalmentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="">Auto-allocate (Oldest Unpaid Instalment First)</option>
                  {(studentLedger?.instalments || []).map((inst) => {
                    const rem = inst.outstanding ?? inst.remainingPaise ?? (inst.amount - inst.paid);
                    return (
                      <option key={inst.id || inst._id} value={inst.id || inst._id}>
                        Instalment #{inst.seq || inst.instalmentNumber} — Balance: {formatInr(rem)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="outline" onClick={() => setMatchingItem(null)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedStudent || matchLoading}
                onClick={handleConfirmMatch}
              >
                {matchLoading ? 'Allocating...' : 'Confirm Match & Reconcile'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {dismissingItem && (
        <Modal
          isOpen={!!dismissingItem}
          onClose={() => setDismissingItem(null)}
          title="Dismiss Unmatched Payment"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Are you sure you want to dismiss this unmatched payment of <strong>{formatInr(dismissingItem.paymentId?.amount ?? dismissingItem.amount ?? 0)}</strong>?
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                Mandatory Dismissal Reason: *
              </label>
              <textarea
                rows="3"
                required
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. Bank chargeback / reversed by remitter / not coaching fee..."
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="outline" onClick={() => setDismissingItem(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!dismissReason.trim() || dismissLoading}
                onClick={handleConfirmDismiss}
              >
                {dismissLoading ? 'Dismissing...' : 'Confirm Dismissal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
