import { Router } from 'express';
import { getCitiesByState, getStates } from '../../controllers/gamotechSolution/gamotechSolution_locationController.js';

const router = Router();

router.get('/locations/states', getStates);
router.get('/locations/cities', getCitiesByState);

export default router;

