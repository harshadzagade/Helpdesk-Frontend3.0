// src/pages/Department.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import Table from '../components/Table';
import Searchbar from '../components/Searchbar';
import FormInput from '../components/FormInput';
import api from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext'; // adjust path if needed
import Swal from 'sweetalert2';

const uniqueTypes = [
  { value: 'Service', label: 'Service' },
  { value: 'Regular', label: 'Regular' },
];

const toStr = (v) => (v == null ? '' : String(v));

const csvToArray = (csv = '') =>
  String(csv)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const getTypeOption = (type) => {
  const value = toStr(type).trim().toLowerCase();
  return uniqueTypes.find((opt) => opt.value.toLowerCase() === value) || null;
};

// Custom TagsInput component (with Tailwind classes)
const TagsInput = ({ label, name, value = '', onChange, disabled, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  
  // Parse value as comma-separated string into tags array
  const tags = toStr(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      const alreadyExists = tags.some((tag) => tag.toLowerCase() === newTag.toLowerCase());
      if (newTag && !alreadyExists) {
        // Append to the comma-separated string
        const newValue = value ? `${value}, ${newTag}` : newTag;
        onChange({ target: { value: newValue } });
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    const newValue = newTags.join(', ');
    onChange({ target: { value: newValue } });
  };

  return (
    <div className="w-full"> {/* Matches FormInput width */}
      <label htmlFor={name} className="block text-sm font-bold text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 border border-gray-300 rounded-md px-3 py-2 min-h-[2.5rem] bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} className="inline-flex items-center bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm font-medium">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 text-red-500 hover:text-red-700 font-bold text-lg leading-none bg-transparent border-none cursor-pointer p-0"
                aria-label="Remove tag"
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          id={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[8rem] bg-transparent border-none outline-none text-sm placeholder-gray-500"
        />
      </div>
    </div>
  );
};

const Department = () => {
  const { hasRole } = useAuth();
  const isSuperadmin = hasRole('superadmin');

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    id: null,
    department: '',
    type: null,        // react-select option
    category: '',      // CSV; backend normalizes
  });

  const showCategory = toStr(form.type?.value).trim().toLowerCase() === 'service';

  const resetForm = () => {
    setForm({ id: null, department: '', type: null, category: '' });
    setIsEditing(false);
  };

  // fetch list
  const fetchDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/departments');
      setItems(res.data || []);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load departments';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Load Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };
  console.log("Department items:", items);

  useEffect(() => { fetchDepartments(); }, []);

  // client search
  const filtered = useMemo(() => {
    const q = toStr(query).trim().toLowerCase();
    if (!q) return items;
    return items.filter(d =>
      toStr(d.department).toLowerCase().includes(q) ||
      toStr(d.type).toLowerCase().includes(q) ||
      toStr(Array.isArray(d.category) ? d.category.join(', ') : d.category).toLowerCase().includes(q)
    );
  }, [items, query]);

  // submit (create/update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      department: form.department.trim(),
      type: form.type?.value || '',
      category: showCategory ? csvToArray(form.category) : ['N/A'],
    };
    

    if (!payload.department || !payload.type) {
      setError('Department and Type are required');
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Please fill Department and Type.' });
      return;
    }

    try {
      setLoading(true);
      Swal.fire({ title: 'Please wait…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      if (isEditing && form.id) {
        await api.put(`/api/departments/${form.id}`, payload);
        await Swal.fire({ icon: 'success', title: 'Updated', text: 'Department updated successfully.' });
      } else {
        await api.post('/api/departments/createdepartment', payload);
        await Swal.fire({ icon: 'success', title: 'Created', text: 'Department created successfully.' });
      }

      resetForm();
      setIsFormVisible(false);
      fetchDepartments();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Save failed';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Save Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // edit
  const onEdit = (row) => {
    if (!isSuperadmin) {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Only superadmin can edit.' });
      return;
    }
    setForm({
      id: row.id,
      department: row.department || '',
      type: getTypeOption(row.type),
      category: toStr(row.type).trim().toLowerCase() === 'service'
        ? (Array.isArray(row.category) ? row.category.join(', ') : (row.category || ''))
        : '',
    });
    setIsEditing(true);
    setIsFormVisible(true);
  };

  // delete
  const onDelete = async (row) => {
    if (!isSuperadmin) {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Only superadmin can delete.' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Delete "${row.department}"?`,
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Deleting…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await api.delete(`/api/departments/${row.id}`);
      await Swal.fire({ icon: 'success', title: 'Deleted', text: 'Department deleted.' });
      fetchDepartments();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Delete failed';
      Swal.fire({ icon: 'error', title: 'Delete Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // columns
  const columns = [
    { key: 'department', label: 'Department Name' },
    { key: 'type', label: 'Type' },
    {
      key: 'category',
      label: 'Category',
      format: (v) => Array.isArray(v) ? v.join(', ') : (v || '-'),
    },    
  ];
  

  // actions (superadmin only)
  const actions = isSuperadmin
    ? [
        { label: 'Edit', onClick: onEdit,   className: 'bg-blue-500 hover:bg-blue-600' },
        { label: 'Delete', onClick: onDelete, className: 'bg-red-500 hover:bg-red-600' },
      ]
    : [];

  const handleRowClick = (row) => { if (isSuperadmin) onEdit(row); };

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Department</h1>

      <div className="flex justify-between items-center mb-4">
        <Searchbar
          value={query}
          onChange={(v) => setQuery(v?.target ? v.target.value : toStr(v))}
          placeholder="Search department..."
        />
        {isSuperadmin && (
          <button
            onClick={() => {
              if (isFormVisible && isEditing) resetForm();
              setIsFormVisible(!isFormVisible);
            }}
            className="ml-4 px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-brand-secondary-200 transition-colors"
          >
            {isFormVisible ? 'Close Form' : 'Add Department'}
          </button>
        )}
      </div>

      {isFormVisible && (
        <div className="mb-4 p-4 border border-gray-300 rounded shadow">
          {!isSuperadmin && (
            <div className="mb-3 text-sm text-orange-700 bg-orange-50 p-2 rounded">
              Only superadmin can submit changes. You’re in read-only mode.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={`grid grid-cols-3  gap-4`}>
              <FormInput
                label="Department Name"
                name="department"
                type="text"
                required
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                disabled={!isSuperadmin || loading}
              />

              <div >
                <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                <Select
                  options={uniqueTypes}
                  placeholder="Select Type"
                  name="type"
                  value={form.type}
                  onChange={(opt) => {
                    const newCategory = opt?.value === 'Service' ? form.category : '';
                    setForm((f) => ({ ...f, type: opt, category: newCategory }));
                  }}
                  isClearable
                  isDisabled={!isSuperadmin || loading}
                />
              </div>

              {showCategory && (
                <TagsInput
                  label="Category"
                  name="category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  disabled={!isSuperadmin || loading}
                  placeholder="e.g. Hardware, Software, Network"
                />
              )}
            </div>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            {isSuperadmin && (
              <button
                type="submit"
                disabled={loading}
                className="mt-4 px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-60"
              >
                {loading ? (isEditing ? 'Updating…' : 'Creating…') : (isEditing ? 'Update' : 'Submit')}
              </button>
            )}
          </form>
        </div>
      )}

      <Table
        data={filtered}
        columns={columns}
        actions={actions}
        onRowClick={handleRowClick}
        isFormVisible={isFormVisible}
        setIsFormVisible={setIsFormVisible}
        loading={loading}
        emptyText="No departments found"
      />
    </>
  );
};

export default Department;
