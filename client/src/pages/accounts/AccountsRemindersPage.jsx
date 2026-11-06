import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { toast } from '../../components/common/Toast';
import { formatDate, formatPhone } from '../../utils/formatters';

export function AccountsRemindersPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [triggering, setTriggering] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.accounts.getMessageLogs({ limit: 50 });
      const list = res.messageLogs || res.reminders || res.data || (Array.isArray(res) ? res : []);
      setLogs(list);
    } catch (err) {
      setError(err.message || 'Failed to load reminder logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRunReminderCycle = async () => {
    try {
      setTriggering(true);
      const res = await api.accounts.triggerReminders();
      const count = res.summary?.dispatched ?? res.summary?.created ?? 0;
      toast.success(`Reminder cycle completed. Processed ${count} reminder(s).`);
      fetchLogs();
    } catch (err) {
      toast.error(err.message || 'Failed to trigger reminder worker');
    } finally {
      setTriggering(false);
    }
  };

  const scheduleOffsets = [
    { offset: 'T-3 Days', type: 'Upcoming Due Reminder', channel: 'WhatsApp / SMS', timing: '3 days prior to instalment due date' },
    { offset: 'T Day', type: 'Due Date Alert', channel: 'WhatsApp / SMS', timing: 'Morning of due date (9:00 AM IST)' },
    { offset: 'T+3 Days', type: 'Overdue Follow-up 1', channel: 'WhatsApp / SMS', timing: '3 days after due date if unpaid' },
    { offset: 'T+7 Days', type: 'Overdue Follow-up 2', channel: 'WhatsApp / SMS', timing: '7 days after due date if unpaid' },
    { offset: 'T+15 Days', type: 'Critical Overdue Notice', channel: 'WhatsApp & SMS', timing: '15 days overdue with payment link' }
  ];

  const logColumns = [
    {
      key: 'recipient',
      header: t('accountsReminders.recipient', 'Recipient Phone'),
      render: (r) => (
        <div>
          <div style={{ fontWeight: '500' }}>{formatPhone(r.userId?.phone || r.phone || r.to)}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Student: {r.studentId?.name || r.studentName || 'Student'}
          </div>
        </div>
      )
    },
    {
      key: 'channel',
      header: t('accountsReminders.channel', 'Channel & Lang'),
      render: (r) => (
        <div>
          <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>
            {r.channel || 'whatsapp'}
          </span>
          <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            ({r.language === 'hi' ? 'हिन्दी' : 'English'})
          </span>
        </div>
      )
    },
    {
      key: 'offset',
      header: t('accountsReminders.offset', 'Cycle Offset'),
      render: (r) => r.template || (r.reminderId?.offsetDays ? `T${r.reminderId.offsetDays >= 0 ? '+' : ''}${r.reminderId.offsetDays}` : 'T-Day')
    },
    {
      key: 'body',
      header: t('accountsReminders.preview', 'Message Preview'),
      render: (r) => (
        <div style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {r.body || r.message || '—'}
        </div>
      )
    },
    {
      key: 'sentAt',
      header: t('accountsReminders.sentAt', 'Dispatched At'),
      render: (r) => formatDate(r.createdAt || r.sentAt)
    },
    {
      key: 'status',
      header: t('accountsReminders.status', 'Status'),
      align: 'center',
      render: (r) => {
        const s = r.status || 'delivered';
        const color = s === 'delivered' || s === 'sent' ? 'var(--color-success)' : 'var(--color-warning)';
        return (
          <span style={{ fontSize: '11px', fontWeight: 'bold', color, textTransform: 'uppercase' }}>
            {s}
          </span>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('accountsReminders.title', 'Automated Fee Reminders Engine')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {t('accountsReminders.subtitle', 'Multi-channel WhatsApp and SMS reminders dispatched at key schedule intervals')}
          </p>
        </div>

        <div>
          <Button
            onClick={handleRunReminderCycle}
            disabled={triggering}
          >
            <span>🔔</span>
            <span>{triggering ? 'Running Cycle...' : 'Run Reminder Cycle Now'}</span>
          </Button>
        </div>
      </div>

      <Card
        title={t('accountsReminders.scheduleConfig', 'Standard Multi-Stage Reminder Schedule')}
        subtitle={t('accountsReminders.scheduleSub', 'Automated notification policy configured per coaching fee guidelines')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          {scheduleOffsets.map((s, idx) => (
            <div
              key={idx}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                {s.offset}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '500', marginTop: '2px' }}>
                {s.type}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {s.timing}
              </div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {s.channel}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchLogs} />}

      <Card
        title={t('accountsReminders.recentLogs', 'Dispatched Reminders & Communication Log')}
        subtitle={t('accountsReminders.logsSub', 'Audit trail of recent automated notifications sent to parents')}
      >
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner text={t('accountsReminders.loading', 'Loading notification logs...')} />
          </div>
        ) : (
          <ResponsiveTable
            columns={logColumns}
            data={logs}
            keyField="_id"
            emptyMessage={t('accountsReminders.noLogs', 'No reminder messages have been sent yet.')}
          />
        )}
      </Card>
    </div>
  );
}
