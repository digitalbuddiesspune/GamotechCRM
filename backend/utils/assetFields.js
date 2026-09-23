import mongoose from 'mongoose';

export const ASSET_TYPES = [
  'Laptop',
  'Desktop',
  'Mobile Phone',
  'SIM Card',
  'Access Card',
  'Monitor',
  'Other',
];

export const ASSET_STATUSES = ['Available', 'Assigned', 'Maintenance', 'Retired'];

export const getAssetSchemaFields = (employeeRef) => ({
  name: { type: String, required: true, trim: true },
  assetType: { type: String, enum: ASSET_TYPES, default: 'Other' },
  assetTag: { type: String, default: '', trim: true },
  serialNumber: { type: String, default: '', trim: true },
  brand: { type: String, default: '', trim: true },
  model: { type: String, default: '', trim: true },
  status: { type: String, enum: ASSET_STATUSES, default: 'Available' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: employeeRef, default: null },
  assignedAt: { type: Date, default: null },
  purchaseDate: { type: Date, default: null },
  warrantyExpiry: { type: Date, default: null },
  notes: { type: String, default: '' },
});
