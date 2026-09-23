import {
  AREA_UNITS,
  DEVELOPMENT_STATUSES,
  FURNISHED_STATUSES,
  LAND_TYPES,
  LISTING_TYPES,
  PARKING_TYPES,
  PROPERTY_CATEGORIES,
  PROPERTY_SOURCES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  VERIFICATION_STATUSES,
} from './propertyFields.js';

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
};

const normalizeAmenities = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeImageUrls = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildPayload = (body = {}) => ({
  title: String(body.title || '').trim(),
  propertyCode: String(body.propertyCode || '').trim(),
  propertyType: PROPERTY_TYPES.includes(body.propertyType) ? body.propertyType : 'Apartment',
  propertyCategory: PROPERTY_CATEGORIES.includes(body.propertyCategory) ? body.propertyCategory : 'Residential',
  developmentStatus: DEVELOPMENT_STATUSES.includes(body.developmentStatus) ? body.developmentStatus : 'Ready',
  source: PROPERTY_SOURCES.includes(body.source) ? body.source : 'Owner',
  listingType: LISTING_TYPES.includes(body.listingType) ? body.listingType : 'Sale',
  status: PROPERTY_STATUSES.includes(body.status) ? body.status : 'Available',
  price: toNumberOrNull(body.price),
  expectedPrice: toNumberOrNull(body.expectedPrice),
  pricePerSqft: toNumberOrNull(body.pricePerSqft),
  bookingAmount: toNumberOrNull(body.bookingAmount),
  brokerage: toNumberOrNull(body.brokerage),
  priceUnit: ['Total', 'Per Sq Ft', 'Per Month'].includes(body.priceUnit) ? body.priceUnit : 'Total',
  gstApplicable: toBool(body.gstApplicable, false),
  negotiable: toBool(body.negotiable, true),
  maintenanceCharges: toNumberOrNull(body.maintenanceCharges),
  securityDeposit: toNumberOrNull(body.securityDeposit),
  builtUpArea: toNumberOrNull(body.builtUpArea),
  carpetArea: toNumberOrNull(body.carpetArea),
  plotArea: toNumberOrNull(body.plotArea),
  areaUnit: AREA_UNITS.includes(body.areaUnit) ? body.areaUnit : 'sqft',
  bedrooms: toNumberOrNull(body.bedrooms),
  bathrooms: toNumberOrNull(body.bathrooms),
  balconies: toNumberOrNull(body.balconies),
  parking: toNumberOrNull(body.parking),
  parkingType: PARKING_TYPES.includes(body.parkingType) ? body.parkingType : 'None',
  floor: String(body.floor || '').trim(),
  totalFloors: toNumberOrNull(body.totalFloors),
  facing: String(body.facing || '').trim(),
  furnishedStatus: FURNISHED_STATUSES.includes(body.furnishedStatus) ? body.furnishedStatus : 'Unfurnished',
  ageOfProperty: String(body.ageOfProperty || '').trim(),
  possessionDate: toDateOrNull(body.possessionDate),
  reraNumber: String(body.reraNumber || '').trim(),
  address: String(body.address || '').trim(),
  locality: String(body.locality || '').trim(),
  subLocality: String(body.subLocality || '').trim(),
  city: String(body.city || '').trim(),
  district: String(body.district || '').trim(),
  state: String(body.state || '').trim(),
  country: String(body.country || 'India').trim() || 'India',
  pincode: String(body.pincode || '').trim(),
  landmark: String(body.landmark || '').trim(),
  latitude: toNumberOrNull(body.latitude),
  longitude: toNumberOrNull(body.longitude),
  googleMapLink: String(body.googleMapLink || '').trim(),
  surveyNumber: String(body.surveyNumber || '').trim(),
  gatNumber: String(body.gatNumber || '').trim(),
  khasraNumber: String(body.khasraNumber || '').trim(),
  propertyCardNumber: String(body.propertyCardNumber || '').trim(),
  village: String(body.village || '').trim(),
  taluka: String(body.taluka || '').trim(),
  landType: LAND_TYPES.includes(body.landType) ? body.landType : String(body.landType || '').trim(),
  zoning: String(body.zoning || '').trim(),
  verificationStatus: VERIFICATION_STATUSES.includes(body.verificationStatus)
    ? body.verificationStatus
    : 'Pending',
  verifiedBy: body.verifiedBy || null,
  verifiedDate: toDateOrNull(body.verifiedDate),
  remarks: String(body.remarks || ''),
  description: String(body.description || ''),
  amenities: normalizeAmenities(body.amenities),
  ownerName: String(body.ownerName || '').trim(),
  ownerPhone: String(body.ownerPhone || '').trim(),
  ownerEmail: String(body.ownerEmail || '').trim(),
  listedBy: body.listedBy || null,
  imageUrls: normalizeImageUrls(body.imageUrls),
  notes: String(body.notes || ''),
});

