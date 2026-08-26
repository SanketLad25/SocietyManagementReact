import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import RequireRole from './components/RequireRole.jsx'
import Home from './pages/dashboard/Home.jsx'
import ComingSoon from './pages/dashboard/ComingSoon.jsx'
import ResidentList from './pages/residents/ResidentList.jsx'
import FlatList from './pages/flats/FlatList.jsx'
import ParkingList from './pages/parking/ParkingList.jsx'
import UserList from './pages/admin/UserList.jsx'
import SocietyList from './pages/superadmin/SocietyList.jsx'
import MaintenanceHub from './pages/maintenance/MaintenanceHub.jsx'
import CategoryList from './pages/maintenance/CategoryList.jsx'
import BillingFrequencyList from './pages/maintenance/BillingFrequencyList.jsx'
import ParkingTypeList from './pages/maintenance/ParkingTypeList.jsx'
import AmenityList from './pages/maintenance/AmenityList.jsx'
import FlatGroupList from './pages/maintenance/FlatGroupList.jsx'
import ChargeRuleList from './pages/maintenance/ChargeRuleList.jsx'
import ExemptionList from './pages/maintenance/ExemptionList.jsx'
import BillingCycleList from './pages/maintenance/BillingCycleList.jsx'
import CycleBillList from './pages/maintenance/CycleBillList.jsx'
import BillDetail from './pages/maintenance/BillDetail.jsx'
import MyBills from './pages/maintenance/MyBills.jsx'
import NoticeList from './pages/notices/NoticeList.jsx'
import NoticeCategoryList from './pages/notices/NoticeCategoryList.jsx'
import ComplaintList from './pages/complaints/ComplaintList.jsx'
import ComplaintCategoryList from './pages/complaints/ComplaintCategoryList.jsx'
import EventList from './pages/events/EventList.jsx'
import EventCategoryList from './pages/events/EventCategoryList.jsx'
import KnowledgeArticleList from './pages/knowledge/KnowledgeArticleList.jsx'
import VisitorList from './pages/visitors/VisitorList.jsx'
import VisitorDetail from './pages/visitors/VisitorDetail.jsx'
import VisitorCategoryList from './pages/visitors/VisitorCategoryList.jsx'
import { NAV_ITEMS } from './config/dashboardNav.js'
import { SUPER_ADMIN_ROLE, NOTICE_MANAGER_ROLES } from './config/roles.js'

const REAL_PAGE_KEYS = [
  'home', 'residents', 'flats', 'users', 'societies', 'maintenance', 'notices', 'parking', 'complaints', 'events', 'knowledge', 'visitors',
]
const PLACEHOLDER_ITEMS = NAV_ITEMS.filter((item) => !REAL_PAGE_KEYS.includes(item.key))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <ChangePassword />
          </RequireAuth>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />

        <Route path="residents" element={<ResidentList />} />
        <Route path="flats" element={<FlatList />} />
        <Route path="parking" element={<ParkingList />} />

        <Route
          path="admin/users"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard">
              <UserList />
            </RequireRole>
          }
        />

        <Route
          path="societies"
          element={
            <RequireRole roles={[SUPER_ADMIN_ROLE]} redirectTo="/dashboard">
              <SocietyList />
            </RequireRole>
          }
        />

        <Route path="maintenance" element={<MaintenanceHub />} />
        <Route
          path="maintenance/categories"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <CategoryList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/billing-frequencies"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <BillingFrequencyList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/parking-types"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <ParkingTypeList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/amenities"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <AmenityList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/flat-groups"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <FlatGroupList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/charge-rules"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <ChargeRuleList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/exemptions"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/maintenance">
              <ExemptionList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/billing-cycles"
          element={
            <RequireRole roles={['Admin', 'Chairman', 'Secretary', 'Treasurer']} redirectTo="/dashboard/maintenance">
              <BillingCycleList />
            </RequireRole>
          }
        />
        <Route
          path="maintenance/billing-cycles/:cycleId/bills"
          element={
            <RequireRole roles={['Admin', 'Chairman', 'Secretary', 'Treasurer']} redirectTo="/dashboard/maintenance">
              <CycleBillList />
            </RequireRole>
          }
        />
        <Route path="maintenance/bills/:billId" element={<BillDetail />} />
        <Route
          path="maintenance/my-bills"
          element={
            <RequireRole roles={['Resident']} redirectTo="/dashboard/maintenance">
              <MyBills />
            </RequireRole>
          }
        />

        <Route path="notices" element={<NoticeList />} />
        <Route
          path="notices/categories"
          element={
            <RequireRole roles={NOTICE_MANAGER_ROLES} redirectTo="/dashboard/notices">
              <NoticeCategoryList />
            </RequireRole>
          }
        />

        <Route path="complaints" element={<ComplaintList />} />
        <Route
          path="complaints/categories"
          element={
            <RequireRole roles={['Admin']} redirectTo="/dashboard/complaints">
              <ComplaintCategoryList />
            </RequireRole>
          }
        />

        <Route path="visitors" element={<VisitorList />} />
        <Route path="visitors/:visitorLogId" element={<VisitorDetail />} />
        <Route
          path="visitors/categories"
          element={
            <RequireRole roles={['Admin', 'Chairman', 'Secretary', 'Treasurer']} redirectTo="/dashboard/visitors">
              <VisitorCategoryList />
            </RequireRole>
          }
        />

        <Route path="events" element={<EventList />} />
        <Route
          path="events/categories"
          element={
            <RequireRole roles={NOTICE_MANAGER_ROLES} redirectTo="/dashboard/events">
              <EventCategoryList />
            </RequireRole>
          }
        />

        <Route
          path="knowledge"
          element={
            <RequireRole roles={NOTICE_MANAGER_ROLES} redirectTo="/dashboard">
              <KnowledgeArticleList />
            </RequireRole>
          }
        />

        {PLACEHOLDER_ITEMS.map((item) => (
          <Route
            key={item.key}
            path={item.path.replace('/dashboard/', '')}
            element={<ComingSoon title={item.label} description={item.description} icon={item.icon} />}
          />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
