import {
  applyLeadDistribution,
  buildLeadDistributionPlan,
} from './distributeSalesLeads.js';
import { assertCanManageLeads, resolveLeadAccess } from './leadAccess.js';

export function createLeadDistributionHandlers({ Lead, Employee }) {
  const previewDistribution = async (req, res) => {
    try {
      const actorId =
        req.query.actorId || req.query.viewerId || req.body?.actorId || req.body?.distributedBy;
      const access = await resolveLeadAccess(Employee, actorId);
      assertCanManageLeads(access);

      const date = req.query.date || req.body?.date || new Date();
      const leadIds = req.body?.leadIds;
      const plan = await buildLeadDistributionPlan({
        Lead,
        Employee,
        date,
        leadIds,
      });
      res.status(200).json({
        message: 'Lead distribution preview',
        totalLeads: plan.totalLeads,
        teamLeaderCount: plan.teamLeaderCount,
        dayStart: plan.dayStart,
        dayEnd: plan.dayEnd,
        plan: plan.plan,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to preview distribution' });
    }
  };

  const distributeLeads = async (req, res) => {
    try {
      const distributedBy = req.body?.distributedBy || req.body?.actorId || req.body?.employeeId || null;
      const access = await resolveLeadAccess(Employee, distributedBy);
      assertCanManageLeads(access);

      const date = req.body?.date || new Date();
      const leadIds = req.body?.leadIds;

      const built = await buildLeadDistributionPlan({
        Lead,
        Employee,
        date,
        leadIds,
      });

      if (!built.totalLeads) {
        return res.status(200).json({
          message: 'No unassigned leads to distribute for the selected day',
          totalLeads: 0,
          updated: 0,
          plan: built.plan,
        });
      }

      const { updated } = await applyLeadDistribution({
        Lead,
        assignments: built.assignments,
        distributedBy: access.employeeId,
      });

      res.status(200).json({
        message: 'Leads distributed among sales teams',
        totalLeads: built.totalLeads,
        teamLeaderCount: built.teamLeaderCount,
        updated,
        plan: built.plan,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to distribute leads' });
    }
  };

  return { previewDistribution, distributeLeads };
}
