import mongoose from 'mongoose';
import { getAssetSchemaFields } from '../../utils/assetFields.js';

const assetSchema = new mongoose.Schema(
  getAssetSchemaFields('gamotechSolution_Employee'),
  { timestamps: true }
);

const Asset = mongoose.model('gamotechSolution_Asset', assetSchema, 'adsresearchglobal_assets');
export default Asset;
