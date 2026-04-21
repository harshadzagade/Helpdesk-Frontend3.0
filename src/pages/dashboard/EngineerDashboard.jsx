import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";

const fmt = (d) => d.toISOString().slice(0, 10);

const Badge = ({ status }) => {
  const s = String(status || "").toLowerCase();
  const cls =
    s.includes("closed")
      ? "bg-green-50 text-green-700"
      : s.includes("progress")
      ? "bg-yellow-50 text-yellow-700"
      : s.includes("pending")
      ? "bg-gray-100 text-gray-700"
      : "bg-indigo-50 text-indigo-700";

  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status}</span>;
};

export default function EngineerDashboard() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  });

  const [type, setType] = useState("all"); // all/complaint/request
  const [status, setStatus] = useState(""); // pending/in-progress/closed/empty

  const [summary, setSummary] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => ({ from: range.from, to: range.to, type, status: status || undefined }),
    [range, type, status]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [sRes, tRes] = await Promise.all([
          api.get("/api/dashboard/engineer", { params: { from: range.from, to: range.to } }),
          api.get("/api/dashboard/engineer/tickets", { params }),
        ]);

        setSummary(sRes.data.data);
        setTickets(tRes.data.data || []);
      } catch (e) {
        console.error(e);
        setSummary(null);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params, range.from, range.to]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold">Engineer Dashboard</h1>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
            className="rounded-xl border px-3 py-2 text-sm"
          />

          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="all">All Types</option>
            <option value="complaint">Complaints</option>
            <option value="request">Requests</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Assigned" value={summary.total} />
          <StatCard title="Pending" value={summary.pending} />
          <StatCard title="In Progress" value={summary.inProgress} />
          <StatCard title="Closed" value={summary.closed} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-white shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">My Assigned Tickets</h3>
          <p className="text-sm text-gray-500">Complaint + Request tickets assigned to you</p>
        </div>

        <div className="p-4 overflow-auto">
          {tickets.length === 0 ? (
            <p className="text-sm text-gray-500">No assigned tickets found.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Ticket</th>
                  <th className="text-left px-3 py-2">Subject</th>
                  <th className="text-left px-3 py-2">Priority</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={`${t.type}-${t.id}`} className="border-t">
                    <td className="px-3 py-2 font-semibold">{t.type}</td>
                    <td className="px-3 py-2">{t.ticketId}</td>
                    <td className="px-3 py-2">{t.subject}</td>
                    <td className="px-3 py-2">{t.priority || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge status={t.status} />
                    </td>
                    <td className="px-3 py-2">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
