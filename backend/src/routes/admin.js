import { Router } from 'express';
import { loadAuthenticatedUser, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.get('/me', loadAuthenticatedUser, requireRole('admin', 'staff'), (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'RBAC access granted',
      user: {
        id: req.auth.userId,
        email: req.auth.email,
        fullName: req.auth.fullName,
        role: req.auth.role
      }
    }
  });
});
