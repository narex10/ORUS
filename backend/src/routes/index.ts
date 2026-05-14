import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import authRouter from './auth';
import profilesRouter from './profiles';
import trackingRouter from './tracking';
import trackingKeysRouter from './trackingKeys';
import dashboardRouter from './dashboard';
import campaignsRouter from './campaigns';
import creativesRouter from './creatives';
import integrationsRouter from './integrations';
import audiencesRouter from './audiences';
import rulesRouter from './rules';
import syncRouter from './sync';
import metaActionsRouter from './metaActions';
import audienceFunnelRouter from './audienceFunnel';
import crmZapRouter from './crmZap';
import waInboundRouter from './waInbound';
import oauthRouter from './oauth';

const router = Router();

// Public
router.use('/auth', authRouter);
router.use('/tracking', trackingRouter);
router.use(waInboundRouter);

// Protected tracking key management
router.use('/tracking-keys', authenticate, trackingKeysRouter);

// Protected
router.use('/profiles', authenticate, profilesRouter);
router.use('/dashboard', authenticate, dashboardRouter);
router.use('/campaigns', authenticate, campaignsRouter);
router.use('/creatives', authenticate, creativesRouter);
router.use('/integrations', authenticate, integrationsRouter);
router.use('/audiences', authenticate, audiencesRouter);
router.use('/rules', authenticate, rulesRouter);
router.use('/sync', authenticate, syncRouter);
router.use('/meta', authenticate, metaActionsRouter);
router.use('/audience-funnel', authenticate, audienceFunnelRouter);
router.use('/crm-zap', authenticate, crmZapRouter);
router.use('/oauth', oauthRouter); // callback é público (sem authenticate)

export default router;
