import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import bcrypt from 'bcryptjs';
import { enrichLoginUser } from '../../utils/adminAccess.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const employee = await Employee.findOne({ email }).select('+password').populate('designation');
    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!employee.password) {
      return res.status(401).json({ message: 'Account not set up for login. Please contact admin.' });
    }
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const user = enrichLoginUser(employee.toObject());
    delete user.password;
    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Error during login', error });
  }
};
