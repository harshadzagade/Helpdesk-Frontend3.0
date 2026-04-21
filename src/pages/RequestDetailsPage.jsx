import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import RequestDetails from "./RequestDetails";

export default function RequestDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRequest = async () => {
      if (!id) {
        setError("Request ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/api/requests/${id}`);
        setRequest(res.data?.data || res.data || null);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load request details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading request details...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!request) {
    return <div className="p-6 text-sm text-red-600">Request not found.</div>;
  }

  return <RequestDetails request={request} onClose={() => navigate(-1)} />;
}
