import { Router } from 'express';
import {
  listProfiles,
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/profileController';

const router = Router();

router.get('/', listProfiles);
router.post('/', createProfile);
router.get('/:id', getProfile);
router.patch('/:id', updateProfile);
router.delete('/:id', deleteProfile);

export default router;
