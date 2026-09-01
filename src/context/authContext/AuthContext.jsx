/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

const AuthContext = createContext(null);
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_EXPIRES_AT_KEY = "auth.expiresAt";

const getStoredJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const isStoredSessionExpired = () => {
  const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => (isStoredSessionExpired() ? null : localStorage.getItem("auth.token")));
  const [role, setRole] = useState(() => (isStoredSessionExpired() ? null : localStorage.getItem("auth.role")));
  const [name, setName] = useState(() => (isStoredSessionExpired() ? null : localStorage.getItem("auth.name")));
  const [email, setEmail] = useState(() => (isStoredSessionExpired() ? null : localStorage.getItem("auth.email")));
  const [canManageExtensions, setCanManageExtensions] = useState(
    () => !isStoredSessionExpired() && localStorage.getItem("auth.canManageExtensions") === "true"
  );
  const [canManagePolicies, setCanManagePolicies] = useState(
    () => !isStoredSessionExpired() && localStorage.getItem("auth.canManagePolicies") === "true"
  );

  const [user, setUser] = useState(() => {
    if (isStoredSessionExpired()) return null;
    return getStoredJson("auth.user", null);
  });

  // ✅ departmentIds from login
  const [departmentIds, setDepartmentIds] = useState(() => {
    if (isStoredSessionExpired()) return [];
    return getStoredJson("auth.departmentIds", []);
  });

  // ✅ department objects from /api/departments (filtered)
  const [departments, setDepartments] = useState(() => {
    if (isStoredSessionExpired()) return [];
    return getStoredJson("auth.departments", []);
  });

  // ✅ active dept (selected)
  const [activeDepartmentId, setActiveDepartmentId] = useState(() => {
    if (isStoredSessionExpired()) return null;
    return localStorage.getItem("auth.activeDepartmentId") || null;
  });
  const [sessionExpiresAt, setSessionExpiresAt] = useState(() => {
    if (isStoredSessionExpired()) return null;
    const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
    return Number.isFinite(expiresAt) ? expiresAt : null;
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

    localStorage.setItem("auth.canManageExtensions", String(!!canManageExtensions));
    localStorage.setItem("auth.canManagePolicies", String(!!canManagePolicies));

    if (user) localStorage.setItem("auth.user", JSON.stringify(user));
    else localStorage.removeItem("auth.user");

    localStorage.setItem("auth.departmentIds", JSON.stringify(departmentIds || []));
    localStorage.setItem("auth.departments", JSON.stringify(departments || []));

    if (activeDepartmentId) localStorage.setItem("auth.activeDepartmentId", String(activeDepartmentId));
    else localStorage.removeItem("auth.activeDepartmentId");

    if (sessionExpiresAt) localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(sessionExpiresAt));
    else localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  }, [
    token,
    role,
    name,
    email,
    canManageExtensions,
    canManagePolicies,
    user,
    departmentIds,
    departments,
    activeDepartmentId,
    sessionExpiresAt,
  ]);

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
      const nextExpiresAt = Date.now() + SESSION_DURATION_MS;

      localStorage.setItem("auth.token", res.data.token);
      localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(nextExpiresAt));

      setToken(res.data.token);
      setSessionExpiresAt(nextExpiresAt);
      setRole(res.data.role);
      setName(res.data.name);
      setEmail(res.data.email);
      setCanManageExtensions(!!res.data.canManageExtensions);
      setCanManagePolicies(!!res.data.canManagePolicies);

      setUser({
        id: res.data.id,
        email: res.data.email,
        name: res.data.name,
        role: res.data.role,
        canManageExtensions: !!res.data.canManageExtensions,
        canManagePolicies: !!res.data.canManagePolicies,
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
    setCanManageExtensions(false);
    setCanManagePolicies(false);
    setUser(null);

    setDepartmentIds([]);
    setDepartments([]);
    setActiveDepartmentId(null);
    setSessionExpiresAt(null);

    localStorage.removeItem("auth.token");
    localStorage.removeItem("auth.role");
    localStorage.removeItem("auth.name");
    localStorage.removeItem("auth.email");
    localStorage.removeItem("auth.canManageExtensions");
    localStorage.removeItem("auth.canManagePolicies");
    localStorage.removeItem("auth.user");
    localStorage.removeItem("auth.departmentIds");
    localStorage.removeItem("auth.departments");
    localStorage.removeItem("auth.activeDepartmentId");
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return undefined;

    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      logout();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      logout();
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, logout, sessionExpiresAt]);

  useEffect(() => {
    const handleExpiredSession = () => logout();
    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, [logout]);

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
      canManageExtensions,
      canManagePolicies,
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
      setCanManageExtensions,
      setCanManagePolicies,
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
      canManageExtensions,
      canManagePolicies,
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
