// ===============================
// ✅ FRONTEND: pages/dashboard/UserDashboard.jsx (UPDATED)
// ===============================
import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import TicketTable from "../../components/TicketTable";

const fmt = (d) => d.toISOString().slice(0, 10);

export default function UserDashboard() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => ({ from: range.from, to: range.to }), [range]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/dashboard/user", { params });
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

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <DashboardFilterBar range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Tickets" value={data.total} />
        <StatCard title="Pending" value={data.pending} />
        <StatCard title="In Progress" value={data.inProgress} />
        <StatCard title="Closed" value={data.closed} />
      </div>

      <TicketTable rows={data.recentTickets || []} />
    </div>
  );
}
