import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createMedication,
  getMedicationLogs,
  listMedications,
  logMedicationDose,
} from '../controllers/medicationController.js';

const router = express.Router();

router.use(protect);
router.get('/', listMedications);
router.post('/', authorizeRoles('doctor', 'admin'), createMedication);
router.post('/:id/log', authorizeRoles('patient'), logMedicationDose);
router.get('/:id/logs', authorizeRoles('patient', 'doctor', 'admin'), getMedicationLogs);

export default router;
