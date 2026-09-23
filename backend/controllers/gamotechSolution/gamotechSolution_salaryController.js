import Salary from '../../models/gamotechSolution/gamotechSolution_salary.js';
import { calculateSalaryStructure } from '../../utils/salaryCalculator.js';

const EMP_POPULATE = { path: 'employee', populate: { path: 'designation', select: 'title designationName name' } };

// Create a new salary record
export const createSalary = async (req, res) => {
  try {
    const { employee, month, year, status, bonus, paymentDate, paymentMode } = req.body;

    const calculated = calculateSalaryStructure(req.body);
    const newSalary = new Salary({
      employee,
      amount: calculated.grossSalary,
      grossSalary: calculated.grossSalary,
      components: calculated.components,
      basicSalary: calculated.components.find((c) => c.code === 'BASIC')?.amount || 0,
      da: calculated.components.find((c) => c.code === 'DA')?.amount || 0,
      hra: calculated.components.find((c) => c.code === 'HRA')?.amount || 0,
      conveyance: calculated.components.find((c) => c.code === 'CONVEYANCE')?.amount || 0,
      specialAllowance: calculated.components.find((c) => c.code === 'SPECIAL')?.amount || 0,
      medicalAllowance: calculated.components.find((c) => c.code === 'MEDICAL')?.amount || 0,
      attendanceIncentive: calculated.components.find((c) => c.code === 'ATTENDANCE_INCENTIVE')?.amount || 0,
      deductionsList: calculated.deductions,
      deductions: calculated.totalDeductions,
      totalDeductions: calculated.totalDeductions,
      netSalary: calculated.netSalary,
      employerContributions: calculated.employerContributions,
      monthlyCTC: calculated.monthlyCTC,
      annualCTC: calculated.annualCTC,
      month,
      year,
      status: status || 'Unpaid',
      bonus: bonus || 0,
      paymentDate: paymentDate || (status === 'Paid' ? new Date() : undefined),
      paymentMode: paymentMode || 'Bank Transfer',
    });

    await newSalary.save();
    const populated = await Salary.findById(newSalary._id).populate(EMP_POPULATE);
    res.status(201).json({
      message: 'Salary record created successfully',
      salary: populated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating salary record', error });
  }
};

// Get all salary records (supports ?employee=ID or ?employeeId=ID filtering)
export const getSalaries = async (req, res) => {
  try {
    const filter = {};
    const empId = req.query.employee || req.query.employeeId;
    if (empId) filter.employee = empId;
    if (req.query.status) filter.status = req.query.status;

    const salaries = await Salary.find(filter).populate(EMP_POPULATE).sort({ year: -1, month: -1 });
    res.status(200).json(salaries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching salaries', error });
  }
};

// Get a single salary record by ID
export const getSalaryById = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id).populate(EMP_POPULATE);
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });
    res.status(200).json(salary);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching salary', error });
  }
};

// Update a salary record by ID
export const updateSalary = async (req, res) => {
  try {
    const calculated = calculateSalaryStructure(req.body);
    const payload = {
      ...req.body,
      ...calculated,
      amount: calculated.grossSalary,
      basicSalary: calculated.components.find((c) => c.code === 'BASIC')?.amount || 0,
      da: calculated.components.find((c) => c.code === 'DA')?.amount || 0,
      hra: calculated.components.find((c) => c.code === 'HRA')?.amount || 0,
      conveyance: calculated.components.find((c) => c.code === 'CONVEYANCE')?.amount || 0,
      specialAllowance: calculated.components.find((c) => c.code === 'SPECIAL')?.amount || 0,
      medicalAllowance: calculated.components.find((c) => c.code === 'MEDICAL')?.amount || 0,
      attendanceIncentive: calculated.components.find((c) => c.code === 'ATTENDANCE_INCENTIVE')?.amount || 0,
      deductionsList: calculated.deductions,
      deductions: calculated.totalDeductions,
    };
    if (payload.status === 'Paid' && !payload.paymentDate) {
      payload.paymentDate = new Date();
    }
    const updated = await Salary.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    }).populate(EMP_POPULATE);
    if (!updated) return res.status(404).json({ message: 'Salary record not found' });
    res.status(200).json({ message: 'Salary updated', salary: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating salary', error });
  }
};

// Delete a salary record by ID
export const deleteSalary = async (req, res) => {
  try {
    const deleted = await Salary.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Salary record not found' });
    res.status(200).json({ message: 'Salary record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting salary', error });
  }
};
