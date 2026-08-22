import React, { useState, useMemo } from 'react';
import * as PropTypes from 'prop-types';

function Table({ columns, data, actions, expandable, onRowClick }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const showActions = Array.isArray(actions) && actions.length > 0;

  // Calculate pagination and sorting
  const filteredData = useMemo(() => {
    let result = [...data];

    if (sortConfig.key) {
      const sortColumn = columns.find((column) => column.key === sortConfig.key);
      const sortKey = sortColumn?.valueKey || sortConfig.key;

      result.sort((a, b) => {
        if (a[sortKey] < b[sortKey]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortKey] > b[sortKey]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [columns, data, sortConfig]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Pagination and sorting handlers
  const handlePageChange = (page) => setCurrentPage(page);
  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value));
    setCurrentPage(1);
  };
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  return (
    <div className="font-sans w-full max-w-full min-w-0">
      <div className="w-full max-w-full min-w-0 overflow-x-auto">
        <table className="w-full min-w-max bg-white shadow-md rounded-lg">
        <thead className="bg-gray-300 text-gray-900">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-sm font-bold uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center text-sm ">
                  {column.label}
                  {sortConfig.key === column.key && (
                    <span>{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </div>
              </th>
            ))}
            {showActions && (
              <th className="px-6 py-3 text-left text-sm font-bold uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}

                className="px-6 py-4 text-center text-gray-500 text-sm"
              >
                No data available
              </td>
            </tr>
          ) : (
            paginatedData.map((row, index) => (
              <React.Fragment key={index}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 text-sm text-gray-900">
                      {column.format
                        ? column.format(row[column.valueKey || column.key], row)
                        : (row[column.valueKey || column.key] || '-')}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-4 text-sm align-top min-w-[180px]">
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                          action.render ? (
                            <div key={action.label}>{action.render(row)}</div>
                          ) : (
                            (() => {
                              const isDisabled =
                                typeof action.disabled === 'function'
                                  ? action.disabled(row)
                                  : !!action.disabled;

                              return (
                                <button
                                  key={action.label}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDisabled) return;
                                    action.onClick(row);
                                  }}
                                  disabled={isDisabled}
                                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold text-white whitespace-nowrap ${action.className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {action.label}
                                </button>
                              );
                            })()
                          )
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
                {expandable && expandable.rowExpandable(row) && expandable.expandedRowKeys.includes(row.poId) && (
                  <tr>
                    <td colSpan={columns.length + (showActions ? 1 : 0)}
                      className="px-6 py-4">
                      {expandable.expandedRowRender(row)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="flex flex-wrap justify-between items-center gap-3 mt-4 px-2 sm:px-6 py-3 rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
            </span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size} className="text-gray-900">
                  {size} per page
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md text-sm ${currentPage === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                }`}
            >
              Previous
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded-md text-sm ${currentPage === page
                  ? 'bg-gray-300 text-gray-900'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md text-sm ${currentPage === totalPages
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Table.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      valueKey: PropTypes.string,
      label: PropTypes.string.isRequired,
      format: PropTypes.func,
    })
  ).isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      className: PropTypes.string,
      render: PropTypes.func,
      disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    })
  ),
  expandable: PropTypes.shape({
    expandedRowRender: PropTypes.func,
    rowExpandable: PropTypes.func,
    expandedRowKeys: PropTypes.arrayOf(PropTypes.any),
  }),
  onRowClick: PropTypes.func,
};

Table.defaultProps = {
  actions: null,
  expandable: null,
  onRowClick: null,
};

export default Table;
