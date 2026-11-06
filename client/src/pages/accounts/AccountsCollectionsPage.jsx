import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { formatInr, formatDate } from '../../utils/formatters';

export function AccountsCollectionsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedStudentId = searchParams.get('studentId') || '';

  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentLedger, setStudentLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Form states
  const [selectedInstalmentId, setSelectedInstalmentId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);

  useEffect(() => {
    if (preselectedStudentId) {
      loadStudentDetails(preselectedStudentId);
    }
  }, [preselectedStudentId]);

  const loadStudentDetails = async (id) => {
    try {
      setLedgerLoading(true);
      const res = await api.accounts.getStudentLedger(id);
      const data = res.data || res;
      setSelectedStudent(data.student);
      setStudentLedger(data);

      const insts = data.instalments || [];
      const firstUnpaid = insts.find((i) => (i.outstanding ?? i.remainingPaise ?? (i.amount - i.paid)) > 0);
      if (firstUnpaid) {
        setSelectedInstalmentId(firstUnpaid.id || firstUnpaid._id);
        const rem = firstUnpaid.outstanding ?? firstUnpaid.remainingPaise ?? (firstUnpaid.amount - firstUnpaid.paid);
        setAmountRupees((rem / 100).toString());
      }
    } catch (err) {
      toast.error('Failed to load student details: ' + (err.message || 'Error'));
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSearchStudents = async (query) => {
    setStudentSearch(query);
    if (!query || query.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    try {
      const res = await api.accounts.getStudents({ search: query, limit: 10 });
      const list = res.students || res.data || (Array.isArray(res) ? res : []);
      setStudentResults(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectStudent = (stu) => {
    setSelectedStudent(stu);
    setStudentResults([]);
    setStudentSearch('');
    loadStudentDetails(stu.id || stu._id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudent) {
      setFormError('Please select a student first.');
      return;
    }

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setFormError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    const amountPaise = Math.round(rupees * 100);

    try {
      setSubmitting(true);
      const ref = reference.trim() || `MANUAL-${Date.now()}`;
      const payload = {
        studentId: selectedStudent.id || selectedStudent._id,
        amountPaise,
        reference: ref,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes.trim()
      };
      if (selectedInstalmentId) {
        payload.instalmentId = selectedInstalmentId;
      }

      const res = await api.accounts.recordPayment(payload);
      toast.success('Payment recorded successfully!');

      if (res.receipt) {
        setGeneratedReceipt(res.receipt);
        setShowReceiptModal(true);
      } else {
        navigate(`/accounts/students/${selectedStudent.id || selectedStudent._id}`);
      }

      setAmountRupees('');
      setReference('');
      setNotes('');
    } catch (err) {
      setFormError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '900px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('accountsCollections.title', 'Record Offline / Manual Payment')}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
          {t('accountsCollections.subtitle', 'Collect cash, cheques, UPI, POS, or NEFT/IMPS transfers and issue GST receipts')}
        </p>
      </div>

      <Card title={t('accountsCollections.selectStudent', '1. Select Student')}>
        {!selectedStudent ? (
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-2)' }}>
              {t('accountsCollections.searchLabel', 'Search Student by Name, Roll No, or Mobile:')}
            </label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => handleSearchStudents(e.target.value)}
              placeholder="e.g. Aarav Sharma, 9900000041..."
              style={{
                width: '100%',
                padding: 'var(--space-3)',
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
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}
              >
                {studentResults.map((s) => (
                  <div
                    key={s.id || s._id}
                    onClick={() => handleSelectStudent(s)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div>
                      <div style={{ fontWeight: '500' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Roll: {s.rollNumber || s.studentId || 'N/A'} • {s.centre?.name} • {s.batch?.name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold' }}>
                        Bal: {formatInr(s.feeSummary?.outstanding || s.feeSummary?.balancePaise || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                {selectedStudent.name}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Roll: {selectedStudent.rollNumber || selectedStudent.studentId || 'N/A'} • {selectedStudent.centre?.name} • {selectedStudent.batch?.name} • Status: {selectedStudent.status}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudent(null);
                setStudentLedger(null);
                setSelectedInstalmentId('');
                setAmountRupees('');
              }}
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-danger)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Change Student
            </button>
          </div>
        )}
      </Card>

      {selectedStudent && (
        <form onSubmit={handleSubmit}>
          <Card title={t('accountsCollections.paymentDetails', '2. Payment Particulars')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  {t('accountsCollections.applyTo', 'Target Instalment')}
                </label>
                <select
                  value={selectedInstalmentId}
                  onChange={(e) => {
                    setSelectedInstalmentId(e.target.value);
                    if (studentLedger && e.target.value) {
                      const inst = (studentLedger.instalments || []).find((i) => (i.id || i._id) === e.target.value);
                      if (inst) {
                        const rem = inst.outstanding ?? inst.remainingPaise ?? (inst.amount - inst.paid);
                        if (rem > 0) setAmountRupees((rem / 100).toString());
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="">Auto-allocate (FIFO: Oldest Unpaid Instalment First)</option>
                  {(studentLedger?.instalments || []).map((inst) => {
                    const rem = inst.outstanding ?? inst.remainingPaise ?? (inst.amount - inst.paid);
                    return (
                      <option key={inst.id || inst._id} value={inst.id || inst._id}>
                        Instalment #{inst.seq || inst.instalmentNumber} (Due: {formatDate(inst.dueDate)}) — Balance: {formatInr(rem)} [{inst.status}]
                      </option>
                    );
                  })}
                </select>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  If left unselected, payment is strictly auto-allocated to the earliest unpaid instalments in chronological order.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  {t('accountsCollections.amountInr', 'Amount to Collect (₹):')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="e.g. 30000"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'bold',
                    color: 'var(--color-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                    {t('accountsCollections.method', 'Payment Mode:')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  >
                    <option value="cash">Cash (Counter)</option>
                    <option value="cheque">Cheque / Demand Draft</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="pos">POS / Debit/Credit Card Machine</option>
                    <option value="bank_transfer">Direct Bank Transfer (NEFT/IMPS)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                    {t('accountsCollections.paidAt', 'Collection Date:')}
                  </label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
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
                  {t('accountsCollections.refNo', 'Instrument / UTR / Cheque Reference Number:')}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. CHQ-482019 or UPI-UTR-9912048"
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
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                  {t('accountsCollections.notes', 'Staff Remarks / Notes:')}
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal remarks for accounts reconciliation..."
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-sm)',
                    resize: 'vertical'
                  }}
                />
              </div>

              {formError && (
                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-2)', backgroundColor: '#fff5f5', borderRadius: 'var(--radius-sm)' }}>
                  ⚠️ {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/accounts/students')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Recording & Generating Receipt...' : 'Confirm & Issue GST Receipt'}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      )}

      {showReceiptModal && generatedReceipt && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            navigate(`/accounts/students/${selectedStudent.id || selectedStudent._id}`);
          }}
          title="Payment Successfully Recorded"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-4) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '32px' }}>✅</div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>
                {formatInr(generatedReceipt.totalPaise)}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Receipt No: <strong>{generatedReceipt.number}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Student:</span>
                <span style={{ fontWeight: '500' }}>{selectedStudent?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Taxable Subtotal:</span>
                <span>{formatInr(generatedReceipt.taxablePaise || generatedReceipt.baseAmountPaise)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>CGST (9%):</span>
                <span>{formatInr(generatedReceipt.cgstPaise)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>SGST (9%):</span>
                <span>{formatInr(generatedReceipt.sgstPaise)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', fontWeight: 'bold' }}>
                <span>Total Amount Received:</span>
                <span style={{ color: 'var(--color-success)' }}>{formatInr(generatedReceipt.totalPaise)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReceiptModal(false);
                  navigate(`/accounts/students/${selectedStudent.id || selectedStudent._id}`);
                }}
              >
                View Updated Ledger
              </Button>
              <Button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedStudent(null);
                  setStudentLedger(null);
                  setSelectedInstalmentId('');
                  setAmountRupees('');
                }}
              >
                Record Another Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
