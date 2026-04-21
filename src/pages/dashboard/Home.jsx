import React from "react";
import { useAuth } from "../../context/authContext/AuthContext";

import SuperAdminDashboard from "./SuperAdminDashboard";
import AdminDashboard from "./AdminDashboard";
import EngineerDashboard from "./EngineerDashboard";
import UserDashboard from "./UserDashboard";

const Home = () => {
  const { role } = useAuth();

  const normalizedRole = String(role || "").toLowerCase();

  switch (normalizedRole) {
    case "superadmin":
      return <SuperAdminDashboard />;

    case "admin":
    case "subadmin":
      return <AdminDashboard />;

    case "engineer":
      return <EngineerDashboard />;

    case "user":
      return <UserDashboard />;

    default:
      return (
        <div className="p-6 text-center text-red-600 font-semibold">
          Invalid role or unauthorized access
        </div>
      );
  }
};

export default Home;
