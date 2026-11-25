import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import { createNote, listNotes } from '../controllers/noteController.js';

const router = express.Router();

router.use(protect);
router.get('/', authorizeRoles('patient', 'doctor', 'admin'), listNotes);
router.post('/', authorizeRoles('doctor'), createNote);

export default router;
