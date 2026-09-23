import Collaborator from '../../models/gamotechSolution/gamotechSolution_collaborator.js';

export const createCollaborator = async (req, res) => {
  try {
    const {
      name,
      contactNo,
      email,
      city,
      state,
      pincode,
      rate,
      rateType,
      description,
      socialMediaLink,
      portfolioLink,
      individualType,
    } = req.body;

    const newCollaborator = new Collaborator({
      name: name || '',
      contactNo: contactNo || '',
      email: email || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      rate: rate != null && rate !== '' ? Number(rate) : null,
      rateType: rateType || '',
      description: description || '',
      socialMediaLink: socialMediaLink || '',
      portfolioLink: portfolioLink || '',
      individualType: individualType || '',
    });

    await newCollaborator.save();
    res.status(201).json({
      message: 'Collaborator created successfully',
      collaborator: newCollaborator,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating collaborator', error });
  }
};

export const getCollaborators = async (req, res) => {
  try {
    const { rateType, city, individualType } = req.query;
    const filter = {};

    if (rateType && rateType.trim()) filter.rateType = rateType.trim();
    if (city && city.trim()) filter.city = new RegExp(city.trim(), 'i');
    if (individualType && individualType.trim()) filter.individualType = individualType.trim();

    const collaborators = await Collaborator.find(filter).sort({ createdAt: -1 });
    res.status(200).json(collaborators);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching collaborators', error });
  }
};

export const getCollaboratorById = async (req, res) => {
  try {
    const collaborator = await Collaborator.findById(req.params.id);
    if (!collaborator) return res.status(404).json({ message: 'Collaborator not found' });
    res.status(200).json(collaborator);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching collaborator', error });
  }
};

export const updateCollaborator = async (req, res) => {
  try {
    const updates = req.body;
    if (updates.rate !== undefined && (updates.rate === '' || updates.rate == null)) {
      updates.rate = null;
    } else if (updates.rate !== undefined) {
      updates.rate = Number(updates.rate);
    }
    const updated = await Collaborator.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Collaborator not found' });
    res.status(200).json({ message: 'Collaborator updated', collaborator: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating collaborator', error });
  }
};

export const deleteCollaborator = async (req, res) => {
  try {
    const deleted = await Collaborator.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Collaborator not found' });
    res.status(200).json({ message: 'Collaborator deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting collaborator', error });
  }
};
