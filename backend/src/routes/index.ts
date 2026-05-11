import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import authRouter from './auth';
import profilesRouter from './profiles';
import trackingRouter from './tracking';
import dashboardRouter from './dashboard';
import campaignsRouter from './campaigns';
import integrationsRouter from './integrations';
import audiencesRouter from './audiences';
import rulesRouter from './rules';
import syncRouter from './sync';

const router = Router();

// Public
router.use('/auth', authRouter);
router.use('/tracking', trackingRouter);

// Protected
router.use('/profiles', authenticate, profilesRouter);
router.use('/dashboard', authenticate, dashboardRouter);
router.use('/campaigns', authenticate, campaignsRouter);
router.use('/integrations', authenticate, integrationsRouter);
router.use('/audiences', authenticate, audiencesRouter);
router.use('/rules', authenticate, rulesRouter);
router.use('/sync', authenticate, syncRouter);

export default router;
