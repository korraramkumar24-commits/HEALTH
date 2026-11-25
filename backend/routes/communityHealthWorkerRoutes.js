import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createCommunityHealthWorker,
  deactivateCommunityHealthWorker,
  listCommunityHealthWorkers,
  listNearbyCommunityHealthWorkers,
  updateCommunityHealthWorker,
} from '../controllers/communityHealthWorkerController.js';

const router = express.Router();

router.use(protect);
router.get('/nearby', authorizeRoles('patient'), listNearbyCommunityHealthWorkers);
router.get('/', authorizeRoles('admin'), listCommunityHealthWorkers);
router.post('/', authorizeRoles('admin'), createCommunityHealthWorker);
router.put('/:id', authorizeRoles('admin'), updateCommunityHealthWorker);
router.delete('/:id', authorizeRoles('admin'), deactivateCommunityHealthWorker);

export default router;
