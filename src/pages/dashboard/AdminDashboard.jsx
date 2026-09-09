import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import ActivityFeed from "../../components/ActivityFeed";
import TicketTable from "../../components/TicketTable";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext/AuthContext"; // ✅ adjust path if different

const fmt = (d) => d.toISOString().slice(0, 10);

const TableBox = ({ title, children }) => (
  <div className="rounded-2xl bg-white shadow border border-gray-100 overflow-hidden">
    <div className="p-4 border-b border-gray-100">
      <h3 className="font-semibold">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const badge = (s = "") => {
  const t = String(s).toLowerCase();
  if (t.includes("closed")) return "bg-green-50 text-green-700";
  if (t.includes("progress")) return "bg-yellow-50 text-yellow-700";
  if (t.includes("hod1")) return "bg-indigo-50 text-indigo-700";
  if (t.includes("reject")) return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-700";
};

const getTicketPath = (row) => {
  const type = String(row?.type || "").toLowerCase();
  if (type === "complaint") return `/complaints/${row.id}`;
  if (type === "request") return `/requests/${row.id}`;
  return null;
};

const SimpleList = ({ rows = [], onOpen }) => {
  if (!rows.length) return <p className="text-sm text-gray-500">No records.</p>;

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-3 py-2">Ticket</th>
            <th className="text-left px-3 py-2">Subject</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.type || "X"}-${r.id}`}
              className="border-t hover:bg-gray-50 cursor-pointer"
              onClick={() => onOpen?.(r)}
            >
              <td className="px-3 py-2 font-semibold text-blue-700">{r.ticketId}</td>
              <td className="px-3 py-2">{r.subject}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge(r.status)}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { departments, activeDepartmentId } = useAuth(); // ✅ from AuthContext

  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const params = useMemo(() => ({ from: range.from, to: range.to }), [range]);

  // ✅ find active department object from auth departments
  const activeDept = useMemo(() => {
    const idNum = Number(activeDepartmentId);
    return (departments || []).find((d) => Number(d.id) === idNum) || null;
  }, [departments, activeDepartmentId]);

  // ✅ if active department type is regular => hide engineer-related blocks
  const isRegularDept = useMemo(() => {
    const t = String(activeDept?.type || "").toLowerCase().trim();
    return t === "regular";
  }, [activeDept]);

  useEffect(() => {
    if (!activeDepartmentId) return; // ✅ wait until dept is selected/stored

    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/dashboard/admin", { params });
        setData(res.data.data);
      } catch (e) {
        console.error("Dashboard load error:", e?.response?.data || e.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params, activeDepartmentId]); // ✅ add dependency


  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard</div>;

  const openTicket = (row) => {
    const path = getTicketPath(row);
    if (path) navigate(path);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin / Subadmin Dashboard</h1>
          {/* Optional: show active dept info */}
          {activeDept && (
            <p className="text-sm text-gray-500">
              Active Department: <span className="font-semibold">{activeDept.department}</span>{" "}
              <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                {activeDept.type}
              </span>
            </p>
          )}
        </div>

        <DashboardFilterBar range={range} setRange={setRange} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <StatCard title="Pending" value={data.pending} />
        <StatCard title="In Progress" value={data.inProgress} />
        <StatCard title="Closed" value={data.closed} />
        <StatCard title="Approval Pending" value={data.approvalPendingCount || 0} />
        <StatCard title="Total (Dept)" value={data.total} />

        {/* ✅ Regular dept => hide Unassigned KPI card */}
        {!isRegularDept && <StatCard title="Unassigned" value={data.unassigned || 0} />}

      </div>

      {/* Approval + Unassigned + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <TableBox title="Approval Pending Requests">
          <SimpleList rows={data.approvalPendingList || []} onOpen={openTicket} />
        </TableBox>

        {/* ✅ Regular dept => hide Unassigned section */}
        {!isRegularDept && (
          <TableBox title="Unassigned Tickets (Assign Staff)">
            <SimpleList rows={data.unassignedList || []} onOpen={openTicket} />
          </TableBox>
        )}

        <ActivityFeed items={data.activities || []} />
      </div>

       {/* Recent */}
       <TicketTable rows={data.recentTickets || []} onRowClick={openTicket} />

      {/* ✅ Regular dept => hide Engineer Workload */}
      {!isRegularDept && (
        <TableBox title="Support Staff Workload (Active Dept)">
          {data.engineerLoad?.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3">Staff</th>
                    <th className="text-left px-4 py-3">Assigned</th>
                    <th className="text-left px-4 py-3">Pending</th>
                    <th className="text-left px-4 py-3">In Progress</th>
                    <th className="text-left px-4 py-3">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.engineerLoad.map((e) => (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold">{e.name}</td>
                      <td className="px-4 py-3">{e.assignedTotal}</td>
                      <td className="px-4 py-3">{e.pending}</td>
                      <td className="px-4 py-3">{e.inProgress}</td>
                      <td className="px-4 py-3">{e.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No support staff found in this department.</p>
          )}
        </TableBox>
      )}

     
    </div>
  );
}
