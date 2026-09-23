import { Router } from 'express';
import {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../../controllers/gamotechSolution/gamotechSolution_companyController.js';
import Company from '../../models/gamotechSolution/gamotechSolution_company.js';
import { createCompanyProfileHandlers } from '../../utils/createCompanyProfileHandlers.js';

const router = Router();
const { getCompanyProfile, upsertCompanyProfile } = createCompanyProfileHandlers({ Company });

router.get('/company-profile', getCompanyProfile);
router.put('/company-profile', upsertCompanyProfile);
router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.get('/companies/:id', getCompanyById);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);

export default router;
