import mongoose from 'mongoose';
import { getDesignationFields } from '../../utils/designationFields.js';

const designationSchema = new mongoose.Schema(
  {
    ...getDesignationFields(),
  },
  { timestamps: true }
);

designationSchema.index({ isActive: 1, sortOrder: 1 });

const Designation = mongoose.model('gamotechSolution_Designation', designationSchema, 'adsresearchglobal_designations');
export default Designation;
