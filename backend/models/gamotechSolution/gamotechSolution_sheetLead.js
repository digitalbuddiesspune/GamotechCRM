import mongoose from 'mongoose';
import { getSheetLeadSchemaFields } from '../../utils/sheetLeadFields.js';

const sheetLeadSchema = new mongoose.Schema(
  getSheetLeadSchemaFields('gamotechSolution_Employee', 'gamotechSolution_Lead'),
  { timestamps: true }
);

sheetLeadSchema.index(
  { metaLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: { metaLeadId: { $type: 'string', $gt: '' } },
  }
);

const SheetLead = mongoose.model('gamotechSolution_SheetLead', sheetLeadSchema, 'adsresearchglobal_sheetleads');
export default SheetLead;
