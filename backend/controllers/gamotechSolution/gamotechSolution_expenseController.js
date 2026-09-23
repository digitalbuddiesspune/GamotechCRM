import Expense from '../../models/gamotechSolution/gamotechSolution_expense.js';

export const createExpense = async (req, res) => {
  try {
    const { description, amount, date, category } = req.body;
    const expense = new Expense({
      description: description?.trim(),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      category: category?.trim() || 'Other',
    });
    await expense.save();
    res.status(201).json({ message: 'Expense created', expense });
  } catch (error) {
    res.status(500).json({ message: 'Error creating expense', error });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (category && category.trim()) filter.category = new RegExp(category.trim(), 'i');
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses', error });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense', error });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { description, amount, date, category } = req.body;
    const update = {};
    if (description !== undefined) update.description = description.trim();
    if (amount !== undefined) update.amount = Number(amount);
    if (date !== undefined) update.date = new Date(date);
    if (category !== undefined) update.category = category?.trim() || 'Other';
    const expense = await Expense.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json({ message: 'Expense updated', expense });
  } catch (error) {
    res.status(500).json({ message: 'Error updating expense', error });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting expense', error });
  }
};
