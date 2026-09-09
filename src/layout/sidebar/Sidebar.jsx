// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/authContext/AuthContext'; // adjust path if needed
import Logo from '../../assets/MET-logo.png';

const Sidebar = () => {
  const { role } = useAuth();

  // normalize role (handles common typos)
  const r = String(role || '').toLowerCase();
  const normalizedRole =
    r === 'engineers' || r === 'enginer' ? 'engineer' : r;

  const navItems = [
    { name: 'Home', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Department', path: '/department', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { name: 'Institute', path: '/institute', icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' },
    { name: 'Employee Details', path: '/employee', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { name: 'Complaint', path: '/complaint', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: 'Request', path: '/request', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { name: 'Reports', path: '/reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { name: 'Reminders', path: '/reminders', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9' },
    { name: 'Subadmin Activity', path: '/subadmin-activity', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { name: 'Policies', path: '/policies', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  const showForRole = (itemPath) => {
    // SUPERADMIN: sab dikhe, EXCEPT Subadmin Activity
    if (normalizedRole === 'superadmin') {
      return itemPath !== '/subadmin-activity';
    }
  
    // ADMIN: common + reports + subadmin activity
    if (normalizedRole === 'admin') {
      const adminAllowed = new Set([
        '/',
        '/employee',
        '/complaint',
        '/request',
        '/policies',
        '/reports',
        '/subadmin-activity',
      ]);
      return adminAllowed.has(itemPath);
    }
  
    // USER: sirf limited
    if (normalizedRole === 'user') {
      const userAllowed = new Set([
        '/',
        '/employee',
        '/complaint',
        '/request',
        '/policies',
      ]);
      return userAllowed.has(itemPath);
    }
  
    // SUBADMIN / ENGINEER: common + reports
    const midAllowed = new Set([
      '/',
      '/employee',
      '/complaint',
      '/request',
      '/policies',
      '/reports',
      ...(normalizedRole === 'subadmin' ? ['/subadmin-activity'] : []),
    ]);
    return midAllowed.has(itemPath);
  };
  
  const filteredItems = navItems.filter(i => showForRole(i.path));

  return (
    <div className="h-full bg-white flex flex-col p-4 w-64">
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <img src={Logo} alt="Logo" />
        </div>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1 text-sm font-bold">
          {filteredItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200 ${isActive ? 'bg-gray-100 text-gray-900 font-medium' : ''
                  }`
                }
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
                </svg>
                <span className="text-sm font-bold">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
