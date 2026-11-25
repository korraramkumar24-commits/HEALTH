import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createDoctor,
  deleteDoctor,
  listDoctors,
  updateDoctor,
} from '../controllers/doctorController.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.route('/').get(listDoctors).post(createDoctor);
router.route('/:id').put(updateDoctor).delete(deleteDoctor);

export default router;
