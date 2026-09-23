import { Router } from 'express'
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateProfilePhoto,
  deleteEmployee,
  getEmployeeProfile,
  getEmployeesAvailability,
} from '../../controllers/gamotechSolution/gamotechSolution_employeeController.js'

const router = Router()

router.get('/employees', getEmployees)
router.get('/employees/availability', getEmployeesAvailability)
router.post('/employees', createEmployee)
router.get('/employees/:id/profile', getEmployeeProfile)
router.get('/employees/:id', getEmployeeById)
router.put('/employees/:id', updateEmployee)
router.patch('/employees/:id/profile-photo', updateProfilePhoto)
router.delete('/employees/:id', deleteEmployee)

export default router
