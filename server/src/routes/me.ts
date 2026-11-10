import { Router } from 'express';
import { permissionsOf } from '@cozam/shared';
import { authenticate } from '../middleware/auth.js';

export const meRouter = Router();

meRouter.get('/me', authenticate, (req, res) => {
  const user = req.user!;
  const permissions = Array.from(permissionsOf(user));

  res.json({
    profile: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      extra_permissions: user.extra_permissions,
      active: user.active,
    },
    permissions,
  });
});
