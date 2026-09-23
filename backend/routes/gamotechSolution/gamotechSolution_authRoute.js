import { Router } from 'express';
import { login } from '../../controllers/gamotechSolution/gamotechSolution_authController.js';

const router = Router();
router.post('/auth/login', login);

export default router;
