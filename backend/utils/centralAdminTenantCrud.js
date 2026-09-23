import bcrypt from 'bcryptjs';

const importTenantModel = async (tenantId, suffix) => {
  try {
    return (await import(`../models/${tenantId}/${tenantId}_${suffix}.js`)).default;
  } catch {
    return null;
  }
};

const stripMeta = (body = {}) => {
  const payload = { ...body };
  delete payload._id;
  delete payload.__v;
  delete payload.createdAt;
  delete payload.updatedAt;
  return payload;
};

const normalizeProjectPayload = (body = {}) => {
  const normalized = stripMeta(body);
  for (const field of ['projectManager', 'endDate', 'deadline']) {
    if (normalized[field] === '') normalized[field] = null;
  }
  if (normalized.client === '') normalized.client = null;
  if (!Array.isArray(normalized.teamMembers)) normalized.teamMembers = [];
  normalized.teamMembers = normalized.teamMembers.filter(Boolean);
  return normalized;
};

const trySyncClientProfile = async (tenantId, clientId, preferredProjectId) => {
  if (!clientId) return;
  try {
    const mod = await import(`../utils/${tenantId}/${tenantId}_clientProfileSync.js`);
    if (typeof mod.syncClientProfile === 'function') {
      await mod.syncClientProfile({ clientId, preferredProjectId });
    }
  } catch {
    // Optional per-tenant hook — safe to skip.
  }
};

export const createTenantClientRecord = async (tenantId, body) => {
  const Client = await importTenantModel(tenantId, 'client');
  if (!Client) throw Object.assign(new Error('Clients not available for this company'), { status: 404 });

  const payload = stripMeta(body);
  const client = new Client({
    clientName: payload.clientName,
    clientNumber: payload.clientNumber,
    mailId: payload.mailId,
    businessType: payload.businessType,
    services: payload.services || [],
    date: payload.date,
    clientType: payload.clientType || 'Recurring',
    clientCategory: payload.clientCategory || 'Marketing',
    projectEndDate: payload.clientType === 'Non Recurring' ? payload.projectEndDate : undefined,
    address: payload.address,
    city: payload.city || '',
    state: payload.state || '',
    pincode: payload.pincode || '',
    onboardBy: payload.onboardBy || null,
    status: payload.status || 'Active',
  });
  await client.save();
  const populated = await Client.findById(client._id).populate('onboardBy').lean();
  return populated;
};

export const updateTenantClientRecord = async (tenantId, clientId, body) => {
  const Client = await importTenantModel(tenantId, 'client');
  if (!Client) throw Object.assign(new Error('Clients not available for this company'), { status: 404 });

  const updates = stripMeta(body);
  if (updates.clientType === 'Recurring') updates.projectEndDate = undefined;

  const updated = await Client.findByIdAndUpdate(clientId, updates, { new: true, runValidators: true })
    .populate('onboardBy')
    .lean();
  if (!updated) throw Object.assign(new Error('Client not found'), { status: 404 });
  return updated;
};

export const createTenantProjectRecord = async (tenantId, body) => {
  const Project = await importTenantModel(tenantId, 'project');
  if (!Project) throw Object.assign(new Error('Projects not available for this company'), { status: 404 });

  const payload = normalizeProjectPayload(body);
  const project = new Project({
    projectName: payload.projectName,
    department: payload.department || 'IT',
    client: payload.client || null,
    description: payload.description,
    status: payload.status || 'Not Started',
    priority: payload.priority || 'Medium',
    startDate: payload.startDate,
    endDate: payload.endDate,
    deadline: payload.deadline,
    budget: payload.budget,
    progress: payload.progress ?? 0,
    projectManager: payload.projectManager || null,
    teamMembers: payload.teamMembers || [],
    services: payload.services || [],
    notes: payload.notes,
  });
  await project.save();
  if (payload.client) await trySyncClientProfile(tenantId, payload.client, project._id);

  const populated = await Project.findById(project._id)
    .populate('client', 'clientName mailId clientNumber')
    .populate('projectManager', 'name email')
    .populate('teamMembers', 'name email')
    .lean();
  return populated;
};

export const updateTenantProjectRecord = async (tenantId, projectId, body) => {
  const Project = await importTenantModel(tenantId, 'project');
  if (!Project) throw Object.assign(new Error('Projects not available for this company'), { status: 404 });

  const previous = await Project.findById(projectId).select('client').lean();
  const payload = normalizeProjectPayload(body);
  const updated = await Project.findByIdAndUpdate(projectId, payload, { new: true, runValidators: true })
    .populate('client', 'clientName mailId clientNumber')
    .populate('projectManager', 'name email')
    .populate('teamMembers', 'name email')
    .lean();
  if (!updated) throw Object.assign(new Error('Project not found'), { status: 404 });

  const prevClient = previous?.client?._id || previous?.client;
  const nextClient = updated?.client?._id || updated?.client;
  if (prevClient) await trySyncClientProfile(tenantId, prevClient, updated._id);
  if (nextClient) await trySyncClientProfile(tenantId, nextClient, updated._id);
  return updated;
};

export const createTenantLeadRecord = async (tenantId, body) => {
  const Lead = await importTenantModel(tenantId, 'lead');
  if (!Lead) throw Object.assign(new Error('Leads not available for this company'), { status: 404 });

  const payload = stripMeta(body);
  const lead = new Lead(payload);
  await lead.save();

  let query = Lead.findById(lead._id).populate('generatedBy', 'name email');
  if (['bangarProperties', 'mahaProperties', 'salesTechReality'].includes(tenantId)) {
    query = query.populate('assignedTo', 'name email').populate('siteCoordinator', 'name email');
  }
  return query.lean();
};

export const updateTenantLeadRecord = async (tenantId, leadId, body) => {
  const Lead = await importTenantModel(tenantId, 'lead');
  if (!Lead) throw Object.assign(new Error('Leads not available for this company'), { status: 404 });

  const lead = await Lead.findById(leadId);
  if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });

  const payload = stripMeta(body);
  const { followUps, ...rest } = payload;
  Object.assign(lead, rest);

  if (Array.isArray(followUps)) {
    lead.followUps = followUps.map((fu) => ({
      comments: String(fu.comments ?? fu.text ?? '').trim(),
      date: fu.date ? new Date(fu.date) : new Date(),
      ...(fu._id ? { _id: fu._id } : {}),
    }));
    lead.markModified('followUps');
  }

  await lead.save();
  let query = Lead.findById(lead._id).populate('generatedBy', 'name email');
  if (['bangarProperties', 'mahaProperties', 'salesTechReality'].includes(tenantId)) {
    query = query.populate('assignedTo', 'name email').populate('siteCoordinator', 'name email');
  }
  return query.lean();
};

export { importTenantModel, bcrypt };
