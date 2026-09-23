import mongoose from 'mongoose';
import { getQuotationFields } from '../../utils/quotationFields.js';

const quotationSchema = new mongoose.Schema(getQuotationFields('gamotechSolution'), { timestamps: true });

const Quotation = mongoose.model('gamotechSolution_Quotation', quotationSchema, 'adsresearchglobal_quotations');
export default Quotation;
