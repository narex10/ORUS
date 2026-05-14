import { Router } from 'express';
import { receiveConversion, getTrackingScript, getAdUrlStandard } from '../controllers/trackingController';

const router = Router();

router.get('/url-standard', getAdUrlStandard);
router.options('/url-standard', getAdUrlStandard);
router.post('/conversion', receiveConversion);
router.options('/conversion', receiveConversion);
router.get('/script/:key.js', getTrackingScript);

export default router;
