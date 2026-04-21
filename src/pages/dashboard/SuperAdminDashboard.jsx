import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import TrendChart from "../../components/TrendChart";
import TicketTable from "../../components/TicketTable";

const fmt = (d) => d.toISOString().slice(0, 10);

const sortRows = (rows, sortKey, dir) => {
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "department" || sortKey === "type") {
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * mult;
    }
    return (Number(a[sortKey]) - Number(b[sortKey])) * mult;
  });
};

export default function SuperAdminDashboard() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  });

  // ✅ new filters
  const [deptId, setDeptId] = useState(""); // "" = all
  const [ticketType, setTicketType] = useState("all"); // all|complaint|request

  // ✅ dept dropdown list
  const [departments, setDepartments] = useState([]);

  // ✅ sorting for department summary table
  const [sortKey, setSortKey] = useState("total"); // department|type|total|complaints|requests
  const [sortDir, setSortDir] = useState("desc");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // load departments for dropdown
  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await api.get("/api/departments"); // you already have this route
        const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setDepartments(list);
      } catch (e) {
        console.error("dept load failed", e);
        setDepartments([]);
      }
    };
    loadDepts();
  }, []);

  const params = useMemo(() => {
    const p = { from: range.from, to: range.to, type: ticketType };
    if (deptId) p.deptId = deptId;
    return p;
  }, [range, deptId, ticketType]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/dashboard/superadmin", { params });
        setData(res.data.data);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params]);

  const deptRows = useMemo(() => {
    const rows = data?.departmentSummary || [];
    return sortRows(rows, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "department" || key === "type" ? "asc" : "desc");
    }
  };

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard</div>;

  return (
    <div className="p-6 space-y-6">
      {/* header + filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <DashboardFilterBar range={range} setRange={setRange} />
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          {/* ✅ Ticket Type filter */}
          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            <option value="all">All Tickets</option>
            <option value="complaint">Complaints</option>
            <option value="request">Requests</option>
          </select>

          {/* ✅ Department filter */}
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.department} ({d.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Pending" value={data.pending} />
        <StatCard title="In Progress" value={data.inProgress} />
        <StatCard title="Closed" value={data.closed} />
        <StatCard title="Today" value={data.todayTickets} />
        <StatCard title="Total" value={data.total} />
      </div>

      {/* Trend + Recent */}
      <TrendChart data={data.trend || []} />
      <TicketTable rows={data.recentTickets || []} />

      {/* ✅ Department-wise summary table + sorting */}
      <div className="rounded-2xl bg-white shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold">Department-wise Summary</h3>
          <p className="text-xs text-gray-500">
            Sort: {sortKey} ({sortDir})
          </p>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th
                  className="text-left px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("department")}
                >
                  Department
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("type")}
                >
                  Dept Type
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("total")}
                >
                  Total
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("complaints")}
                >
                  Complaints
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("requests")}
                >
                  Requests
                </th>
              </tr>
            </thead>
            <tbody>
              {deptRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    No data found.
                  </td>
                </tr>
              ) : (
                deptRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.department}</td>
                    <td className="px-4 py-3">{r.type || "-"}</td>
                    <td className="px-4 py-3 font-bold">{r.total}</td>
                    <td className="px-4 py-3">{r.complaints}</td>
                    <td className="px-4 py-3">{r.requests}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