export const createPropertyHandlers = ({ Property }) => {
  const createProperty = async (req, res) => {
    try {
      const payload = buildPayload(req.body);
      if (!payload.title) {
        return res.status(400).json({ message: 'Property title is required' });
      }
      const property = await Property.create(payload);
      const populated = await Property.findById(property._id)
        .populate('listedBy', 'name email')
        .populate('verifiedBy', 'name email');
      return res.status(201).json({ message: 'Property listed successfully', property: populated });
    } catch (error) {
      return res.status(500).json({ message: 'Error creating property', error: error?.message || error });
    }
  };

  const getProperties = async (req, res) => {
    try {
      const {
        status,
        listingType,
        propertyType,
        propertyCategory,
        city,
        search,
      } = req.query;
      const filter = {};
      if (status?.trim()) filter.status = status.trim();
      if (listingType?.trim()) filter.listingType = listingType.trim();
      if (propertyType?.trim()) filter.propertyType = propertyType.trim();
      if (propertyCategory?.trim()) filter.propertyCategory = propertyCategory.trim();
      if (city?.trim()) filter.city = new RegExp(city.trim(), 'i');
      if (search?.trim()) {
        const q = search.trim();
        filter.$or = [
          { title: new RegExp(q, 'i') },
          { propertyCode: new RegExp(q, 'i') },
          { locality: new RegExp(q, 'i') },
          { subLocality: new RegExp(q, 'i') },
          { city: new RegExp(q, 'i') },
          { district: new RegExp(q, 'i') },
          { address: new RegExp(q, 'i') },
          { village: new RegExp(q, 'i') },
          { surveyNumber: new RegExp(q, 'i') },
          { ownerName: new RegExp(q, 'i') },
          { ownerPhone: new RegExp(q, 'i') },
        ];
      }
      const properties = await Property.find(filter)
        .populate('listedBy', 'name email')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 });
      return res.status(200).json(properties);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching properties', error: error?.message || error });
    }
  };

  const getPropertyById = async (req, res) => {
    try {
      const property = await Property.findById(req.params.id)
        .populate('listedBy', 'name email')
        .populate('verifiedBy', 'name email');
      if (!property) return res.status(404).json({ message: 'Property not found' });
      return res.status(200).json(property);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching property', error: error?.message || error });
    }
  };

  const updateProperty = async (req, res) => {
    try {
      const payload = buildPayload(req.body);
      if (!payload.title) {
        return res.status(400).json({ message: 'Property title is required' });
      }
      const property = await Property.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      })
        .populate('listedBy', 'name email')
        .populate('verifiedBy', 'name email');
      if (!property) return res.status(404).json({ message: 'Property not found' });
      return res.status(200).json({ message: 'Property updated', property });
    } catch (error) {
      return res.status(500).json({ message: 'Error updating property', error: error?.message || error });
    }
  };

  const deleteProperty = async (req, res) => {
    try {
      const property = await Property.findByIdAndDelete(req.params.id);
      if (!property) return res.status(404).json({ message: 'Property not found' });
      return res.status(200).json({ message: 'Property deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting property', error: error?.message || error });
    }
  };

  return {
    createProperty,
    getProperties,
    getPropertyById,
    updateProperty,
    deleteProperty,
  };
};
