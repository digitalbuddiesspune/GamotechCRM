import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    trim: true,
    default: 'Other',
  },
}, { timestamps: true });

const Expense = mongoose.model('gamotechSolution_Expense', expenseSchema, 'adsresearchglobal_expenses');
export default Expense;
