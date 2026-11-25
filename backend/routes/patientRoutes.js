import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import ownershipMiddleware from '../middleware/ownershipMiddleware.js';
import {
  assignDoctor,
  createPatient,
  deletePatient,
  getMyPatient,
  getPatient,
  listPatients,
  updatePatient,
} from '../controllers/patientController.js';
import { getPatientOverview } from '../controllers/patientOverviewController.js';

const router = express.Router();
router.use(protect);
router.get('/', listPatients);
router.post('/', authorizeRoles('admin'), createPatient);
router.get('/me', authorizeRoles('patient'), getMyPatient);
router.put('/:id/assign-doctor', authorizeRoles('admin'), assignDoctor);
router.get('/:id/overview', authorizeRoles('doctor'), getPatientOverview);
router.get('/:id', ownershipMiddleware, getPatient);
router.put('/:id', ownershipMiddleware, updatePatient);
router.delete('/:id', authorizeRoles('admin'), ownershipMiddleware, deletePatient);

export default router;
