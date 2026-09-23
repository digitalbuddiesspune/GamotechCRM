import Company from '../../models/gamotechSolution/gamotechSolution_company.js';
import { cacheKey, withCache, invalidateTenantCache, CACHE_TTL } from '../../utils/cache.js';

const COMPANY_KEY = 'gamotechSolution';

export const createCompany = async (req, res) => {
  try {
    const company = new Company(req.body);
    await company.save();
    await invalidateTenantCache(COMPANY_KEY, 'company', 'dashboard');
    res.status(201).json({ message: 'Company created', company });
  } catch (error) {
    res.status(500).json({ message: 'Error creating company', error });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const key = cacheKey(COMPANY_KEY, 'company', { list: 'all' });
    const { data } = await withCache(key, CACHE_TTL.company, async () => {
      return Company.find().sort({ createdAt: -1 }).lean();
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching companies', error });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.status(200).json(company);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company', error });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    await invalidateTenantCache(COMPANY_KEY, 'company', 'dashboard');
    res.status(200).json({ message: 'Company updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Error updating company', error });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    await invalidateTenantCache(COMPANY_KEY, 'company', 'dashboard');
    res.status(200).json({ message: 'Company deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting company', error });
  }
};
