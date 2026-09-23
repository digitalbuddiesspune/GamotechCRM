import ClientProfile from '../../models/gamotechSolution/gamotechSolution_clientProfile.js';
import Project from '../../models/gamotechSolution/gamotechSolution_project.js';
import { syncClientProfile } from '../../utils/gamotechSolution/gamotechSolution_clientProfileSync.js';

// Create client profile
export const createClientProfile = async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    if (payload.project) {
      const projectDoc = await Project.findById(payload.project).select('client').lean();
      if (!projectDoc) return res.status(404).json({ message: 'Project not found' });
      if (!payload.client) payload.client = projectDoc.client;
      if (payload.client?.toString() !== projectDoc.client?.toString()) {
        return res.status(400).json({ message: 'Selected project does not belong to the selected client' });
      }
    }
    if (!payload.client) return res.status(400).json({ message: 'Client is required' });

    const existing = await ClientProfile.findOne({ client: payload.client });
    if (existing) {
      return res.status(400).json({ message: 'Client profile already exists for this client' });
    }

    const created = new ClientProfile(payload);
    await created.save();
    await syncClientProfile({ clientId: payload.client, preferredProjectId: payload.project || null });

    const populated = await ClientProfile.findById(created._id)
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars');

    res.status(201).json({ message: 'Client profile created successfully', clientProfile: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error creating client profile', error });
  }
};

// Get all client profiles
export const getClientProfiles = async (req, res) => {
  try {
    const profiles = await ClientProfile.find()
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars')
      .sort({ createdAt: -1 });
    res.status(200).json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client profiles', error });
  }
};

// Get client profile by profile id
export const getClientProfileById = async (req, res) => {
  try {
    const profile = await ClientProfile.findById(req.params.id)
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars');
    if (!profile) return res.status(404).json({ message: 'Client profile not found' });
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client profile', error });
  }
};

// Get client profile by client id
export const getClientProfileByClientId = async (req, res) => {
  try {
    const profile = await ClientProfile.findOne({ client: req.params.clientId })
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars');
    if (!profile) return res.status(404).json({ message: 'Client profile not found' });
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client profile', error });
  }
};

// Update client profile
export const updateClientProfile = async (req, res) => {
  try {
    const updates = { ...(req.body || {}) };
    if (updates.project) {
      const projectDoc = await Project.findById(updates.project).select('client').lean();
      if (!projectDoc) return res.status(404).json({ message: 'Project not found' });
      if (!updates.client) updates.client = projectDoc.client;
      if (updates.client?.toString() !== projectDoc.client?.toString()) {
        return res.status(400).json({ message: 'Selected project does not belong to the selected client' });
      }
    }

    const updated = await ClientProfile.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars');
    if (!updated) return res.status(404).json({ message: 'Client profile not found' });
    await syncClientProfile({
      clientId: updated.client?._id || updated.client,
      preferredProjectId: updated.project?._id || updated.project || null,
    });
    const synced = await ClientProfile.findById(updated._id)
      .populate('client')
      .populate('project')
      .populate('socialMediaCalendars');
    res.status(200).json({ message: 'Client profile updated successfully', clientProfile: synced });
  } catch (error) {
    res.status(500).json({ message: 'Error updating client profile', error });
  }
};

// Delete client profile
export const deleteClientProfile = async (req, res) => {
  try {
    const deleted = await ClientProfile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Client profile not found' });
    res.status(200).json({ message: 'Client profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client profile', error });
  }
};

