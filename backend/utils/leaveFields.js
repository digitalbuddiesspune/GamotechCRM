import mongoose from 'mongoose';

export const LEAVE_APPROVAL_STAGES = [
  'team_leader',
  'hr',
  'admin',
  'central_admin',
  'completed',
];

export const getLeaveWorkflowFields = (employeeRef) => ({
  approvalStage: {
    type: String,
    enum: LEAVE_APPROVAL_STAGES,
    default: 'team_leader',
    index: true,
  },
  approvalHistory: [{
    stage: {
      type: String,
      enum: LEAVE_APPROVAL_STAGES,
      required: true,
    },
    action: {
      type: String,
      enum: ['Submitted', 'Forwarded', 'Approved', 'Rejected'],
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: employeeRef,
      default: null,
    },
    actorName: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    comment: { type: String, default: '' },
    actedAt: { type: Date, default: Date.now },
  }],
  finalDecisionBy: {
    id: { type: String, default: '' },
    name: { type: String, default: '' },
    role: { type: String, default: '' },
  },
});
