import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  grossSalary: {
    type: Number,
    default: 0,
  },
  components: [
    {
      code: { type: String },
      name: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  basicSalary: {
    type: Number,
    default: 0,
  },
  da: {
    type: Number,
    default: 0,
  },
  hra: {
    type: Number,
    default: 0,
  },
  conveyance: {
    type: Number,
    default: 0,
  },
  specialAllowance: {
    type: Number,
    default: 0,
  },
  medicalAllowance: {
    type: Number,
    default: 0,
  },
  attendanceIncentive: {
    type: Number,
    default: 0,
  },
  allowances: {
    type: Number,
    default: 0,
  },
  deductionsList: [
    {
      code: { type: String },
      name: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  deductions: {
    type: Number,
    default: 0,
  },
  totalDeductions: {
    type: Number,
    default: 0,
  },
  netSalary: {
    type: Number,
    default: 0,
  },
  employerContributions: [
    {
      code: { type: String },
      name: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  monthlyCTC: {
    type: Number,
    default: 0,
  },
  annualCTC: {
    type: Number,
    default: 0,
  },
  bonus: {
    type: Number,
    default: 0,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
  },
  paymentMode: {
    type: String,
    default: 'Bank Transfer',
  },
  status: {
    type: String,
    enum: ['Paid', 'Unpaid'],
    default: 'Unpaid',
  },
}, { timestamps: true });

const Salary = mongoose.model('gamotechSolution_Salary', salarySchema, 'adsresearchglobal_salaries');
export default Salary;
