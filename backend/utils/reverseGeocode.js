/**
 * Shared reverse-geocode for site visits / travel (Nominatim + optional Google).
 * Used by CRM APIs so web + Flutter get the same place names.
 */

const COORD_ONLY_RE = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;
const cache = new Map();

export const isCoordOnlyAddress = (address) => {
  const trimmed = String(address || '').trim();
  if (!trimmed) return false;
  return COORD_ONLY_RE.test(trimmed);
};

export const formatCoords = (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

const buildAddressFromNominatim = (data) => {
  const a = data?.address || {};
  const parts = [
    a.house_number,
    a.building,
    a.road || a.pedestrian || a.footway,
    a.neighbourhood || a.suburb || a.quarter,
    a.village || a.city_district || a.district,
    a.city || a.town || a.municipality,
    a.state,
    a.postcode,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return String(data?.display_name || '').trim();
};

const googleMapsKey = () =>
  String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
  ).trim();

const reverseViaGoogle = async (lat, lon) => {
  const key = googleMapsKey();
  if (!key) return '';
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lon)}` +
      `&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    if (data?.status !== 'OK' || !Array.isArray(data.results) || !data.results[0]) return '';
    return String(data.results[0].formatted_address || '').trim();
  } catch {
    return '';
  }
};

const reverseViaNominatim = async (lat, lon) => {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
      `&format=json&addressdetails=1&zoom=18`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MultiCRM-Backend/1.0',
      },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return buildAddressFromNominatim(data);
  } catch {
    return '';
  }
};

/**
 * Reverse-geocode lat/lon → place name.
 * Prefers Google Geocoding when GOOGLE_MAPS_API_KEY is set; falls back to Nominatim.
 */
export const resolveAddressFromCoords = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';

  const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let address = await reverseViaGoogle(lat, lon);
  if (!address) address = await reverseViaNominatim(lat, lon);

  if (address) cache.set(cacheKey, address);
  return address || '';
};

/**
 * Ensure address is a place name. If missing or coord-only, reverse-geocode.
 */
export const resolveAddressOrCoords = async (latitude, longitude, existingAddress = '') => {
  const current = String(existingAddress || '').trim();
  if (current && !isCoordOnlyAddress(current)) return current;

  const resolved = await resolveAddressFromCoords(latitude, longitude);
  if (resolved) return resolved;
  return current || formatCoords(latitude, longitude);
};
