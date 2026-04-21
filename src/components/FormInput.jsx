import React from 'react';
import PropTypes from 'prop-types';

function FormInput({ label, type, name, value, onChange, error, options, required, accept }) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-bold text-gray-700">
        {label} {required && <span className="text-brand-primary">*</span>}
      </label>
      {type === 'select' ? (
        <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={`block w-full rounded-md py-1.5 px-2 ring-1 ring-inset ring-gray-400 focus:text-gray-800 ${
          error ? 'border-red-500' : ''
        }`}
        required={required}
      >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : type === 'file' ? (
        <input
          type="file"
          id={name}
          name={name}
          onChange={(e) => onChange(e)} // Pass event directly for file input
          accept={accept} // Add accept attribute for file types
          className={`mt-1 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-brand-primary file:text-white
            hover:file:bg-brand-primary-dark
            ${error ? 'border-red-500' : ''}`}
          required={required}
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          className={`block w-full rounded-md py-1.5 px-2 ring-1 ring-inset ring-gray-400 focus:text-gray-800 ${
            error ? 'border-red-500' : ''
          }`}
          required={required}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

FormInput.propTypes = {
  label: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['text', 'number', 'date', 'select', 'file']).isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  required: PropTypes.bool,
  accept: PropTypes.string, // Add accept prop for file input
};

FormInput.defaultProps = {
  error: null,
  options: [],
  required: false,
  accept: null,
};

export default FormInput;