import { Student, Instalment, Attendance, TestScore, RiskFlag } from '../models/index.js';
import { scoreDropoutRisk } from '../domain/risk-scorer.js';
import { calculateInstalmentStatus } from '../domain/instalment.js';
import { clock } from '../config/clock.js';

/**
 * Evaluate dropout risk for a single student using Phase 2 deterministic heuristic.
 */
export async function evaluateStudentRisk(studentId) {
  const student = await Student.findById(studentId);
  if (!student) throw new Error(`Student ${studentId} not found`);

  const instalments = await Instalment.find({ studentId: student._id });
  const today = clock.today();
  const enrichedInstalments = instalments.map(inst => {
    const derived = calculateInstalmentStatus(inst, today);
    return {
      amount: inst.amount,
      discount: inst.discount,
      paid: inst.paid,
      dueDate: inst.dueDate,
      outstanding: derived.outstanding,
      daysOverdue: derived.daysOverdue
    };
  });

  const attendance = await Attendance.find({ studentId: student._id }).sort({ date: 1 });
  const testScores = await TestScore.find({ studentId: student._id }).sort({ date: 1 });

  const result = scoreDropoutRisk({
    instalments: enrichedInstalments,
    attendance,
    testScores
  });

  return {
    studentId: student._id,
    evaluatedAt: clock.now(),
    ...result
  };
}

/**
 * Run risk evaluation across all active students.
 * - Respects 30-day false_flag cooldown.
 * - Prevents duplicate open flags by updating existing open flag.
 * - Enforces safety rule: never performs fee, payment, or messaging actions.
 */
export async function evaluateAllStudentsRisk() {
  const activeStudents = await Student.find({ status: 'active' });

  let studentsEvaluated = 0;
  let flagsCreated = 0;
  let flagsUpdated = 0;
  let cooldownSuppressed = 0;
  let lowRiskSkipped = 0;

  const now = clock.now();

  for (const student of activeStudents) {
    studentsEvaluated += 1;

    // Check 30-day false_flag cooldown
    const latestFalseFlag = await RiskFlag.findOne({
      studentId: student._id,
      status: 'false_flag'
    }).sort({ createdAt: -1 });

    if (latestFalseFlag && latestFalseFlag.cooldownUntil && latestFalseFlag.cooldownUntil > now) {
      cooldownSuppressed += 1;
      continue;
    }

    const evaluation = await evaluateStudentRisk(student._id);

    // Only flag students in medium or high risk bands
    if (evaluation.band === 'high' || evaluation.band === 'medium') {
      const openFlag = await RiskFlag.findOne({ studentId: student._id, status: 'open' });
      if (openFlag) {
        openFlag.score = evaluation.score;
        openFlag.band = evaluation.band;
        openFlag.reasons = evaluation.reasons;
        await openFlag.save();
        flagsUpdated += 1;
      } else {
        await RiskFlag.create({
          studentId: student._id,
          score: evaluation.score,
          band: evaluation.band,
          reasons: evaluation.reasons,
          status: 'open'
        });
        flagsCreated += 1;
      }
    } else {
      lowRiskSkipped += 1;
    }
  }

  return {
    studentsEvaluated,
    flagsCreated,
    flagsUpdated,
    cooldownSuppressed,
    lowRiskSkipped
  };
}

/**
 * Mark a counsellor call completed.
 */
export async function markRiskFlagCalled(flagId, notes = '') {
  const flag = await RiskFlag.findById(flagId);
  if (!flag) return null;

  flag.status = 'called';
  if (notes) {
    flag.notes = flag.notes ? `${flag.notes}\n${notes}` : notes;
  }
  await flag.save();
  return flag;
}

/**
 * Mark a risk flag as a false positive and activate 30-day cooldown.
 */
export async function markRiskFlagFalsePositive(flagId, notes) {
  const flag = await RiskFlag.findById(flagId);
  if (!flag) return null;

  flag.status = 'false_flag';
  flag.notes = notes;
  // 30 days cooldown:
  flag.cooldownUntil = new Date(clock.now().getTime() + 30 * 86_400_000);
  await flag.save();
  return flag;
}
