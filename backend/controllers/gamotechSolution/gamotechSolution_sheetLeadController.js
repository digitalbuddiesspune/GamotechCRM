import SheetLead from '../../models/gamotechSolution/gamotechSolution_sheetLead.js';
import Lead from '../../models/gamotechSolution/gamotechSolution_lead.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createSheetLeadImportHandlers } from '../../utils/createSheetLeadImportHandlers.js';

export const sheetLeadHandlers = createSheetLeadImportHandlers({
  SheetLead,
  Lead,
  Employee,
  tenantKey: 'gamotechSolution',
});
