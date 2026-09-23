import Quotation from '../../models/gamotechSolution/gamotechSolution_quotation.js';
import { createQuotationController } from '../../utils/createQuotationController.js';

export const {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
} = createQuotationController(Quotation);
