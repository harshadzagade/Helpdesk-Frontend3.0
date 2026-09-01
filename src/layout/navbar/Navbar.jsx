import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext/AuthContext";
import api from "../../lib/api";
import { createRealtimeSocket } from "../../lib/realtime";

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const reminderRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [ticketReminder, setTicketReminder] = useState({ title: "Ticket Reminders", count: 0, items: [] });
  const [reminderLoading, setReminderLoading] = useState(false);

  const {
    isAuthenticated,
    token,
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
  const reminderCount = Number(ticketReminder?.count || 0);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  const loadTicketReminders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setReminderLoading(true);
      const res = await api.get("/api/dashboard/ticket-reminders", { params: { limit: 10 } });
      setTicketReminder(res.data?.data || { title: "Ticket Reminders", count: 0, items: [] });
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Ticket reminder load failed", error);
      }
      setTicketReminder({ title: "Ticket Reminders", count: 0, items: [] });
    } finally {
      setReminderLoading(false);
    }
  }, [isAuthenticated]);

  const openTicket = (item) => {
    if (!item?.path) return;
    setReminderOpen(false);
    window.open(item.path, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (reminderRef.current && !reminderRef.current.contains(e.target)) setReminderOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    loadTicketReminders();
    const intervalId = window.setInterval(loadTicketReminders, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [activeDepartmentId, loadTicketReminders, role]);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;

    const socket = createRealtimeSocket({ token });

    const refreshReminders = () => {
      loadTicketReminders();
    };

    socket.on("connect", refreshReminders);
    socket.on("ticket-reminders:changed", refreshReminders);
    socket.on("connect_error", (error) => {
      console.warn("Realtime reminder connection failed", error.message);
    });

    return () => {
      socket.off("connect", refreshReminders);
      socket.off("ticket-reminders:changed", refreshReminders);
      socket.disconnect();
    };
  }, [activeDepartmentId, isAuthenticated, loadTicketReminders, token]);

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
            <div className="relative" ref={reminderRef}>
              <button
                type="button"
                onClick={() => {
                  setReminderOpen((value) => !value);
                  loadTicketReminders();
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
                aria-label="Ticket reminders"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
                {reminderCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
                    {reminderCount > 9 ? "9+" : reminderCount}
                  </span>
                )}
              </button>

              {reminderOpen && (
                <div className="absolute right-0 mt-3 w-[22rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{ticketReminder.title}</p>
                      <p className="text-xs text-gray-500">{reminderCount} item(s)</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadTicketReminders}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {reminderLoading ? "..." : "Refresh"}
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {ticketReminder.items?.length ? (
                      ticketReminder.items.map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => openTicket(item)}
                          className="block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-blue-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {item.ticketId || `${item.type}-${item.id}`}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.subject}</p>
                              <p className="mt-1 text-xs font-medium text-blue-700">{item.reason}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                              {item.type}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        {reminderLoading ? "Loading reminders..." : "No reminders right now."}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
