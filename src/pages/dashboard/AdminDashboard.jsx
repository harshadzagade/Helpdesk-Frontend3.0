import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import ActivityFeed from "../../components/ActivityFeed";
import TicketTable from "../../components/TicketTable";
import { useAuth } from "../../context/authContext/AuthContext";

const fmt = (d) => d.toISOString().slice(0, 10);

const TableBox = ({ title, children }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow">
    <div className="border-b border-gray-100 p-4">
      <h3 className="font-semibold">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const getTicketPath = (row) => {
  const type = String(row?.type || "").toLowerCase();
  if (type === "complaint") return `/complaints/${row.id}`;
  if (type === "request") return `/requests/${row.id}`;
  return null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { departments, activeDepartmentId } = useAuth();

  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [ticketMode, setTicketMode] = useState("active");

  const params = useMemo(() => ({ from: range.from, to: range.to }), [range]);

  const activeDept = useMemo(() => {
    const idNum = Number(activeDepartmentId);
    return (departments || []).find((d) => Number(d.id) === idNum) || null;
  }, [departments, activeDepartmentId]);

  const isRegularDept = useMemo(() => {
    const t = String(activeDept?.type || "").toLowerCase().trim();
    return t === "regular";
  }, [activeDept]);

  const ticketRows = useMemo(() => {
    if (!data) return [];
    if (ticketMode === "approval") return data.approvalPendingList || [];
    if (ticketMode === "unassigned") return data.unassignedList || [];
    if (ticketMode === "pending") return data.pendingList || [];
    if (ticketMode === "closed") return data.closedList || [];
    return data.recentTickets || [];
  }, [data, ticketMode]);

  const ticketTitle = useMemo(() => {
    if (ticketMode === "approval") return "Approval Pending Tickets";
    if (ticketMode === "unassigned") return "Unassigned Tickets";
    if (ticketMode === "pending") return "Pending Tickets";
    if (ticketMode === "closed") return "Closed Tickets";
    return "Pending / In-Progress Tickets";
  }, [ticketMode]);

  useEffect(() => {
    if (!activeDepartmentId) return;

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
  }, [params, activeDepartmentId]);

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard</div>;

  const openTicket = (row) => {
    const path = getTicketPath(row);
    if (path) navigate(path);
  };

  const ticketFilterButtons = [
    { key: "active", label: "Active", count: data.recentTickets?.length || 0 },
    { key: "approval", label: "Approval Pending", count: data.approvalPendingCount || 0 },
    { key: "unassigned", label: "Unassigned Tickets", count: data.unassigned || 0, hidden: isRegularDept },
  ].filter((item) => !item.hidden);

  const ticketFilters = (
    <div className="flex flex-wrap gap-2">
      {ticketFilterButtons.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setTicketMode(item.key)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            ticketMode === item.key
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span>{item.label}</span>
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin / Subadmin Dashboard</h1>
          {activeDept && (
            <p className="text-sm text-gray-500">
              Active Department: <span className="font-semibold">{activeDept.department}</span>{" "}
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {activeDept.type}
              </span>
            </p>
          )}
        </div>

        <DashboardFilterBar range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <StatCard title="Pending" value={data.pending} onClick={() => setTicketMode("pending")} />
        <StatCard title="In Progress" value={data.inProgress} />
        <StatCard title="Closed" value={data.closed} onClick={() => setTicketMode("closed")} />
        <StatCard title="Approval Pending" value={data.approvalPendingCount || 0} onClick={() => setTicketMode("approval")} />
        <StatCard title="Total (Dept)" value={data.total} />
        {!isRegularDept && <StatCard title="Unassigned" value={data.unassigned || 0} />}
      </div>

      {!isRegularDept && (
        <TableBox title="Support Staff Workload (Active Dept)">
          {data.engineerLoad?.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff</th>
                    <th className="px-4 py-3 text-left">Assigned</th>
                    <th className="px-4 py-3 text-left">Pending</th>
                    <th className="px-4 py-3 text-left">In Progress</th>
                    <th className="px-4 py-3 text-left">Closed</th>
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

      <TicketTable
        rows={ticketRows}
        title={ticketTitle}
        filterActiveOnly={ticketMode === "active"}
        onRowClick={openTicket}
        headerActions={ticketFilters}
      />

      <ActivityFeed items={data.activities || []} />
    </div>
  );
}
