const CSC_BASE_URL = 'https://api.countrystatecity.in/v1';

const getHeaders = () => ({
  'X-CSCAPI-KEY': process.env.STATEANDCITY_API_KEY || '',
});

const ensureApiKey = (res) => {
  if (!process.env.STATEANDCITY_API_KEY) {
    res.status(500).json({ message: 'STATEANDCITY_API_KEY is not configured' });
    return false;
  }
  return true;
};

export const getStates = async (req, res) => {
  if (!ensureApiKey(res)) return;
  try {
    let response = await fetch(`${CSC_BASE_URL}/countries/IN/states`, {
      headers: getHeaders(),
    });

    // Fallback for accounts configured with a generic states endpoint
    if (!response.ok) {
      response = await fetch(`${CSC_BASE_URL}/states`, {
        headers: getHeaders(),
      });
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: 'Failed to fetch states', error: text });
    }

    const states = await response.json();
    const normalized = Array.isArray(states)
      ? states.map((s) => ({ name: s.name, iso2: s.iso2 || s.state_code || '' }))
      : [];
    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching states', error: error?.message || error });
  }
};

export const getCitiesByState = async (req, res) => {
  if (!ensureApiKey(res)) return;
  try {
    const stateCode = String(req.query.stateCode || '').trim();
    if (!stateCode) return res.status(400).json({ message: 'stateCode is required' });

    let response = await fetch(`${CSC_BASE_URL}/countries/IN/states/${encodeURIComponent(stateCode)}/cities`, {
      headers: getHeaders(),
    });

    // Fallback format in case of different API plan/format
    if (!response.ok) {
      response = await fetch(`${CSC_BASE_URL}/states/${encodeURIComponent(stateCode)}/cities`, {
        headers: getHeaders(),
      });
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: 'Failed to fetch cities', error: text });
    }

    const cities = await response.json();
    const normalized = Array.isArray(cities)
      ? cities.map((c) => ({ name: c.name }))
      : [];
    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cities', error: error?.message || error });
  }
};

