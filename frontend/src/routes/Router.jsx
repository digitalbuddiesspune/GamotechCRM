import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App'
import Login from '../pages/Login'
import RequireAuth from '../components/RequireAuth'
import DashboardView, { RoleDashboardRedirect } from '../components/views/DashboardView'
import ClientsView from '../components/views/ClientsView'
import CampaignsView from '../components/views/CampaignsView'
import LeadsView from '../components/views/LeadsView'
import ProjectsView from '../components/views/ProjectsView'
import MyProjectsView from '../components/views/MyProjectsView'
import MyTeamView from '../components/views/MyTeamView'
import ReportsView from '../components/views/ReportsView'
import TasksView from '../components/views/TasksView'
import CalendarView from '../components/views/CalendarView'
import SocialCalendarView from '../components/views/SocialCalendarView'
import EmployeesView from '../components/views/EmployeesView'
import EmployeeProfileView from '../components/views/EmployeeProfileView'
import AddEmployee from '../pages/AddEmployee'
import AddClient from '../pages/AddClient'
import AddProject from '../pages/AddProject'
import ModulePage from '../pages/ModulePage'
import MyProfilePage from '../pages/MyProfilePage'
import SalarySlipPage from '../pages/SalarySlipPage'
import SalariesView from '../components/views/SalariesView'
import AddSalary from '../pages/AddSalary'
import AttendanceView from '../components/views/AttendanceView'
import AddLead from '../pages/AddLead'
import Settings from '../pages/Settings'
import AssignTask from '../pages/AssignTask'
import TaskDetailPage from '../pages/TaskDetailPage'
import CollaboratorsView from '../components/views/CollaboratorsView'
import AddCollaborator from '../pages/AddCollaborator'
import LeaveView from '../components/views/LeaveView'
import BillingView from '../components/views/BillingView'
import RevenueView from '../components/views/RevenueView'
import ExpensesView from '../components/views/ExpensesView'
import AddExpense from '../pages/AddExpense'
import AddBilling from '../pages/AddBilling'
import InvoicePage from '../pages/InvoicePage'
import QuotationsView from '../components/views/QuotationsView'
import AddQuotation from '../pages/AddQuotation'
import QuotationPage from '../pages/QuotationPage'
import DocumentsView from '../components/views/DocumentsView'
import AddDocument from '../pages/AddDocument'
import CompaniesView from '../components/views/CompaniesView'
import AddCompany from '../pages/AddCompany'
import CompanyProfilePage from '../pages/CompanyProfilePage'
import ClientProfilesView from '../components/views/ClientProfilesView'
import ClientDashboardView from '../components/views/ClientDashboardView'
import ProjectDashboardView from '../components/views/ProjectDashboardView'
import AddClientProfile from '../pages/AddClientProfile'
import SocialCalendarClientView from '../pages/SocialCalendarClientView'

