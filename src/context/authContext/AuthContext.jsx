/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("auth.token"));
  const [role, setRole] = useState(() => localStorage.getItem("auth.role"));
  const [name, setName] = useState(() => localStorage.getItem("auth.name"));
  const [email, setEmail] = useState(() => localStorage.getItem("auth.email"));

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("auth.user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // ✅ departmentIds from login
  const [departmentIds, setDepartmentIds] = useState(() => {
    const saved = localStorage.getItem("auth.departmentIds");
    return saved ? JSON.parse(saved) : [];
  });

  // ✅ department objects from /api/departments (filtered)
  const [departments, setDepartments] = useState(() => {
    const saved = localStorage.getItem("auth.departments");
    return saved ? JSON.parse(saved) : [];
  });

  // ✅ active dept (selected)
  const [activeDepartmentId, setActiveDepartmentId] = useState(() => {
    return localStorage.getItem("auth.activeDepartmentId") || null;
  });

  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!token && !!user;

  // ✅ Fetch all departments and filter by user's departmentIds
  const fetchDepartments = useCallback(async (deptIds) => {
    try {
      const res = await api.get("/api/departments");
      const all = Array.isArray(res.data) ? res.data : [];

      const allowed = all.filter((d) => deptIds.includes(d.id));
      setDepartments(allowed);

      // set default active
      if (!activeDepartmentId && allowed.length > 0) {
        setActiveDepartmentId(String(allowed[0].id));
      }

      return allowed;
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setDepartments([]);
      return [];
    }
  }, [activeDepartmentId]);

  // Hydrate localStorage on change
  useEffect(() => {
    if (token) localStorage.setItem("auth.token", token);
    else localStorage.removeItem("auth.token");

    if (role) localStorage.setItem("auth.role", role);
    else localStorage.removeItem("auth.role");

    if (name) localStorage.setItem("auth.name", name);
    else localStorage.removeItem("auth.name");

    if (email) localStorage.setItem("auth.email", email);
    else localStorage.removeItem("auth.email");

    if (user) localStorage.setItem("auth.user", JSON.stringify(user));
    else localStorage.removeItem("auth.user");

    localStorage.setItem("auth.departmentIds", JSON.stringify(departmentIds || []));
    localStorage.setItem("auth.departments", JSON.stringify(departments || []));

    if (activeDepartmentId) localStorage.setItem("auth.activeDepartmentId", String(activeDepartmentId));
    else localStorage.removeItem("auth.activeDepartmentId");
  }, [token, role, name, email, user, departmentIds, departments, activeDepartmentId]);

  // ✅ OPTIONAL: On page refresh, if we have departmentIds but departments empty -> refetch
  useEffect(() => {
    if (isAuthenticated && departmentIds.length > 0 && departments.length === 0) {
      fetchDepartments(departmentIds);
    }
  }, [departmentIds, departments.length, fetchDepartments, isAuthenticated]);

  const login = useCallback(async ({ email: loginEmail, password }) => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email: loginEmail, password });

      setToken(res.data.token);
      setRole(res.data.role);
      setName(res.data.name);
      setEmail(res.data.email);

      setUser({
        id: res.data.id,
        email: res.data.email,
        name: res.data.name,
        role: res.data.role,
      });

      const deptIds = res.data.departmentIds || [];
      setDepartmentIds(deptIds);

      const allowed = await fetchDepartments(deptIds);

      // ✅ always set active dept after login
      if (allowed.length > 0) {
        setActiveDepartmentId(String(allowed[0].id));
      } else {
        setActiveDepartmentId(null);
      }

      return { ok: true };
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "Login failed. Check credentials.";
      return { ok: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [fetchDepartments]);

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setName(null);
    setEmail(null);
    setUser(null);

    setDepartmentIds([]);
    setDepartments([]);
    setActiveDepartmentId(null);

    localStorage.removeItem("auth.token");
    localStorage.removeItem("auth.role");
    localStorage.removeItem("auth.name");
    localStorage.removeItem("auth.email");
    localStorage.removeItem("auth.user");
    localStorage.removeItem("auth.departmentIds");
    localStorage.removeItem("auth.departments");
    localStorage.removeItem("auth.activeDepartmentId");
  }, []);

  const hasRole = useCallback((...roles) => {
    if (!role) return false;
    return roles.map(String).map((r) => r.toLowerCase()).includes(role.toLowerCase());
  }, [role]);

  // ✅ Department switch
  const switchDepartment = useCallback((deptId) => {
    setActiveDepartmentId(deptId ? String(deptId) : null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      role,
      name,
      email,
      user,
      isAuthenticated,
      loading,

      login,
      logout,
      hasRole,

      // ✅ department exports
      departmentIds,
      departments,
      activeDepartmentId,
      switchDepartment,

      // setters if needed
      setToken,
      setRole,
      setName,
      setEmail,
      setUser,
      setDepartmentIds,
      setDepartments,
      setActiveDepartmentId,
    }),
    [
      token,
      role,
      name,
      email,
      user,
      isAuthenticated,
      loading,
      login,
      logout,
      hasRole,
      departmentIds,
      departments,
      activeDepartmentId,
      switchDepartment,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
