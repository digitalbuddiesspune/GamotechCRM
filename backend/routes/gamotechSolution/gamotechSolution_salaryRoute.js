import { Router } from 'express';
import {
  createSalary,
  getSalaries,
  getSalaryById,
  updateSalary,
  deleteSalary,
} from '../../controllers/gamotechSolution/gamotechSolution_salaryController.js';

const router = Router();

router.get('/salaries', getSalaries);
router.post('/salaries', createSalary);
router.get('/salaries/:id', getSalaryById);
router.put('/salaries/:id', updateSalary);
router.delete('/salaries/:id', deleteSalary);

export default router;
