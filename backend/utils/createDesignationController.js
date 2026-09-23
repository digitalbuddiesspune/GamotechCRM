import { buildDesignationPayload } from './designationFields.js';
import { cacheKey, withCache, invalidateTenantCache, CACHE_TTL } from './cache.js';

export const createDesignationController = (Designation, Employee, tenantId = 'shared') => {
  const attachEmployeeCounts = async (designations) => {
    return Promise.all(
      designations.map(async (d) => {
        const doc = typeof d.toObject === 'function' ? d.toObject() : d;
        const employeeCount = await Employee.countDocuments({ designation: doc._id });
        return { ...doc, employeeCount };
      })
    );
  };

  const bust = async () => {
    await invalidateTenantCache(tenantId, 'designations', 'dashboard');
  };

  const createDesignation = async (req, res) => {
    try {
      const payload = buildDesignationPayload(req.body);
      if (!payload.title) {
        return res.status(400).json({ message: 'Designation title is required' });
      }
      const existing = await Designation.findOne({ title: payload.title });
      if (existing) {
        return res.status(409).json({ message: 'Designation with this title already exists' });
      }
      const designation = await Designation.create(payload);
      await bust();
      res.status(201).json({ ...designation.toObject(), employeeCount: 0 });
    } catch (error) {
      res.status(500).json({ message: 'Error creating designation', error: error.message });
    }
  };

  const getDesignations = async (req, res) => {
    try {
      const filterParts = {
        active: req.query.active === 'true' ? '1' : '',
        department: String(req.query.department || '').trim(),
      };
      const key = cacheKey(tenantId, 'designations', filterParts);
      const { data } = await withCache(key, CACHE_TTL.designations, async () => {
        const filter = {};
        if (req.query.active === 'true') filter.isActive = true;
        if (req.query.department?.trim()) filter.department = req.query.department.trim();
        const designations = await Designation.find(filter).sort({ sortOrder: 1, title: 1 });
        return attachEmployeeCounts(designations);
      });
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching designations', error: error.message });
    }
  };

  const getDesignationById = async (req, res) => {
    try {
      const key = cacheKey(tenantId, 'designations', { id: req.params.id });
      const { data } = await withCache(key, CACHE_TTL.designations, async () => {
        const designation = await Designation.findById(req.params.id);
        if (!designation) return null;
        const [withCount] = await attachEmployeeCounts([designation]);
        return withCount;
      });
      if (!data) return res.status(404).json({ message: 'Designation not found' });
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching designation', error: error.message });
    }
  };

  const updateDesignation = async (req, res) => {
    try {
      const existing = await Designation.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Designation not found' });

      const payload = buildDesignationPayload({ ...existing.toObject(), ...req.body });
      if (!payload.title) {
        return res.status(400).json({ message: 'Designation title is required' });
      }

      const duplicate = await Designation.findOne({
        title: payload.title,
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'Another designation already uses this title' });
      }

      const updated = await Designation.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      });
      await bust();
      const [withCount] = await attachEmployeeCounts([updated]);
      res.status(200).json(withCount);
    } catch (error) {
      res.status(500).json({ message: 'Error updating designation', error: error.message });
    }
  };

  const deleteDesignation = async (req, res) => {
    try {
      const designation = await Designation.findById(req.params.id);
      if (!designation) return res.status(404).json({ message: 'Designation not found' });

      const employeeCount = await Employee.countDocuments({ designation: designation._id });
      if (employeeCount > 0) {
        return res.status(400).json({
          message: `Cannot delete designation assigned to ${employeeCount} employee(s)`,
          employeeCount,
        });
      }

      await Designation.findByIdAndDelete(req.params.id);
      await bust();
      res.status(200).json({ message: 'Designation deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting designation', error: error.message });
    }
  };

  return {
    createDesignation,
    getDesignations,
    getDesignationById,
    updateDesignation,
    deleteDesignation,
  };
};
