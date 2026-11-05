/** Deterministic counsellor-only risk score; never use this output for fee actions or parent messaging. */
export function scoreDropoutRisk({ instalments = [], attendance = [], testScores = [] }) {
  const overdueCount = instalments.filter(x => (x.outstanding ?? (x.amount - (x.discount ?? 0) - (x.paid ?? 0))) > 0 && x.daysOverdue > 0).length;
  const lateCount = instalments.filter(x => x.daysLate > 0).length;
  const paymentPoints = Math.min(50, overdueCount * 18 + lateCount * 8);
  const sortedAttendance = [...attendance].sort((a,b) => new Date(a.date) - new Date(b.date));
  const latest = sortedAttendance.slice(-28), previous = sortedAttendance.slice(-56, -28);
  const latestRate = latest.length ? latest.filter(x => x.present).length / latest.length : null;
  const previousRate = previous.length ? previous.filter(x => x.present).length / previous.length : null;
  let attendancePoints = 0, attendanceDropPct = 0;
  if (latestRate !== null && previousRate !== null && previousRate > 0) {
    attendanceDropPct = Math.max(0, (previousRate - latestRate) / previousRate * 100);
    attendancePoints = Math.min(30, attendanceDropPct * 0.75);
  }
  const tests = [...testScores].filter(x => Number.isFinite(x.score)).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-5);
  const scoreSlope = tests.length >= 2 ? tests.at(-1).score - tests[0].score : 0;
  const testPoints = Math.min(20, Math.max(0, -scoreSlope) * 0.5);
  const score = Math.max(0, Math.min(100, Math.round(paymentPoints + attendancePoints + testPoints)));
  const band = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
  const reasons = [];
  if (overdueCount) reasons.push(`${overdueCount} instalment${overdueCount === 1 ? '' : 's'} currently overdue`);
  if (lateCount && !overdueCount) reasons.push(`${lateCount} instalment${lateCount === 1 ? '' : 's'} paid late`);
  if (attendanceDropPct >= 5) reasons.push(`Attendance down ${Math.round(attendanceDropPct)}% versus the prior 4 weeks`);
  if (scoreSlope <= -5) reasons.push(`Test scores declined by ${Math.round(Math.abs(scoreSlope))} points across recent tests`);
  if (!reasons.length) reasons.push('No strong dropout-risk signals detected');
  return { score, band, reasons, components: { paymentPoints, attendancePoints: Math.round(attendancePoints), testPoints: Math.round(testPoints), attendanceDropPct: Math.round(attendanceDropPct), scoreSlope } };
}
