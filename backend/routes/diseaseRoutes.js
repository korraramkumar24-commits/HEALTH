import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import {
  createDisease,
  deleteDisease,
  listDiseases,
  updateDisease,
} from '../controllers/diseaseController.js';

const router = express.Router();
router.use(protect);
router.get('/', listDiseases);
router.post('/', authorizeRoles('admin'), createDisease);
router.put('/:id', authorizeRoles('admin'), updateDisease);
router.delete('/:id', authorizeRoles('admin'), deleteDisease);

export default router;
