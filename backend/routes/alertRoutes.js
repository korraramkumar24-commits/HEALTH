import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createManualAlert,
  createEmergencySOS,
  deleteAlert,
  listAlerts,
  updateAlert,
} from '../controllers/alertController.js';

const router = express.Router();

router.use(protect);
router.get('/', listAlerts);
router.post('/sos', authorizeRoles('patient'), createEmergencySOS);
router.post('/', authorizeRoles('doctor'), createManualAlert);
router.put('/:id', authorizeRoles('doctor', 'admin'), updateAlert);
router.delete('/:id', authorizeRoles('admin'), deleteAlert);

export default router;
