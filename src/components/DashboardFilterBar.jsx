// ===============================
// ✅ FRONTEND: components/DashboardFilterBar.jsx
// Date range quick filters + custom date
// ===============================
import React from "react";

const btn =
  "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 transition";

export default function DashboardFilterBar({ range, setRange }) {
  const setQuick = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    const fmt = (d) => d.toISOString().slice(0, 10);
    setRange({ from: fmt(from), to: fmt(to) });
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => setQuick(1)}>
          Today
        </button>
        <button className={btn} onClick={() => setQuick(7)}>
          Last 7 Days
        </button>
        <button className={btn} onClick={() => setQuick(30)}>
          Last 30 Days
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
          className="rounded-2xl border border-gray-200 px-3 py-2 text-sm"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
          className="rounded-2xl border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
