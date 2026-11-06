import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { formatInr, formatDate } from '../../utils/formatters';

export function AccountsRefundsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const preselectedStudentId = searchParams.get('studentId');

  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refundRecords, setRefundRecords] = useState([]);
  const [leftStudents, setLeftStudents] = useState([]);

  // Calculate Modal
  const [calculateModalStudent, setCalculateModalStudent] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [refundReason, setRefundReason] = useState('Medical reasons');
  const [refundNotes, setRefundNotes] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Process Modal
  const [processingRefund, setProcessingRefund] = useState(null);
  const [processAction, setProcessAction] = useState('paid');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const [payoutReference, setPayoutReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [processNotes, setProcessNotes] = useState('');
  const [processingLoading, setProcessingLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [refundsRes, leftStudentsRes] = await Promise.all([
        api.accounts.getRefunds(),
        api.accounts.getStudents({ status: 'left' })
      ]);

      const records = refundsRes.refunds || refundsRes.data || (Array.isArray(refundsRes) ? refundsRes : []);
      const leftList = leftStudentsRes.students || refundsRes.pendingEligibleStudents || leftStudentsRes.data || (Array.isArray(leftStudentsRes) ? leftStudentsRes : []);

      setRefundRecords(records);
      setLeftStudents(leftList);
    } catch (err) {
      setError(err.message || 'Failed to load refund data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedStudentId && leftStudents.length > 0) {
      const stu = leftStudents.find((s) => (s.id || s._id) === preselectedStudentId);
      if (stu) {
        handleOpenCalculateModal(stu);
      }
    }
  }, [preselectedStudentId, leftStudents]);

  const handleOpenCalculateModal = async (student) => {
    const sId = student.id || student._id || student.student?._id;
    setCalculateModalStudent(student.student || student);
    setCalculationResult(null);
    setCalcLoading(true);
    try {
      const res = await api.accounts.calculateRefund(sId);
      setCalculationResult(res);
    } catch (err) {
      toast.error('Calculation failed: ' + (err.message || 'Error'));
    } finally {
      setCalcLoading(false);
    }
  };

  const handleSubmitRefundRequest = async () => {
    if (!calculateModalStudent || !calculationResult) return;
    try {
      setSubmittingRefund(true);
      const sId = calculateModalStudent.id || calculateModalStudent._id;
      await api.accounts.createRefund({
        studentId: sId,
        reason: refundReason,
        notes: refundNotes.trim()
      });
      toast.success('Refund request generated successfully!');
      setCalculateModalStudent(null);
      setCalculationResult(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!processingRefund) return;

    if (processAction === 'paid') {
      if (!payoutReference.trim()) {
        toast.error('Transaction reference / UTR / cheque number is required');
        return;
      }
      if (!payoutDate) {
        toast.error('Disbursal payout date is required');
        return;
      }
    } else {
      if (!processNotes.trim()) {
        toast.error('Rejection reason is required');
        return;
      }
    }

    try {
      setProcessingLoading(true);
      await api.accounts.processRefund(processingRefund.id || processingRefund._id, {
        action: processAction,
        method: processAction === 'paid' ? payoutMethod : undefined,
        reference: processAction === 'paid' ? payoutReference.trim() : undefined,
        paidAt: processAction === 'paid' && payoutDate ? new Date(payoutDate).toISOString() : undefined,
        reason: processAction === 'rejected' ? processNotes.trim() : undefined,
        notes: processAction === 'paid' ? processNotes.trim() : undefined
      });
      toast.success(`Refund marked as ${processAction}!`);
      setProcessingRefund(null);
      setProcessNotes('');
      setPayoutReference('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update refund');
    } finally {
      setProcessingLoading(false);
    }
  };

  const refundColumns = [
    {
      key: 'student',
      header: t('accountsRefunds.student', 'Student'),
      render: (r) => (
        <div>
          <div style={{ fontWeight: '500' }}>{r.studentId?.name || r.student?.name || r.studentName}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Roll: {r.studentId?.rollNumber || r.studentId?.studentId || 'N/A'}
          </div>
        </div>
      )
    },
    {
      key: 'netRefund',
      header: t('accountsRefunds.netRefund', 'Net Refund'),
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
          {formatInr(r.netRefund ?? r.amount ?? r.netRefundPaise ?? 0)}
        </span>
      )
    },
    {
      key: 'processingFee',
      header: t('accountsRefunds.deduction', 'Processing Fee'),
      align: 'right',
      render: (r) => formatInr(r.processingFee ?? r.processingFeePaise ?? 0)
    },
    {
      key: 'status',
      header: t('accountsRefunds.status', 'Status'),
      align: 'center',
      render: (r) => {
        const s = r.status || 'pending_approval';
        const statusMap = {
          pending_approval: { color: 'var(--color-warning)', label: 'Pending Approval' },
          approved: { color: 'var(--color-info)', label: 'Approved' },
          paid: { color: 'var(--color-success)', label: 'Paid / Disbursed' },
          rejected: { color: 'var(--color-danger)', label: 'Rejected' }
        };
        const conf = statusMap[s] || { color: 'var(--color-text)', label: s };
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 'bold',
              color: conf.color,
              backgroundColor: 'var(--color-surface-subtle)',
              border: `1px solid ${conf.color}`
            }}
          >
            {conf.label}
          </span>
        );
      }
    },
    {
      key: 'createdAt',
      header: t('accountsRefunds.date', 'Requested On'),
      render: (r) => formatDate(r.createdAt || r.requestedAt)
    },
    {
      key: 'payout',
      header: t('accountsRefunds.payoutAudit', 'Audit Trail'),
      render: (r) => {
        if (r.status === 'paid' && r.payout) {
          const p = r.payout;
          const staff = p.processedBy?.phone || p.processedBy?.name || (typeof p.processedBy === 'string' ? p.processedBy : 'Staff');
          return (
            <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
              <div><strong>Method:</strong> {p.method ? p.method.replace('_', ' ').toUpperCase() : 'N/A'}</div>
              <div><strong>Ref:</strong> {p.reference || 'N/A'}</div>
              <div><strong>Date:</strong> {p.paidAt ? formatDate(p.paidAt) : 'N/A'}</div>
              <div><strong>By:</strong> {staff}</div>
            </div>
          );
        }
        if (r.status === 'rejected') {
          const rej = r.rejection || {};
          const staff = rej.rejectedBy?.phone || rej.rejectedBy?.name || (typeof rej.rejectedBy === 'string' ? rej.rejectedBy : 'Staff');
          return (
            <div style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--color-danger)' }}>
              <div><strong>Rejected By:</strong> {staff}</div>
              <div><strong>Reason:</strong> {rej.reason || r.inputs?.rejectionReason || 'N/A'}</div>
              <div><strong>Date:</strong> {rej.rejectedAt ? formatDate(rej.rejectedAt) : 'N/A'}</div>
            </div>
          );
        }
        return <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>—</span>;
      }
    },
    {
      key: 'actions',
      header: t('accountsRefunds.actions', 'Action'),
      align: 'right',
      render: (r) => {
        if (r.status === 'paid' || r.status === 'rejected') {
          return <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Completed</span>;
        }
        return (
          <Button
            size="sm"
            onClick={() => {
              setProcessingRefund(r);
              setProcessAction('paid');
              setPayoutMethod('bank_transfer');
              setPayoutReference('');
              setPayoutDate(new Date().toISOString().slice(0, 10));
              setProcessNotes('');
            }}
          >
            Process Payout
          </Button>
        );
      }
    }
  ];

  const leftStudentColumns = [
    {
      key: 'name',
      header: t('accountsRefunds.student', 'Student'),
      render: (s) => {
        const stu = s.student || s;
        return (
          <div>
            <div style={{ fontWeight: '500' }}>{stu.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Roll: {stu.rollNumber || stu.studentId || 'N/A'} • {stu.centreId?.name || stu.centre?.name || 'Jaipur'}
            </div>
          </div>
        );
      }
    },
    {
      key: 'leftOn',
      header: t('accountsRefunds.leftOn', 'Left / Withdrawal Date'),
      render: (s) => {
        const stu = s.student || s;
        return formatDate(stu.leftOn || s.leftOn || stu.updatedAt);
      }
    },
    {
      key: 'totalPaid',
      header: t('accountsRefunds.totalPaid', 'Paid So Far'),
      align: 'right',
      render: (s) => formatInr(s.paid ?? s.feeSummary?.paid ?? s.totalPaid ?? 0)
    },
    {
      key: 'actions',
      header: t('accountsRefunds.actions', 'Action'),
      align: 'right',
      render: (s) => (
        <Button
          size="sm"
          onClick={() => handleOpenCalculateModal(s)}
        >
          Calculate Refund
        </Button>
      )
    }
  ];

  const calcDetails = calculationResult?.refund || calculationResult || {};
  const isEligible = !calculationResult?.isDeadlineExpired && (calcDetails.isEligible !== false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('accountsRefunds.title', 'Refunds & Course Withdrawals')}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
          {t('accountsRefunds.subtitle', 'Strict adherence to 10-day withdrawal window, pro-rata unused fee share, and processing caps')}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderBottom: activeTab === 'records' ? '2px solid var(--color-primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'records' ? 'bold' : 'normal',
            color: activeTab === 'records' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          Refund Records ({refundRecords.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('left_students')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderBottom: activeTab === 'left_students' ? '2px solid var(--color-primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'left_students' ? 'bold' : 'normal',
            color: activeTab === 'left_students' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          Eligible Left Students ({leftStudents.length})
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchData} />}

      <Card>
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsRefunds.loading', 'Loading refund registers...')} />
          </div>
        ) : activeTab === 'records' ? (
          <ResponsiveTable
            columns={refundColumns}
            data={refundRecords}
            keyField="_id"
            emptyMessage={t('accountsRefunds.noRecords', 'No refund requests have been submitted yet.')}
          />
        ) : (
          <ResponsiveTable
            columns={leftStudentColumns}
            data={leftStudents}
            keyField="_id"
            emptyMessage={t('accountsRefunds.noLeft', 'No withdrawn/left students found.')}
          />
        )}
      </Card>

      {calculateModalStudent && (
        <Modal
          isOpen={!!calculateModalStudent}
          onClose={() => setCalculateModalStudent(null)}
          title={`Calculate Refund — ${calculateModalStudent.name}`}
        >
          {calcLoading ? (
            <LoadingSpinner text="Calculating pro-rata fee share..." />
          ) : calculationResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isEligible ? '#e8f5e9' : '#ffebee',
                  border: `1px solid ${isEligible ? '#a5d6a7' : '#ef9a9a'}`,
                  fontSize: 'var(--font-size-xs)'
                }}
              >
                <div style={{ fontWeight: 'bold', color: isEligible ? '#1b4332' : '#c62828' }}>
                  {isEligible ? '✓ Within 10-Day Withdrawal Window' : '⚠️ Past 10-Day Deadline'}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Left On: {formatDate(calculationResult.leftOn || calculateModalStudent.leftOn)} • Deadline: {formatDate(calculationResult.deadline)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', backgroundColor: 'var(--color-surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Net Annual Fee:</span>
                  <span>{formatInr(calcDetails.totalFee || calculationResult.totalFee || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Days Used vs Term:</span>
                  <span>{calculationResult.daysUsed || calcDetails.daysUsed || 0} / {calculationResult.termDays || calcDetails.termDays || 300} days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Proportional Share Consumed:</span>
                  <span>{formatInr(calcDetails.usedShare || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Total Amount Paid:</span>
                  <span>{formatInr(calcDetails.paid || calculationResult.totalPaid || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Processing Fee (Cap ₹5,000):</span>
                  <span style={{ color: 'var(--color-danger)' }}>- {formatInr(calcDetails.processingFee || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                  <span>Net Refund Payable:</span>
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-base)' }}>
                    {formatInr(calcDetails.netRefund || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  Reason for Withdrawal:
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="Medical reasons">Medical reasons</option>
                  <option value="Relocation to another city">Relocation to another city</option>
                  <option value="Personal / Family circumstances">Personal / Family circumstances</option>
                  <option value="Course discontinuation">Course discontinuation</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  Internal Notes:
                </label>
                <textarea
                  rows="2"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Notes for accounting and auditor records..."
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button variant="outline" onClick={() => setCalculateModalStudent(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={!isEligible || (calcDetails.netRefund <= 0) || submittingRefund}
                  onClick={handleSubmitRefundRequest}
                >
                  {submittingRefund ? 'Submitting...' : 'Submit Refund Request'}
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-4)', color: 'var(--color-danger)' }}>
              Could not calculate refund for this student.
            </div>
          )}
        </Modal>
      )}

      {processingRefund && (
        <Modal
          isOpen={!!processingRefund}
          onClose={() => setProcessingRefund(null)}
          title={`Process Refund — ${formatInr(processingRefund.netRefund ?? processingRefund.amount ?? 0)}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                Decision:
              </label>
              <select
                value={processAction}
                onChange={(e) => setProcessAction(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-size-sm)'
                }}
              >
                <option value="paid">Disburse Payout (Mark as Paid)</option>
                <option value="rejected">Reject Refund Request</option>
              </select>
            </div>

            {processAction === 'paid' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                      Payout Method:
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        fontSize: 'var(--font-size-sm)'
                      }}
                    >
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                      Disbursal Date:
                    </label>
                    <input
                      type="date"
                      value={payoutDate}
                      onChange={(e) => setPayoutDate(e.target.value)}
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
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                    Payout Reference / UTR / Cheque No:
                  </label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    placeholder="e.g. UTR-9982012 / CHQ-10482"
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
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                {processAction === 'paid' ? 'Audit Notes (Optional):' : 'Rejection Reason:'}
              </label>
              <textarea
                rows="2"
                value={processNotes}
                onChange={(e) => setProcessNotes(e.target.value)}
                placeholder={processAction === 'paid' ? 'Additional notes regarding this payout...' : 'Explain reason for rejection...'}
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
              <Button variant="outline" onClick={() => setProcessingRefund(null)}>
                Cancel
              </Button>
              <Button
                variant={processAction === 'rejected' ? 'danger' : 'primary'}
                disabled={processingLoading}
                onClick={handleProcessRefund}
              >
                {processingLoading ? 'Updating...' : `Confirm ${processAction === 'paid' ? 'Payout' : 'Rejection'}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
