import Asset from '../../models/gamotechSolution/gamotechSolution_asset.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createAssetHandlers } from '../../utils/createAssetHandlers.js';

export const {
  getAssets,
  createAsset,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
} = createAssetHandlers({ Asset, Employee });
