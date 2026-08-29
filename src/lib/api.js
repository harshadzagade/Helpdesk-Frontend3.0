// src/lib/api.js
import axios from "axios";

// This will automatically pick the URL based on the environment
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
});

const SESSION_EXPIRES_AT_KEY = "auth.expiresAt";
const clearAuthStorage = () => {
  [
    "auth.token",
    "auth.role",
    "auth.name",
    "auth.email",
    "auth.canManageExtensions",
    "auth.canManagePolicies",
    "auth.user",
    "auth.departmentIds",
    "auth.departments",
    "auth.activeDepartmentId",
    SESSION_EXPIRES_AT_KEY,
  ].forEach((key) => localStorage.removeItem(key));
};

// attach token automatically
api.interceptors.request.use((config) => {
  const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    clearAuthStorage();
    window.dispatchEvent(new Event("auth:expired"));
    return config;
  }

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthStorage();
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export default api;
