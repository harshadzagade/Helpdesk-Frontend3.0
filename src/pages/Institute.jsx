// src/pages/Institute.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Table from '../components/Table';
import Searchbar from '../components/Searchbar';
import FormInput from '../components/FormInput';
import api from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext';
import Swal from 'sweetalert2';

const toStr = (v) => (v == null ? '' : String(v));

const Institute = () => {
  const { hasRole } = useAuth();
  const isSuperadmin = hasRole('superadmin');

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({ id: null, institute: '' });

  const resetForm = () => {
    setForm({ id: null, institute: '' });
    setIsEditing(false);
  };

  const fetchInstitutes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/institutes');
      setItems(res.data || []);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load institutes';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Load Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstitutes(); }, []);

  const filtered = useMemo(() => {
    const q = toStr(query).trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => toStr(i.institute).toLowerCase().includes(q));
  }, [items, query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { institute: form.institute.trim() };
    if (!payload.institute) {
      setError('Institute name is required');
      Swal.fire({ icon: 'warning', title: 'Missing field', text: 'Please enter an institute name.' });
      return;
    }

    try {
      setLoading(true);
      if (isEditing && form.id) {
        await api.put(`/api/institutes/${form.id}`, payload);
        await Swal.fire({ icon: 'success', title: 'Updated', text: 'Institute updated successfully.' });
      } else {
        await api.post('/api/institutes/createinstitute', payload);
        await Swal.fire({ icon: 'success', title: 'Created', text: 'Institute created successfully.' });
      }
      resetForm();
      setIsFormVisible(false);
      fetchInstitutes();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Save failed';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Save Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (row) => {
    if (!isSuperadmin) {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Only superadmin can edit.' });
      return;
    }
    setForm({ id: row.id, institute: row.institute || '' });
    setIsEditing(true);
    setIsFormVisible(true);
  };

  const onDelete = async (row) => {
    if (!isSuperadmin) {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Only superadmin can delete.' });
      return;
    }
    const confirm = await Swal.fire({
      title: `Delete "${row.institute}"?`,
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
      await api.delete(`/api/institutes/${row.id}`);
      await Swal.fire({ icon: 'success', title: 'Deleted', text: 'Institute deleted.' });
      fetchInstitutes();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Delete failed';
      Swal.fire({ icon: 'error', title: 'Delete Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'institute', label: 'Institute Name' },
  ];

  const actions = isSuperadmin
    ? [
        { label: 'Edit', onClick: onEdit, className: 'bg-blue-500 hover:bg-blue-600' },
        { label: 'Delete', onClick: onDelete, className: 'bg-red-500 hover:bg-red-600' },
      ]
    : [];

  const handleRowClick = (row) => { if (isSuperadmin) onEdit(row); };

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Institute</h1>

      <div className="flex justify-between items-center mb-4">
        <Searchbar
          value={query}
          onChange={(v) => setQuery(v?.target ? v.target.value : toStr(v))}
          placeholder="Search institute..."
        />
        {isSuperadmin && (
          <button
            onClick={() => {
              if (isFormVisible && isEditing) resetForm();
              setIsFormVisible(!isFormVisible);
            }}
            className="ml-4 px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-brand-secondary-200 transition-colors"
          >
            {isFormVisible ? 'Close Form' : 'Add Institute'}
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

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label="Institute Name"
              name="institute"
              type="text"
              required
              value={form.institute}
              onChange={(e) => setForm((f) => ({ ...f, institute: e.target.value }))}
              disabled={!isSuperadmin || loading}
            />

            {error && <div className="md:col-span-2 text-sm text-red-600 self-center">{error}</div>}

            {isSuperadmin && (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-60 self-end"
              >
                {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update' : 'Submit')}
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
        emptyText="No institutes found"
      />
    </>
  );
};

export default Institute;
