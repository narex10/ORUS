import { Router } from 'express';
import { receiveConversion, getTrackingScript } from '../controllers/trackingController';

const router = Router();

router.post('/conversion', receiveConversion);
router.options('/conversion', receiveConversion);
router.get('/script/:key.js', getTrackingScript);

export default router;