const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <RequireAuth>
                <App />
            </RequireAuth>
        ),
        children: [
            { index: true, element: <RoleDashboardRedirect /> },
            { path: 'dashboard', element: <DashboardView /> },
            { path: 'admin-dashboard', element: <DashboardView /> },
            { path: 'hr-dashboard', element: <DashboardView /> },
            { path: 'manager-dashboard', element: <DashboardView /> },
            { path: 'team-leader-dashboard', element: <DashboardView /> },
            { path: 'clients', element: <ClientsView /> },
            { path: 'clients/:clientId/dashboard', element: <ClientDashboardView /> },
            { path: 'client-profiles', element: <ClientProfilesView /> },
            { path: 'client-profiles/new', element: <AddClientProfile /> },
            { path: 'client-profiles/edit/:id', element: <AddClientProfile /> },
            { path: 'add-client', element: <AddClient /> },
            { path: 'clients/edit/:id', element: <AddClient /> },
            { path: 'companies', element: <CompaniesView /> },
            { path: 'add-company', element: <AddCompany /> },
            { path: 'companies/edit/:id', element: <AddCompany /> },
            { path: 'company-profile', element: <CompanyProfilePage /> },
            { path: 'collaborators', element: <CollaboratorsView /> },
            { path: 'add-collaborator', element: <AddCollaborator /> },
            { path: 'collaborators/edit/:id', element: <AddCollaborator /> },
            { path: 'campaigns', element: <CampaignsView /> },
            { path: 'leads', element: <LeadsView /> },
            { path: 'add-lead', element: <AddLead /> },
            { path: 'leads/view/:id', element: <AddLead readOnly /> },
            { path: 'leads/edit/:id', element: <AddLead /> },
            { path: 'projects', element: <ProjectsView /> },
            { path: 'projects/edit/:id', element: <AddProject /> },
            { path: 'projects/:projectId/dashboard', element: <ProjectDashboardView /> },
            { path: 'my-team', element: <MyTeamView /> },
            { path: 'my-projects', element: <MyProjectsView /> },
            { path: 'my-projects/:projectId/dashboard', element: <ProjectDashboardView /> },
            { path: 'add-project', element: <AddProject /> },
            { path: 'assign-task', element: <AssignTask /> },
            { path: 'reports', element: <ReportsView /> },
            { path: 'tasks', element: <TasksView /> },
            { path: 'tasks/:taskId', element: <TaskDetailPage /> },
            { path: 'my-tasks', element: <TasksView isMyTasks /> },
            { path: 'my-tasks/:taskId', element: <TaskDetailPage isMyTasks /> },
            { path: 'calendar', element: <CalendarView /> },
            { path: 'social-calendar', element: <SocialCalendarView /> },
            // HR placeholders
            { path: 'employees', element: <EmployeesView /> },
            { path: 'employees/:id/profile', element: <EmployeeProfileView /> },
            { path: 'add-employee', element: <AddEmployee /> },
            { path: 'employees/edit/:id', element: <AddEmployee /> },
            { path: 'salaries', element: <SalariesView /> },
            { path: 'add-salary', element: <AddSalary /> },
            { path: 'billings', element: <BillingView /> },
            { path: 'revenue', element: <RevenueView /> },
            { path: 'expenses', element: <ExpensesView /> },
            { path: 'add-expense', element: <AddExpense /> },
            { path: 'expenses/edit/:id', element: <AddExpense /> },
            { path: 'add-billing', element: <AddBilling /> },
            { path: 'billings/edit/:id', element: <AddBilling /> },
            { path: 'billings/:id/invoice', element: <InvoicePage /> },
            { path: 'quotations', element: <QuotationsView /> },
            { path: 'add-quotation', element: <AddQuotation /> },
            { path: 'quotations/edit/:id', element: <AddQuotation /> },
            { path: 'quotations/:id', element: <QuotationPage /> },
            { path: 'files', element: <DocumentsView documentType='File' /> },
            { path: 'add-file', element: <AddDocument documentType='File' /> },
            { path: 'files/edit/:id', element: <AddDocument documentType='File' /> },
            { path: 'contracts', element: <DocumentsView documentType='Contract' /> },
            { path: 'add-contract', element: <AddDocument documentType='Contract' /> },
            { path: 'contracts/edit/:id', element: <AddDocument documentType='Contract' /> },
            { path: 'policies', element: <DocumentsView documentType='Policy' /> },
            { path: 'add-policy', element: <AddDocument documentType='Policy' /> },
            { path: 'policies/edit/:id', element: <AddDocument documentType='Policy' /> },
            { path: 'attendance', element: <AttendanceView /> },
            { path: 'leave', element: <LeaveView /> },
            { path: 'lead-management', element: <LeadsView /> },
            { path: 'my-profile', element: <MyProfilePage /> },
            { path: 'salary-slips', element: <SalarySlipPage /> },
            { path: 'module/:slug', element: <ModulePage /> },
            { path: 'settings', element: <Settings /> },
        ],
    },
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/social-calendar/client/:token',
        element: <SocialCalendarClientView />,
    },
])

export default router