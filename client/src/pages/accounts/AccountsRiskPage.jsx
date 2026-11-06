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
import { formatDate } from '../../utils/formatters';

export function AccountsRiskPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riskFlags, setRiskFlags] = useState([]);
  const [runningAssessment, setRunningAssessment] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Call Modal
  const [callingFlag, setCallingFlag] = useState(null);
  const [callNotes, setCallNotes] = useState('');
  const [callLoading, setCallLoading] = useState(false);

  // False Flag Modal
  const [falseFlaggingItem, setFalseFlaggingItem] = useState(null);
  const [falseFlagNotes, setFalseFlagNotes] = useState('');
  const [falseFlagLoading, setFalseFlagLoading] = useState(false);

  const fetchRiskFlags = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.accounts.getRiskFlags(params);
      const list = res.riskFlags || res.data || (Array.isArray(res) ? res : []);
      setRiskFlags(list);
    } catch (err) {
      setError(err.message || 'Failed to load risk queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskFlags();
  }, [statusFilter]);

  const handleRunAssessment = async () => {
    try {
      setRunningAssessment(true);
      const res = await api.accounts.triggerRiskAssessment();
      const count = res.summary?.flagged ?? res.summary?.evaluated ?? 0;
      toast.success(`Risk assessment completed. Evaluated ${count} students.`);
      fetchRiskFlags();
    } catch (err) {
      toast.error(err.message || 'Failed to run risk assessment');
    } finally {
      setRunningAssessment(false);
    }
  };

  const handleConfirmCall = async () => {
    if (!callingFlag) return;
    try {
      setCallLoading(true);
      await api.accounts.updateRiskFlag(callingFlag.id || callingFlag._id, {
        status: 'called',
        notes: callNotes.trim()
      });
      toast.success('Logged phone call with student/parent.');
      setCallingFlag(null);
      setCallNotes('');
      fetchRiskFlags();
    } catch (err) {
      toast.error(err.message || 'Failed to update flag');
    } finally {
      setCallLoading(false);
    }
  };

  const handleConfirmFalseFlag = async () => {
    if (!falseFlaggingItem || !falseFlagNotes.trim()) {
      toast.error('Notes explaining the false flag are mandatory.');
      return;
    }
    try {
      setFalseFlagLoading(true);
      await api.accounts.updateRiskFlag(falseFlaggingItem.id || falseFlaggingItem._id, {
        status: 'false_flag',
        notes: falseFlagNotes.trim()
      });
      toast.success('Marked as false flag. Student placed on 30-day cooldown.');
      setFalseFlaggingItem(null);
      setFalseFlagNotes('');
      fetchRiskFlags();
    } catch (err) {
      toast.error(err.message || 'Failed to mark as false flag');
    } finally {
      setFalseFlagLoading(false);
    }
  };

  const getScoreBand = (score = 0) => {
    if (score >= 70) return { band: 'High Risk', color: 'var(--color-danger)', bg: '#ffebee' };
    if (score >= 40) return { band: 'Medium Risk', color: '#e65100', bg: '#fff3e0' };
    return { band: 'Low Risk', color: 'var(--color-success)', bg: '#e8f5e9' };
  };

  const columns = [
    {
      key: 'student',
      header: t('accountsRisk.student', 'Student'),
      render: (r) => (
        <div>
          <div style={{ fontWeight: '500' }}>{r.studentId?.name || r.student?.name || r.studentName}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Roll: {r.studentId?.rollNumber || r.studentId?.studentId || 'N/A'} • {r.studentId?.centreId?.name || r.centreName || 'Jaipur'}
          </div>
        </div>
      )
    },
    {
      key: 'score',
      header: t('accountsRisk.score', 'Risk Score & Band'),
      align: 'center',
      render: (r) => {
        const conf = getScoreBand(r.score);
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 'bold',
              color: conf.color,
              backgroundColor: conf.bg
            }}
          >
            {r.score}/100 • {conf.band}
          </span>
        );
      }
    },
    {
      key: 'reasons',
      header: t('accountsRisk.reasons', 'Explainable Risk Factors'),
      render: (r) => {
        const factors = r.reasons || r.riskFactors || [];
        if (!factors.length) return <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Normal range</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {factors.map((f, i) => (
              <span
                key={i}
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {typeof f === 'string' ? f : f.message || f.factor}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: t('accountsRisk.status', 'Triage Status'),
      align: 'center',
      render: (r) => {
        const s = r.status || 'open';
        const color = s === 'called' ? 'var(--color-info)' : s === 'false_positive' || s === 'false_flag' ? 'var(--color-text-muted)' : 'var(--color-warning)';
        return (
          <span style={{ fontSize: '11px', fontWeight: 'bold', color, textTransform: 'uppercase' }}>
            {s === 'false_positive' ? 'false_flag' : s}
          </span>
        );
      }
    },
    {
      key: 'createdAt',
      header: t('accountsRisk.flaggedOn', 'Flagged On'),
      render: (r) => formatDate(r.createdAt || r.flaggedAt)
    },
    {
      key: 'actions',
      header: t('accountsRisk.actions', 'Counsellor Actions'),
      align: 'right',
      render: (r) => {
        if (r.status !== 'open') {
          return (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Resolved ({r.status})
            </span>
          );
        }
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              onClick={() => {
                setCallingFlag(r);
                setCallNotes('');
              }}
            >
              Log Call
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFalseFlaggingItem(r);
                setFalseFlagNotes('');
              }}
            >
              False Flag
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
            {t('accountsRisk.title', 'Early Dropout-Risk Triage Desk')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsRisk.subtitle', 'Multi-factor risk evaluation: fee defaults, attendance drops, and academic performance')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
            <option value="">All Triage Flags</option>
            <option value="open">Open / Action Required</option>
            <option value="called">Called & Mentored</option>
            <option value="false_positive">Dismissed (False Flag)</option>
          </select>

          <Button
            onClick={handleRunAssessment}
            disabled={runningAssessment}
          >
            <span>⚡</span>
            <span>{runningAssessment ? 'Evaluating...' : 'Run Risk Assessment'}</span>
          </Button>
        </div>
      </div>

      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#e8f4fd',
          border: '1px solid #bbdefb',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3)'
        }}
      >
        <span style={{ fontSize: '20px' }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)', color: '#0d47a1' }}>
            Strict Safety & Ethical Decoupling Guarantee
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: '#1565c0', marginTop: '2px', lineHeight: 1.5 }}>
            Dropout-risk scores are strictly informational triage signals for academic counsellors and pastoral care staff. Risk scores never alter fee plans, never add financial penalties to ledgers, and never trigger automated debt collection messages to parents.
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchRiskFlags} />}

      <Card>
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsRisk.loading', 'Loading risk triage queue...')} />
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={riskFlags}
            keyField="_id"
            emptyMessage={t('accountsRisk.empty', 'No students currently flagged in the triage queue.')}
          />
        )}
      </Card>

      {callingFlag && (
        <Modal
          isOpen={!!callingFlag}
          onClose={() => setCallingFlag(null)}
          title={`Log Pastoral Call — ${callingFlag.studentId?.name || callingFlag.studentName}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Record pastoral or counselling conversation notes with student or parent regarding academic engagement or fee assistance.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                Counsellor Interaction Notes:
              </label>
              <textarea
                rows="3"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="e.g. Spoke to parent; student was ill for 2 weeks; catching up on physics tests..."
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
              <Button variant="outline" onClick={() => setCallingFlag(null)}>
                Cancel
              </Button>
              <Button
                disabled={callLoading}
                onClick={handleConfirmCall}
              >
                {callLoading ? 'Saving...' : 'Save & Mark as Called'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {falseFlaggingItem && (
        <Modal
          isOpen={!!falseFlaggingItem}
          onClose={() => setFalseFlaggingItem(null)}
          title="Mark as False Flag"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Marking a flag as a false signal will suppress further dropout-risk alerts for this student for a <strong>30-day cooldown period</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                Mandatory Explanation / Justification: *
              </label>
              <textarea
                rows="3"
                required
                value={falseFlagNotes}
                onChange={(e) => setFalseFlagNotes(e.target.value)}
                placeholder="e.g. Approved leave for sports tournament; fees already committed by company sponsor..."
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
              <Button variant="outline" onClick={() => setFalseFlaggingItem(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!falseFlagNotes.trim() || falseFlagLoading}
                onClick={handleConfirmFalseFlag}
              >
                {falseFlagLoading ? 'Applying Cooldown...' : 'Confirm False Flag & Apply Cooldown'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
