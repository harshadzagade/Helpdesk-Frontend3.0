// src/lib/api.js
import axios from "axios";

// This will automatically pick the URL based on the environment
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
});

// attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth.token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  let deptId = localStorage.getItem("auth.activeDepartmentId");

  if (!deptId) {
    const storedUser = JSON.parse(localStorage.getItem("auth.user") || "null");

    deptId =
      storedUser?.departmentId ||
      storedUser?.department?.id ||
      (Array.isArray(storedUser?.departmentIds)
        ? storedUser.departmentIds[0]
        : null);
  }

  if (deptId) {
    config.headers["x-department-id"] = deptId;
  }

  return config;
});



export default api;
