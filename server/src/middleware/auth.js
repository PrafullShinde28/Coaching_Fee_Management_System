import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, Student } from '../models/index.js';
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id role phone language consent isActive');
    if (!user?.isActive) return res.status(401).json({ error: 'Session is no longer valid' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
}
export const requireRole = (...roles) => (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' });
export async function requireStudentAccess(req,res,next) {
  const student = await Student.findById(req.params.studentId).select('_id parentUserId');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.user.role === 'parent' && String(student.parentUserId) !== String(req.user._id)) return res.status(403).json({ error: 'You cannot access this student' });
  req.student = student; next();
}
