import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  getProjectDashboard,
  updateProject,
  deleteProject,
  getProjectStatsByMonth,
  getMyProjects,
} from '../../controllers/gamotechSolution/gamotechSolution_projectController.js';

const router = Router();

router.get('/projects/stats/by-month', getProjectStatsByMonth);
router.get('/projects/my-projects', getMyProjects);
router.get('/projects', getProjects);
router.post('/projects', createProject);
router.get('/projects/:id/dashboard', getProjectDashboard);
router.get('/projects/:id', getProjectById);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

export default router;
