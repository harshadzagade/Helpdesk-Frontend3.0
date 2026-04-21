// ===============================
// ✅ FRONTEND: components/TrendChart.jsx (Recharts)
// ===============================
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

export default function TrendChart({ data = [] }) {
  return (
    <div className="rounded-2xl bg-white shadow border border-gray-100 p-4">
      <h3 className="font-semibold mb-3">Tickets Trend (Created vs Closed)</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="created" />
            <Line type="monotone" dataKey="closed" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
