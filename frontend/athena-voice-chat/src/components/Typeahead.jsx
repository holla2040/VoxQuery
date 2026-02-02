import React, { useState, useRef, useEffect } from 'react';

// Schema keywords for autocomplete
const SCHEMA_KEYWORDS = {
  columns: [
    'employee_id', 'first_name', 'last_name', 'email', 'department',
    'job_title', 'salary', 'hire_date', 'city', 'state',
    'latitude', 'longitude', 'status'
  ],
  departments: [
    'Engineering', 'Product', 'Design', 'Marketing',
    'Sales', 'HR', 'Finance', 'Operations'
  ],
  cities: [
    'San Francisco', 'Los Angeles', 'Seattle', 'New York',
    'Austin', 'Denver', 'Chicago', 'Boston', 'Miami', 'Portland'
  ],
  states: [
    'California', 'Washington', 'New York', 'Texas',
    'Colorado', 'Illinois', 'Massachusetts', 'Florida', 'Oregon'
  ],
  keywords: [
    'show', 'list', 'find', 'get', 'count', 'average', 'total', 'sum',
    'employees', 'salary', 'department', 'city', 'state',
    'highest', 'lowest', 'top', 'bottom', 'recent', 'oldest',
    'group by', 'order by', 'sort by', 'filter', 'where',
    'in', 'from', 'and', 'or', 'not', 'between', 'like',
    'active', 'inactive', 'on a map', 'chart', 'graph'
  ]
};

// Flatten all keywords for search
const ALL_KEYWORDS = [
  ...SCHEMA_KEYWORDS.columns,
  ...SCHEMA_KEYWORDS.departments,
  ...SCHEMA_KEYWORDS.cities,
  ...SCHEMA_KEYWORDS.states,
  ...SCHEMA_KEYWORDS.keywords
];

/**
 * Typeahead input component with schema-aware autocomplete
 */
export default function Typeahead({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Update suggestions when value changes
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Get the last word being typed
    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (lastWord.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Find matching keywords
    const matches = ALL_KEYWORDS
      .filter(kw => kw.toLowerCase().includes(lastWord))
      .slice(0, 8);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(-1);
  }, [value]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          setShowSuggestions(false);
          onSubmit(value);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      default:
        break;
    }
  };

  const selectSuggestion = (suggestion) => {
    // Replace the last word with the suggestion
    const words = value.split(/\s+/);
    words[words.length - 1] = suggestion;
    const newValue = words.join(' ') + ' ';

    onChange(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleBlur = (e) => {
    // Delay hiding to allow click on suggestions
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="typeahead-container">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="typeahead-input"
        autoComplete="off"
      />

      {showSuggestions && (
        <ul ref={suggestionsRef} className="typeahead-suggestions">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              className={`typeahead-suggestion ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
