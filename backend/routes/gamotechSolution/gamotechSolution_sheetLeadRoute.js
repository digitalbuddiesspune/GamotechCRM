import { Router } from 'express';
import { sheetLeadHandlers } from '../../controllers/gamotechSolution/gamotechSolution_sheetLeadController.js';

const router = Router();
const { importCsv, getSheetLeads } = sheetLeadHandlers;

router.post('/leads/import-csv', importCsv);
router.get('/sheet-leads', getSheetLeads);

export default router;
