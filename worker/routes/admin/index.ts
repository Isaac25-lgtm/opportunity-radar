import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { requireAdmin } from '../../lib/auth';
import { opportunityAdminRoutes } from './opportunities';
import { overviewRoutes } from './overview';
import { settingsRoutes } from './settings';
import { sourceRoutes } from './sources';

/** Admin API. Every route below requires an authenticated administrator. */
export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', async (c, next) => {
  requireAdmin(c);
  await next();
});

adminRoutes.route('/', overviewRoutes);
adminRoutes.route('/', sourceRoutes);
adminRoutes.route('/', opportunityAdminRoutes);
adminRoutes.route('/', settingsRoutes);
