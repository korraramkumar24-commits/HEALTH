import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  cancelAppointment,
  createAppointment,
  listAppointments,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.use(protect);
router.get('/', listAppointments);
router.post('/', authorizeRoles('doctor', 'admin'), createAppointment);
router.put('/:id/cancel', authorizeRoles('patient', 'doctor', 'admin'), cancelAppointment);

export default router;
