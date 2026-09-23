import { endOfBusinessDay, startOfBusinessDay } from './businessTime.js';

const isSalesDepartment = (value = '') =>
  /sales/i.test(String(value || '').trim());

const normalizeDesignationKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const isTeamLeaderDesignation = (designation) => {
  if (!designation) return false;
  if (String(designation.accessRole || '').trim() === 'team_leader') return true;
  const title = String(designation.title || designation.name || '').toLowerCase();
  return title.includes('team leader') || title.includes('team lead') || title.includes('sales team lead');
};

/** Lead distribution recipients — Sales Executive only (not Site Co-ordinator, managers, etc.). */
export const isSalesExecutiveDesignation = (designation) => {
  if (!designation) return false;
  const key = normalizeDesignationKey(designation.title || designation.name || '');
  return key.includes('salesexecutive');
};

/**
 * Split `items` into `bucketCount` arrays as evenly as possible.
 * Remainder (odd extras) go to the first buckets (+1 each).
 */
export const splitEvenly = (items = [], bucketCount = 1) => {
  const n = Math.max(1, Number(bucketCount) || 1);
  const list = Array.isArray(items) ? [...items] : [];
  const buckets = Array.from({ length: n }, () => []);
  if (!list.length) return buckets;

  const base = Math.floor(list.length / n);
  const rem = list.length % n;
  let cursor = 0;
  for (let i = 0; i < n; i += 1) {
    const size = base + (i < rem ? 1 : 0);
    buckets[i] = list.slice(cursor, cursor + size);
    cursor += size;
  }
  return buckets;
};

export const findSalesTeamLeaders = async (Employee) => {
  const employees = await Employee.find({ status: 'Active' })
    .populate('designation', 'title accessRole department')
    .select('name email department designation reportingManager status')
    .sort({ name: 1 });

  return employees.filter(
    (emp) => isSalesDepartment(emp.department) && isTeamLeaderDesignation(emp.designation)
  );
};

export const findTeamMembersForLeader = async (Employee, teamLeaderId) => {
  const members = await Employee.find({
    status: 'Active',
    reportingManager: teamLeaderId,
  })
    .populate('designation', 'title name accessRole')
    .select('name email department designation reportingManager status')
    .sort({ name: 1 });

  // Only Sales Executives in the Sales department receive distributed leads.
  return members.filter(
    (m) => isSalesDepartment(m.department) && isSalesExecutiveDesignation(m.designation)
  );
};

export const buildLeadDistributionPlan = async ({
  Lead,
  Employee,
  date,
  leadIds,
}) => {
  const dayStart = startOfBusinessDay(date || new Date());
  const dayEnd = endOfBusinessDay(date || new Date());

  const leadFilter = {
    $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
  };

  if (Array.isArray(leadIds) && leadIds.length) {
    leadFilter._id = { $in: leadIds };
  } else {
    leadFilter.createdAt = { $gte: dayStart, $lt: dayEnd };
  }

  const [leads, teamLeaders] = await Promise.all([
    Lead.find(leadFilter).sort({ createdAt: 1 }).select('_id name contactNumber createdAt'),
    findSalesTeamLeaders(Employee),
  ]);

  if (!teamLeaders.length) {
    const error = new Error(
      'No Sales Team Leaders found. Ensure Active employees in Sales department have Team Leader designation/access role.'
    );
    error.statusCode = 400;
    throw error;
  }

  const leadersWithMembers = [];
  for (const tl of teamLeaders) {
    const members = await findTeamMembersForLeader(Employee, tl._id);
    if (members.length) {
      leadersWithMembers.push({ tl, members });
    }
  }

  if (!leadersWithMembers.length) {
    const error = new Error(
      'No Sales Executives found under Sales Team Leaders. Leads are only distributed to Active employees with designation Sales Executive.'
    );
    error.statusCode = 400;
    throw error;
  }

  if (!leads.length) {
    return {
      totalLeads: 0,
      teamLeaderCount: leadersWithMembers.length,
      dayStart,
      dayEnd,
      assignments: [],
      plan: leadersWithMembers.map(({ tl, members }) => ({
        teamLeader: { _id: tl._id, name: tl.name, email: tl.email },
        leadCount: 0,
        members: members.map((m) => ({
          employee: { _id: m._id, name: m.name, email: m.email },
          leadCount: 0,
          leadIds: [],
        })),
      })),
    };
  }

  const leaderBuckets = splitEvenly(leads, leadersWithMembers.length);
  const plan = [];
  const assignments = [];

  for (let i = 0; i < leadersWithMembers.length; i += 1) {
    const { tl, members } = leadersWithMembers[i];
    const bucket = leaderBuckets[i] || [];

    const memberBuckets = splitEvenly(bucket, members.length);
    const memberPlan = members.map((member, idx) => {
      const memberLeads = memberBuckets[idx] || [];
      for (const lead of memberLeads) {
        assignments.push({
          leadId: lead._id,
          assignedTo: member._id,
          assignedTeamLeader: tl._id,
        });
      }
      return {
        employee: { _id: member._id, name: member.name, email: member.email },
        leadCount: memberLeads.length,
        leadIds: memberLeads.map((l) => l._id),
      };
    });

    plan.push({
      teamLeader: { _id: tl._id, name: tl.name, email: tl.email },
      leadCount: bucket.length,
      members: memberPlan,
    });
  }

  return {
    totalLeads: leads.length,
    teamLeaderCount: leadersWithMembers.length,
    dayStart,
    dayEnd,
    plan,
    assignments,
  };
};

export const applyLeadDistribution = async ({
  Lead,
  assignments,
  distributedBy,
  now = new Date(),
}) => {
  if (!assignments?.length) return { updated: 0 };

  const ops = assignments.map((row) => ({
    updateOne: {
      filter: {
        _id: row.leadId,
        $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
      },
      update: {
        $set: {
          assignedTo: row.assignedTo,
          assignedTeamLeader: row.assignedTeamLeader,
          assignedAt: now,
          distributedBy: distributedBy || null,
        },
      },
    },
  }));

  const result = await Lead.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || 0 };
};
