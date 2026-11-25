import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import { getAdminDashboard, getDoctorDashboard } from '../controllers/dashboardController.js';
import { getPatientDashboard } from '../controllers/patientDashboardController.js';

const router = express.Router();

router.use(protect);
router.get('/doctor', authorizeRoles('doctor'), getDoctorDashboard);
router.get('/patient', authorizeRoles('patient'), getPatientDashboard);
router.get('/admin', authorizeRoles('admin'), getAdminDashboard);

export default router;
