import React from 'react';
import Swal from 'sweetalert2';

const toStr = (v) => (v == null ? '' : String(v));
const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const initialsOf = (name) => {
  const parts = toStr(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase() || 'U';
};

const copy = async (label, text) => {
  try {
    await navigator.clipboard.writeText(text);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `${label} copied`,
      showConfirmButton: false,
      timer: 1200,
    });
  } catch {
    Swal.fire({ icon: 'error', title: 'Copy failed', text: `Could not copy ${label}.` });
  }
};

export default function EmployeeDetailsV2({ employee = {}, onClose }) {
  const first = toStr(employee.firstname);
  const middle = toStr(employee.middlename);
  const last = toStr(employee.lastname);
  const fullName =
    (first || middle || last)
      ? `${first} ${middle} ${last}`.replace(/\s+/g, ' ').trim()
      : toStr(employee.name);

  const email = toStr(employee.email);
  const departments =
    toArr(employee.departmentNames).length
      ? toArr(employee.departmentNames)
      : (toArr(employee.departmentIds).length
          ? toArr(employee.departmentIds).map((id) => `Dept #${id}`)
          : []);
  const role = toStr(employee.role);
  const contactNo = toStr(employee.phoneNumber || employee.contactNo);
  const extension = toStr(employee.contactExtension || employee.extension);

  return (
    <div className="p-4 border bg-white border-gray-300 rounded shadow mb-4 relative">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-xl">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center text-3xl font-bold text-indigo-700">
            {initialsOf(fullName || email || role)}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl md:text-3xl font-bold truncate">{fullName || 'Unknown User'}</h2>
            <p className="text-sm md:text-base opacity-90">
              {role || '-'}
            </p>
          </div>

          <div className="flex space-x-2 absolute top-4 right-4">
            <button onClick={onClose} className="p-2 rounded-full text-white font-bold" title="Back">
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" className="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Personal Information</h3>

          <div className="flex items-center space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">ID:</span>
            <span className="text-gray-900">{employee.id ?? '-'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">Email:</span>
            {email ? (
              <div className="flex items-center gap-2">
                <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>
                <button onClick={() => copy('Email', email)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Copy</button>
              </div>
            ) : <span className="text-gray-500">-</span>}
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">Contact No:</span>
            {contactNo ? (
              <div className="flex items-center gap-2">
                <a href={`tel:${contactNo}`} className="text-gray-900">{contactNo}</a>
                <button onClick={() => copy('Contact', contactNo)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Copy</button>
              </div>
            ) : <span className="text-gray-500">-</span>}
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">Extension:</span>
            {extension ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-900">{extension}</span>
                <button onClick={() => copy('Extension', extension)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Copy</button>
              </div>
            ) : <span className="text-gray-500">-</span>}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Professional Information</h3>

          <div className="flex items-start space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">Department(s):</span>
            <div className="flex flex-wrap gap-2">
              {departments.length
                ? departments.map((department, index) => (
                    <span key={index} className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {toStr(department)}
                    </span>
                  ))
                : <span className="text-gray-500">-</span>}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-32 text-sm font-medium text-gray-600">Role:</span>
            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {role || '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
