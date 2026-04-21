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
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, sortConfig]);

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
    <div className="overflow-x-auto font-sans">
      <table className="min-w-full bg-white shadow-md rounded-lg ">
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
                      {column.format ? column.format(row[column.key]) : (row[column.key] || '-')}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-6 py-4 text-sm">
                      <div className="flex space-x-2">
                        {actions.map((action) => (
                          action.render ? (
                            <div key={action.label}>{action.render(row)}</div>
                          ) : (
                            <button
                              key={action.label}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              className={`px-3 py-1 rounded-md text-white ${action.className}`}
                            >
                              {action.label}
                            </button>
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

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="flex justify-between items-center mt-4 px-6 py-3  rounded-lg">
          <div className="flex items-center space-x-2">
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
          <div className="flex space-x-1">
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