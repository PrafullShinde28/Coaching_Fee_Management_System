import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { ErrorState } from '../../components/common/ErrorState';
import { formatInr } from '../../utils/formatters';

export function StudentDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [student, setStudent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStudent() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.parent.getStudentLedger(studentId);
        setStudent(res.student);
        setSummary(res.summary);
      } catch (err) {
        setError(err.message || 'Unable to load student profile');
      } finally {
        setLoading(false);
      }
    }
    loadStudent();
  }, [studentId]);

  if (loading) {
    return <SkeletonLoader type="card" count={2} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (!student) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {student.name}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            ID: {student.studentId} • Centre: {student.centre?.name || 'Jaipur'}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate(`/parent/children/${studentId}/fees`)}>
          {t('student.viewFees', 'View Fee Ledger')} →
        </Button>
      </div>

      <Card title="Student Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Status</span>
            <div style={{ marginTop: 'var(--space-1)' }}><Badge status={student.status} /></div>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Batch</span>
            <div style={{ fontWeight: 'var(--font-weight-medium)', marginTop: 'var(--space-1)' }}>{student.batch?.name || 'Standard'}</div>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Total Course Fee</span>
            <div style={{ fontWeight: 'var(--font-weight-medium)', marginTop: 'var(--space-1)' }}>{formatInr(summary?.total || 0)}</div>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Outstanding Due</span>
            <div style={{ fontWeight: 'var(--font-weight-bold)', color: (summary?.outstanding || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)', marginTop: 'var(--space-1)' }}>
              {formatInr(summary?.outstanding || 0)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
