import express from 'express';
import protect from '../middleware/authMiddleware.js';
import authorizeRoles from '../middleware/roleMiddleware.js';
import { deleteUser, listUsers, updateUser } from '../controllers/userController.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.get('/', listUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
