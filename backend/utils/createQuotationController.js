import { normalizeQuotationPayload, validateQuotationPayload } from './normalizeQuotationPayload.js';

const populateOptions = [
  { path: 'client', select: 'clientName mailId clientNumber' },
  { path: 'lead', select: 'name businessName contactNumber status' },
  { path: 'project', select: 'projectName status' },
  { path: 'preparedBy', select: 'name email' },
];

const getQuotationError = (error, fallback) => {
  if (!error) return { status: 500, message: fallback };
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return { status: 400, message: messages.join(', ') || error.message || fallback };
  }
  if (error.code === 11000) {
    return { status: 409, message: 'Quotation number already exists' };
  }
  return { status: 500, message: error.message || fallback };
};

const generateQuotationNumber = async (Quotation) => {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  const count = await Quotation.countDocuments({ quotationNumber: new RegExp(`^${prefix}`) });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

export const createQuotationController = (Quotation) => {
  const createQuotation = async (req, res) => {
    try {
      const payload = normalizeQuotationPayload(req.body);
      const missing = validateQuotationPayload(payload);
      if (missing.length) {
        return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      }

      if (!payload.quotationNumber) {
        payload.quotationNumber = await generateQuotationNumber(Quotation);
      }

      const quotation = await Quotation.create(payload);
      const populated = await Quotation.findById(quotation._id).populate(populateOptions);
      res.status(201).json({ message: 'Quotation created successfully', quotation: populated });
    } catch (error) {
      const { status, message } = getQuotationError(error, 'Error creating quotation');
      res.status(status).json({ message });
    }
  };

  const getQuotations = async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.client) filter.client = req.query.client;
      if (req.query.preparedBy) filter.preparedBy = req.query.preparedBy;

      const quotations = await Quotation.find(filter)
        .populate(populateOptions)
        .sort({ createdAt: -1 });
      res.status(200).json(quotations);
    } catch (error) {
      const { status, message } = getQuotationError(error, 'Error fetching quotations');
      res.status(status).json({ message });
    }
  };

  const getQuotationById = async (req, res) => {
    try {
      const quotation = await Quotation.findById(req.params.id).populate(populateOptions);
      if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
      res.status(200).json(quotation);
    } catch (error) {
      const { status, message } = getQuotationError(error, 'Error fetching quotation');
      res.status(status).json({ message });
    }
  };

  const updateQuotation = async (req, res) => {
    try {
      const payload = normalizeQuotationPayload(req.body);
      const missing = validateQuotationPayload(payload);
      if (missing.length) {
        return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      }

      const updated = await Quotation.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      }).populate(populateOptions);

      if (!updated) return res.status(404).json({ message: 'Quotation not found' });
      res.status(200).json({ message: 'Quotation updated successfully', quotation: updated });
    } catch (error) {
      const { status, message } = getQuotationError(error, 'Error updating quotation');
      res.status(status).json({ message });
    }
  };

  const deleteQuotation = async (req, res) => {
    try {
      const deleted = await Quotation.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Quotation not found' });
      res.status(200).json({ message: 'Quotation deleted successfully' });
    } catch (error) {
      const { status, message } = getQuotationError(error, 'Error deleting quotation');
      res.status(status).json({ message });
    }
  };

  return {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
  };
};
