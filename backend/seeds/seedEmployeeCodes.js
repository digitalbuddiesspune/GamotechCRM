import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { backfillEmployeeCodes, buildEmployeeCode } from '../utils/employeeCode.js';

dotenv.config();

const companies = ['gamotechSolution'];

const seed = async () => {
  try {
    await connectDB();

    for (const company of companies) {
      const { default: Employee } = await import(`../models/${company}/${company}_employee.js`);
      const updated = await backfillEmployeeCodes(Employee, company);
      console.log(`[${company}] Assigned employee IDs to ${updated} record(s) (format e.g. ${buildEmployeeCode(company, 1)})`);
    }

    console.log('Employee ID backfill complete');
    process.exit(0);
  } catch (error) {
    console.error('Employee ID seeding error:', error);
    process.exit(1);
  }
};

seed();
