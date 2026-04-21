import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import ComplaintDetails from "./ComplaintDetails";

export default function ComplaintDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchComplaint = async () => {
      if (!id) {
        setError("Complaint ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/api/complaints/${id}`);
        setComplaint(res.data?.data || res.data || null);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load complaint details.");
      } finally {
        setLoading(false);
      }
    };

    fetchComplaint();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading complaint details...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!complaint) {
    return <div className="p-6 text-sm text-red-600">Complaint not found.</div>;
  }

  return <ComplaintDetails complaint={complaint} onClose={() => navigate(-1)} />;
}
