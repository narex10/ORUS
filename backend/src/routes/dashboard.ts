import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController';

const router = Router();

router.get('/:id', getDashboard);

export default router;
