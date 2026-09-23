import mongoose from 'mongoose';
import { getDocumentFields } from '../../utils/documentFields.js';

const documentSchema = new mongoose.Schema(getDocumentFields('gamotechSolution'), { timestamps: true });

const Document = mongoose.model('gamotechSolution_Document', documentSchema, 'adsresearchglobal_documents');
export default Document;
