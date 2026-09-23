import { Router } from "express";
import { createDesignation, deleteDesignation, getDesignationById, getDesignations, updateDesignation } from "../../controllers/gamotechSolution/gamotechSolution_designationController.js";
const designationRouter = Router();

designationRouter.get('/designations', getDesignations);
designationRouter.post('/designations', createDesignation);
designationRouter.get('/designations/:id', getDesignationById);
designationRouter.put('/designations/:id', updateDesignation);
designationRouter.delete('/designations/:id', deleteDesignation);

export default designationRouter;