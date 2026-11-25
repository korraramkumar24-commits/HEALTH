import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createHealthRecord,
  deleteHealthRecord,
  getHealthRecord,
  getHealthSummary,
  getLatestHealthRecord,
  listHealthRecords,
  updateHealthRecord,
} from '../controllers/healthController.js';

const router = express.Router();

router.use(protect);
router.get('/', listHealthRecords);
router.post('/', authorizeRoles('patient'), createHealthRecord);
router.get('/latest/:patientId', getLatestHealthRecord);
router.get('/summary/:patientId', getHealthSummary);
router.get('/:id', getHealthRecord);
router.put('/:id', authorizeRoles('patient'), updateHealthRecord);
router.delete('/:id', authorizeRoles('patient', 'admin'), deleteHealthRecord);

export default router;
