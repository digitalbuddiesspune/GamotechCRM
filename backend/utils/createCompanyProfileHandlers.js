const emptyProfile = () => ({
  companyLogo: '',
  companyStamp: '',
  authorizedSignature: '',
  companyName: '',
  workingHours: '9 AM - 6 PM',
  breakTimeMinutes: 45,
  address: '',
  website: '',
  pan: '',
  phone: '',
  gstin: '',
  gstCode: '',
  state: '',
  email: '',
  bankName: '',
  bankAccountNumber: '',
  personalAccounts: [],
});

export const createCompanyProfileHandlers = ({ Company }) => {
  const getPrimaryCompany = async () => Company.findOne().sort({ createdAt: 1 });

  const getCompanyProfile = async (req, res) => {
    try {
      const company = await getPrimaryCompany();
      if (!company) {
        return res.status(200).json(emptyProfile());
      }
      res.status(200).json(company);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching company profile', error: error?.message || error });
    }
  };

  const upsertCompanyProfile = async (req, res) => {
    try {
      const existing = await getPrimaryCompany();
      if (existing) {
        const company = await Company.findByIdAndUpdate(existing._id, req.body, {
          new: true,
          runValidators: true,
        });
        return res.status(200).json({ message: 'Company profile updated', company });
      }
      const company = new Company(req.body);
      await company.save();
      res.status(201).json({ message: 'Company profile created', company });
    } catch (error) {
      res.status(500).json({ message: 'Error saving company profile', error: error?.message || error });
    }
  };

  return { getCompanyProfile, upsertCompanyProfile };
};
