import { Router } from 'express';
import {
  getAssets,
  createAsset,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
} from '../../controllers/gamotechSolution/gamotechSolution_assetController.js';

const router = Router();

router.get('/assets', getAssets);
router.post('/assets', createAsset);
router.get('/assets/:id', getAssetById);
router.put('/assets/:id', updateAsset);
router.delete('/assets/:id', deleteAsset);
router.patch('/assets/:id/assign', assignAsset);

export default router;
