import Designation from '../../models/gamotechSolution/gamotechSolution_designation.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createDesignationController } from '../../utils/createDesignationController.js';

const controller = createDesignationController(Designation, Employee, 'gamotechSolution');

export const {
  createDesignation,
  getDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
} = controller;
