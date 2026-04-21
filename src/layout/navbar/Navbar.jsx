import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext/AuthContext";

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);

  const {
    logout,
    role,
    name,
    email,
    departments = [],
    activeDepartmentId,
    switchDepartment,
  } = useAuth();

  const isAdmin = String(role || "").toLowerCase() === "admin";
  const showDeptSwitch = isAdmin && departments.length > 1;

  const displayName = name || (email ? email.split("@")[0] : "User");
  const avatarLetter = (displayName?.[0] || "U").toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto  px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onToggleSidebar?.()}
              className="lg:hidden inline-flex items-center justify-center rounded-xl p-2 hover:bg-gray-100 transition"
              aria-label="Open sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-gray-900">Helpdesk</p>
                <p className="text-xs text-gray-500">Support Portal</p>
              </div>

            <div className="hidden md:block h-8 w-px bg-gray-200" />

            <div className="hidden md:block leading-tight">
              <p className="text-sm text-gray-600">
                Welcome, <span className="font-semibold text-gray-900">{displayName}</span>
              </p>
              {isAdmin && activeDepartmentId && (
                <p className="text-xs text-gray-500">
                  Active:{" "}
                  <span className="font-medium text-gray-800">
                    {departments.find((d) => String(d.id) === String(activeDepartmentId))?.department || `#${activeDepartmentId}`}
                  </span>
                </p>
              )}
            </div>

            {/* ✅ Department switch outside */}
            {showDeptSwitch && (
              <div className="ml-2">
                <label className="sr-only">Switch Department</label>
                <select
                  value={activeDepartmentId || ""}
                  onChange={(e) => switchDepartment(e.target.value)}
                  className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900
                             hover:bg-gray-50 transition
                             focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.department} ({d.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((s) => !s)}
                className="group inline-flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-gray-100 transition"
              >
                <div className="h-9 w-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold">
                  {avatarLetter}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
                  <div className="p-4 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-600 truncate">{email || "No email"}</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {role && (
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                          {role}
                        </span>
                      )}
                      {isAdmin && activeDepartmentId && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          {departments.find((d) => String(d.id) === String(activeDepartmentId))?.department || `Dept #${activeDepartmentId}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold
                                 text-red-700 hover:bg-red-50 transition"
                    >
                      <span>Logout</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Logout */}
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center rounded-2xl bg-red-800 px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
