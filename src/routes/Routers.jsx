// src/routes/index.jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/authContext/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/Login";
import Layout from "../layout/Layout";
import Home from "../pages/dashboard/Home";
import Department from "../pages/Department";
import Institute from "../pages/Institute";
import Employee from "../pages/Employee";
import Complaint from "../pages/Complaint";
import Request from "../pages/Request";
import ContactList from "../pages/ContactList";
import Report from "../pages/Report";
import Policies from "../pages/PoliciesV2";
import ReminderManagement from "../pages/ReminderManagement";
import SubadminActivity from "../pages/subadminActivity";
import ComplaintDetailsPage from "../pages/ComplaintDetailsPage";
import RequestDetailsPage from "../pages/RequestDetailsPage";

const Forbidden = () => <div className="p-6 text-red-600">Forbidden</div>;
const NotFound   = () => <div className="p-6">Not Found</div>;

export default function Routers() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />

            {/* ✅ Everyone logged-in: Employee/Complaint/Request/Policies */}
            <Route path="/employee" element={<Employee />} />
            <Route path="/complaint" element={<Complaint />} />
            <Route path="/request" element={<Request />} />
            <Route path="/policies" element={<Policies />} />

            {/* ✅ Reports: admin | subadmin | engineer | superadmin */}
            <Route element={<ProtectedRoute roles={['admin','subadmin','engineer','superadmin']} />}>
              <Route path="/reports" element={<Report />} />
              <Route path="/complaints/:id" element={<ComplaintDetailsPage />} />
              <Route path="/requests/:id" element={<RequestDetailsPage />} />
            </Route>

            {/* ✅ admin only: Subadmin Activity */}
            <Route element={<ProtectedRoute roles={['admin','subadmin']} />}>
              <Route path="/subadmin-activity" element={<SubadminActivity />} />
            </Route>
            

            {/* ✅ Superadmin only: Department/Institute/Contact List */}
            <Route element={<ProtectedRoute roles={['superadmin']} />}>
              <Route path="/department" element={<Department />} />
              <Route path="/institute" element={<Institute />} />
              <Route path="/contact-list" element={<ContactList />} />
              <Route path="/reminders" element={<ReminderManagement />} />
            </Route>
          </Route>
        </Route>

        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
