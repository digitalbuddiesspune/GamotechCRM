import mongoose from 'mongoose';

export const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Independent House',
  'Plot',
  'Commercial',
  'Office',
  'Shop',
  'Warehouse',
  'Farmhouse',
  'Other',
];

export const PROPERTY_CATEGORIES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Agricultural',
];

export const DEVELOPMENT_STATUSES = [
  'Ready',
  'Under Construction',
  'New Launch',
  'Pre Launch',
  'Redevelopment',
];

export const PROPERTY_SOURCES = [
  'Owner',
  'Broker',
  'Builder',
  'Developer',
  'Internal',
];

export const PARKING_TYPES = [
  'None',
  'Open',
  'Covered',
  'Stilt',
  'Basement',
  'Stack',
];

export const VERIFICATION_STATUSES = [
  'Pending',
  'Verified',
  'Rejected',
  'Needs Review',
];

export const LAND_TYPES = [
  'Agricultural',
  'Non-Agricultural',
  'NA',
  'Industrial',
  'Residential',
  'Commercial',
  'Other',
];

export const LISTING_TYPES = ['Sale', 'Rent', 'Lease'];

export const PROPERTY_STATUSES = [
  'Available',
  'Reserved',
  'Sold',
  'Rented',
  'Under Negotiation',
  'Off Market',
];

export const FURNISHED_STATUSES = [
  'Unfurnished',
  'Semi-Furnished',
  'Fully Furnished',
];

export const AREA_UNITS = ['sqft', 'sqm', 'acre', 'guntha'];

export const getPropertySchemaFields = (employeeRef) => ({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  propertyCode: {
    type: String,
    trim: true,
    default: '',
  },
  propertyType: {
    type: String,
    enum: PROPERTY_TYPES,
    default: 'Apartment',
  },
  propertyCategory: {
    type: String,
    enum: PROPERTY_CATEGORIES,
    default: 'Residential',
    index: true,
  },
  developmentStatus: {
    type: String,
    enum: DEVELOPMENT_STATUSES,
    default: 'Ready',
  },
  source: {
    type: String,
    enum: PROPERTY_SOURCES,
    default: 'Owner',
  },
  listingType: {
    type: String,
    enum: LISTING_TYPES,
    default: 'Sale',
  },
  status: {
    type: String,
    enum: PROPERTY_STATUSES,
    default: 'Available',
    index: true,
  },
  price: {
    type: Number,
    default: null,
    min: 0,
  },
  expectedPrice: {
    type: Number,
    default: null,
    min: 0,
  },
  pricePerSqft: {
    type: Number,
    default: null,
    min: 0,
  },
  bookingAmount: {
    type: Number,
    default: null,
    min: 0,
  },
  brokerage: {
    type: Number,
    default: null,
    min: 0,
  },
  priceUnit: {
    type: String,
    enum: ['Total', 'Per Sq Ft', 'Per Month'],
    default: 'Total',
  },
  gstApplicable: {
    type: Boolean,
    default: false,
  },
  negotiable: {
    type: Boolean,
    default: true,
  },
  maintenanceCharges: {
    type: Number,
    default: null,
    min: 0,
  },
  securityDeposit: {
    type: Number,
    default: null,
    min: 0,
  },
  builtUpArea: {
    type: Number,
    default: null,
    min: 0,
  },
  carpetArea: {
    type: Number,
    default: null,
    min: 0,
  },
  plotArea: {
    type: Number,
    default: null,
    min: 0,
  },
  areaUnit: {
    type: String,
    enum: AREA_UNITS,
    default: 'sqft',
  },
  bedrooms: {
    type: Number,
    default: null,
    min: 0,
  },
  bathrooms: {
    type: Number,
    default: null,
    min: 0,
  },
  balconies: {
    type: Number,
    default: null,
    min: 0,
  },
  parking: {
    type: Number,
    default: null,
    min: 0,
  },
  parkingType: {
    type: String,
    enum: PARKING_TYPES,
    default: 'None',
  },
  floor: {
    type: String,
    default: '',
    trim: true,
  },
  totalFloors: {
    type: Number,
    default: null,
    min: 0,
  },
  facing: {
    type: String,
    default: '',
    trim: true,
  },
  furnishedStatus: {
    type: String,
    enum: FURNISHED_STATUSES,
    default: 'Unfurnished',
  },
  ageOfProperty: {
    type: String,
    default: '',
    trim: true,
  },
  possessionDate: {
    type: Date,
    default: null,
  },
  reraNumber: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
    trim: true,
  },
  locality: {
    type: String,
    default: '',
    trim: true,
  },
  subLocality: {
    type: String,
    default: '',
    trim: true,
  },
  city: {
    type: String,
    default: '',
    trim: true,
    index: true,
  },
  district: {
    type: String,
    default: '',
    trim: true,
  },
  state: {
    type: String,
    default: '',
    trim: true,
  },
  country: {
    type: String,
    default: 'India',
    trim: true,
  },
  pincode: {
    type: String,
    default: '',
    trim: true,
  },
  landmark: {
    type: String,
    default: '',
    trim: true,
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  googleMapLink: {
    type: String,
    default: '',
    trim: true,
  },
  // Land details
  surveyNumber: {
    type: String,
    default: '',
    trim: true,
  },
  gatNumber: {
    type: String,
    default: '',
    trim: true,
  },
  khasraNumber: {
    type: String,
    default: '',
    trim: true,
  },
  propertyCardNumber: {
    type: String,
    default: '',
    trim: true,
  },
  village: {
    type: String,
    default: '',
    trim: true,
  },
  taluka: {
    type: String,
    default: '',
    trim: true,
  },
  landType: {
    type: String,
    default: '',
    trim: true,
  },
  zoning: {
    type: String,
    default: '',
    trim: true,
  },
  verificationStatus: {
    type: String,
    enum: VERIFICATION_STATUSES,
    default: 'Pending',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
  },
  verifiedDate: {
    type: Date,
    default: null,
  },
  remarks: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  amenities: {
    type: [String],
    default: [],
  },
  ownerName: {
    type: String,
    default: '',
    trim: true,
  },
  ownerPhone: {
    type: String,
    default: '',
    trim: true,
  },
  ownerEmail: {
    type: String,
    default: '',
    trim: true,
  },
  listedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
  },
  imageUrls: {
    type: [String],
    default: [],
  },
  notes: {
    type: String,
    default: '',
  },
});
