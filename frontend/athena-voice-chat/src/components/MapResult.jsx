import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Map result component using Leaflet
 *
 * Displays markers for rows with lat/lon coordinates.
 * Auto-fits bounds to show all markers.
 */
export default function MapResult({ rows, mapConfig }) {
  const { lat_column, lon_column, popup_fields } = mapConfig || {};

  // Filter rows that have valid coordinates
  const validRows = useMemo(() => {
    return rows.filter(row => {
      const lat = parseFloat(row[lat_column]);
      const lon = parseFloat(row[lon_column]);
      return !isNaN(lat) && !isNaN(lon);
    });
  }, [rows, lat_column, lon_column]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (validRows.length === 0) return null;

    const lats = validRows.map(row => parseFloat(row[lat_column]));
    const lons = validRows.map(row => parseFloat(row[lon_column]));

    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)]
    ];
  }, [validRows, lat_column, lon_column]);

  if (validRows.length === 0) {
    return (
      <div className="map-no-data">
        No location data to display. Ensure your query returns latitude and longitude columns.
      </div>
    );
  }

  // Default center (US)
  const defaultCenter = [39.8283, -98.5795];
  const initialCenter = bounds
    ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
    : defaultCenter;

  return (
    <div className="map-container">
      <MapContainer
        center={initialCenter}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit bounds */}
        {bounds && <FitBounds bounds={bounds} />}

        {/* Markers */}
        {validRows.map((row, index) => (
          <Marker
            key={index}
            position={[
              parseFloat(row[lat_column]),
              parseFloat(row[lon_column])
            ]}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -35]}>
              {getMarkerLabel(row)}
            </Tooltip>
            <Popup>
              <PopupContent row={row} fields={popup_fields} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-footer">
        Showing {validRows.length} location{validRows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/**
 * Component to fit map bounds
 */
function FitBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);

  return null;
}

/**
 * Popup content component
 */
function PopupContent({ row, fields }) {
  const displayFields = fields && fields.length > 0
    ? fields
    : Object.keys(row).filter(k => !['latitude', 'longitude', 'lat', 'lon', 'lng'].includes(k.toLowerCase()));

  return (
    <div className="map-popup">
      {displayFields.slice(0, 6).map(field => (
        <div key={field} className="popup-row">
          <span className="popup-label">{field}:</span>
          <span className="popup-value">{formatValue(row[field])}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(value) {
  if (value == null) return '-';
  const num = parseFloat(value);
  if (!isNaN(num) && Number.isInteger(num) && num > 1000) {
    return num.toLocaleString();
  }
  return String(value);
}

/**
 * Get a label for the marker tooltip
 * Looks for name fields in common patterns
 */
function getMarkerLabel(row) {
  // Try first_name + last_name
  if (row.first_name && row.last_name) {
    return `${row.first_name} ${row.last_name}`;
  }
  // Try name field
  if (row.name) {
    return row.name;
  }
  // Try full_name field
  if (row.full_name) {
    return row.full_name;
  }
  // Fallback: find first string field that looks like a name
  const nameKeys = Object.keys(row).filter(k =>
    k.toLowerCase().includes('name') &&
    !['latitude', 'longitude'].includes(k.toLowerCase())
  );
  if (nameKeys.length > 0) {
    return row[nameKeys[0]];
  }
  // Last resort: city or first non-coordinate field
  if (row.city) return row.city;
  const firstKey = Object.keys(row).find(k =>
    !['latitude', 'longitude', 'lat', 'lon', 'lng'].includes(k.toLowerCase())
  );
  return firstKey ? row[firstKey] : 'Location';
}
