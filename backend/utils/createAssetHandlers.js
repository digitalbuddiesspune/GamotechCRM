import { ASSET_STATUSES, ASSET_TYPES } from './assetFields.js';

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizePayload = (body = {}) => {
  const payload = {
    name: String(body.name || '').trim(),
    assetType: ASSET_TYPES.includes(body.assetType) ? body.assetType : 'Other',
    assetTag: String(body.assetTag || '').trim(),
    serialNumber: String(body.serialNumber || '').trim(),
    brand: String(body.brand || '').trim(),
    model: String(body.model || '').trim(),
    status: ASSET_STATUSES.includes(body.status) ? body.status : 'Available',
    purchaseDate: toDate(body.purchaseDate),
    warrantyExpiry: toDate(body.warrantyExpiry),
    notes: String(body.notes || '').trim(),
  };

  if (body.assignedTo === null || body.assignedTo === '') {
    payload.assignedTo = null;
    payload.assignedAt = null;
    if (!body.status || body.status === 'Assigned') {
      payload.status = 'Available';
    }
  } else if (body.assignedTo) {
    payload.assignedTo = body.assignedTo;
    payload.assignedAt = new Date();
    payload.status = 'Assigned';
  }

  return payload;
};

export const createAssetHandlers = ({ Asset, Employee }) => {
  const populateAsset = (query) =>
    query
      .populate('assignedTo', 'name email employeeCode department profilePhoto')
      .sort({ updatedAt: -1 });

  const getAssets = async (req, res) => {
    try {
      const { status, employeeId, search, assetType } = req.query;
      const filter = {};

      if (status && ASSET_STATUSES.includes(status)) filter.status = status;
      if (assetType && ASSET_TYPES.includes(assetType)) filter.assetType = assetType;
      if (employeeId?.trim()) filter.assignedTo = employeeId.trim();

      if (search?.trim()) {
        const q = search.trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { assetTag: { $regex: q, $options: 'i' } },
          { serialNumber: { $regex: q, $options: 'i' } },
          { brand: { $regex: q, $options: 'i' } },
          { model: { $regex: q, $options: 'i' } },
        ];
      }

      const assets = await populateAsset(Asset.find(filter));
      res.status(200).json(assets);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching assets', error: error?.message });
    }
  };

  const createAsset = async (req, res) => {
    try {
      const payload = normalizePayload(req.body);
      if (!payload.name) {
        return res.status(400).json({ message: 'Asset name is required' });
      }

      if (payload.assignedTo) {
        const employee = await Employee.findById(payload.assignedTo).select('_id');
        if (!employee) return res.status(400).json({ message: 'Assigned employee not found' });
      }

      const asset = await Asset.create(payload);
      const populated = await populateAsset(Asset.findById(asset._id));
      res.status(201).json({ message: 'Asset created', asset: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error creating asset', error: error?.message });
    }
  };

  const getAssetById = async (req, res) => {
    try {
      const asset = await populateAsset(Asset.findById(req.params.id));
      if (!asset) return res.status(404).json({ message: 'Asset not found' });
      res.status(200).json(asset);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching asset', error: error?.message });
    }
  };

  const updateAsset = async (req, res) => {
    try {
      const existing = await Asset.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Asset not found' });

      const payload = normalizePayload({ ...existing.toObject(), ...req.body });

      if (payload.assignedTo) {
        const employee = await Employee.findById(payload.assignedTo).select('_id');
        if (!employee) return res.status(400).json({ message: 'Assigned employee not found' });
      }

      if (!payload.assignedTo && payload.status === 'Assigned') {
        payload.status = 'Available';
      }

      const updated = await Asset.findByIdAndUpdate(req.params.id, payload, { new: true });
      const populated = await populateAsset(Asset.findById(updated._id));
      res.status(200).json({ message: 'Asset updated', asset: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error updating asset', error: error?.message });
    }
  };

  const deleteAsset = async (req, res) => {
    try {
      const deleted = await Asset.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Asset not found' });
      res.status(200).json({ message: 'Asset deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting asset', error: error?.message });
    }
  };

  const assignAsset = async (req, res) => {
    try {
      const { employeeId } = req.body;
      const asset = await Asset.findById(req.params.id);
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      if (!employeeId) {
        asset.assignedTo = null;
        asset.assignedAt = null;
        if (asset.status === 'Assigned') asset.status = 'Available';
        await asset.save();
        const populated = await populateAsset(Asset.findById(asset._id));
        return res.status(200).json({ message: 'Asset unassigned', asset: populated });
      }

      const employee = await Employee.findById(employeeId).select('_id name');
      if (!employee) return res.status(400).json({ message: 'Employee not found' });

      asset.assignedTo = employee._id;
      asset.assignedAt = new Date();
      asset.status = 'Assigned';
      await asset.save();

      const populated = await populateAsset(Asset.findById(asset._id));
      res.status(200).json({ message: 'Asset assigned', asset: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error assigning asset', error: error?.message });
    }
  };

  return {
    getAssets,
    createAsset,
    getAssetById,
    updateAsset,
    deleteAsset,
    assignAsset,
  };
};
