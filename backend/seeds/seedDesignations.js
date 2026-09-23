import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { getDefaultDesignationMeta } from '../utils/designationFields.js';

dotenv.config();

const companies = ['gamotechSolution'];

const DESIGNATION_TITLES = [
  'Admin',
  'Chief Executive Officer',
  'Chief Technology Officer',
  'Chief Operating Officer',
  'Chief Financial Officer',
  'Head of Product',
  'Product Manager',
  'Project Manager',
  'Program Manager',
  'Engineering Manager',
  'Technical Lead',
  'HR Manager',
  'Software Engineer',
  'Web Developer',
  'Senior Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Mobile Developer',
  'DevOps Engineer',
  'Site Reliability Engineer',
  'QA Engineer',
  'Test Engineer',
  'Security Engineer',
  'Database Administrator',
  'System Administrator',
  'UI/UX Designer',
  'Graphic Designer',
  'Video Editor',
  'Motion Designer',
  'Creative Director',
  'Art Director',
  'Copywriter',
  'Content Writer',
  'SEO Specialist',
  'SEM/PPC Specialist',
  'Social Media Manager',
  'Digital Marketing Manager',
  'Growth Marketer',
  'Email Marketing Specialist',
  'Brand Manager',
  'Community Manager',
  'Analytics Manager',
  'Data Analyst',
  'Data Scientist',
  'Business Analyst',
  'Sales Manager',
  'Senior Sales Manager',
  'Tele Caller',
  'Site Co-ordinator',
  'Site Coordinator',
  'Operations Head',
  'Personal Assistant',
  'Account Manager',
  'Customer Success Manager',
  'Support Engineer',
  'Recruiter',
  'Office Manager',
  'Intern',
];

const seedCompanyDesignations = async (company) => {
  const { default: Designation } = await import(`../models/${company}/${company}_designation.js`);

  for (const title of DESIGNATION_TITLES) {
    const meta = getDefaultDesignationMeta(title);
    await Designation.findOneAndUpdate(
      { title },
      { title, ...meta },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`[${company}] Seeded ${DESIGNATION_TITLES.length} designations`);
};

const seed = async () => {
  try {
    await connectDB();

    for (const company of companies) {
      await seedCompanyDesignations(company);
    }

    console.log('All company designations seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Designation seeding error:', error);
    process.exit(1);
  }
};

seed();
