import { SITE_VISIT_STATUSES, SITE_VISIT_TYPES } from './siteVisitFields.js';
import {
  buildGoogleMapsDirectionsUrl,
  getTravelRatePerKm,
  pathDistanceBetweenTimes,
  totalTrackedDistanceKm,
  haversineKm,
  roundKm,
} from './travelDistance.js';

const MIN_TRACK_METERS = 25;
const MAX_TRACK_POINTS_PER_DAY = 2500;
import { endOfBusinessDay, startOfBusinessDay } from './businessTime.js';
import { isCoordOnlyAddress, resolveAddressOrCoords } from './reverseGeocode.js';

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

const toBoolOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return null;
};

const buildPayload = (body = {}) => ({
  property: body.property || null,
  lead: body.lead || null,
  visitorName: String(body.visitorName || '').trim(),
  visitorPhone: String(body.visitorPhone || '').trim(),
  visitorEmail: String(body.visitorEmail || '').trim(),
  visitType: SITE_VISIT_TYPES.includes(body.visitType) ? body.visitType : 'First Visit',
  status: SITE_VISIT_STATUSES.includes(body.status) ? body.status : 'Scheduled',
  scheduledAt: toDateOrNull(body.scheduledAt),
  durationMinutes: toNumberOrNull(body.durationMinutes) || 60,
  assignedTo: body.assignedTo || null,
  meetingPoint: String(body.meetingPoint || '').trim(),
  address: String(body.address || '').trim(),
  city: String(body.city || '').trim(),
  notes: String(body.notes || ''),
  outcome: String(body.outcome || ''),
  interested: toBoolOrNull(body.interested),
  feedback: String(body.feedback || ''),
  createdBy: body.createdBy || null,
});

const populateVisit = (SiteVisit, id) =>
  SiteVisit.findById(id)
    .populate('property', 'title propertyCode locality city address status listingType latitude longitude googleMapLink')
    .populate('lead', 'name businessName contactNumber')
    .populate('assignedTo', 'name email phone')
    .populate('createdBy', 'name email');

const parseCoords = (body = {}) => {
  const latitude = toNumberOrNull(body.latitude ?? body.lat);
  const longitude = toNumberOrNull(body.longitude ?? body.lng ?? body.lon);
  if (latitude == null || longitude == null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    latitude,
    longitude,
    address: String(body.address || '').trim(),
  };
};

/** Same as parseCoords, but fills place name via shared reverse-geocode API. */
const parseAndResolveCoords = async (body = {}) => {
  const coords = parseCoords(body);
  if (!coords) return null;
  coords.address = await resolveAddressOrCoords(coords.latitude, coords.longitude, coords.address);
  return coords;
};

const enrichPointAddress = async (point) => {
  if (!point) return point;
  const lat = toNumberOrNull(point.latitude);
  const lon = toNumberOrNull(point.longitude);
  if (lat == null || lon == null) return point;
  const address = await resolveAddressOrCoords(lat, lon, point.address);
  return { ...point, address };
};

const serializeJourney = (journey, journeyNumber = null) => {
  if (!journey) return null;
  return {
    id: journey._id,
    journeyNumber,
    date: journey.date,
    status: journey.status,
    startedAt: journey.startedAt,
    startLatitude: journey.startLatitude,
    startLongitude: journey.startLongitude,
    startAddress: journey.startAddress || '',
    endedAt: journey.endedAt,
    endLatitude: journey.endLatitude,
    endLongitude: journey.endLongitude,
    endAddress: journey.endAddress || '',
    trackPointCount: journey.trackPoints?.length || 0,
    distanceKm: roundKm(totalTrackedDistanceKm(journey.trackPoints)),
    mapsUrl:
      journey.startLatitude != null && journey.startLongitude != null
        ? `https://www.google.com/maps?q=${journey.startLatitude},${journey.startLongitude}`
        : null,
  };
};

const findJourneysForDay = async (TravelJourney, employeeId, dayStart) => {
  if (!TravelJourney || !employeeId) return [];
  return TravelJourney.find({ employee: employeeId, date: dayStart }).sort({ startedAt: 1 });
};

const findActiveJourneyForDay = async (TravelJourney, employeeId, dayStart) => {
  if (!TravelJourney || !employeeId) return null;
  return TravelJourney.findOne({ employee: employeeId, date: dayStart, status: 'active' }).sort({
    startedAt: -1,
  });
};

const getVisitsForJourney = (journey, journeyIdx, allJourneys, checkedIn) => {
  const nextStart = allJourneys[journeyIdx + 1]?.startedAt;
  return checkedIn.filter((v) => {
    if (v.travelJourneyId) {
      return String(v.travelJourneyId) === String(journey._id);
    }
    const t = new Date(v.checkInAt).getTime();
    const startMs = new Date(journey.startedAt).getTime();
    if (t < startMs) return false;
    if (nextStart && t >= new Date(nextStart).getTime()) return false;
    if (journey.endedAt && t > new Date(journey.endedAt).getTime()) return false;
    return true;
  });
};

const buildTimelineFromJourneys = (journeys, checkedIn) => {
  const timeline = [];

  journeys.forEach((journey, journeyIdx) => {
    const journeyNum = journeyIdx + 1;

    if (journey.startLatitude != null && journey.startLongitude != null) {
      timeline.push({
        type: 'journey_start',
        journeyId: journey._id,
        journeyNumber: journeyNum,
        siteVisitId: null,
        visitorName: `Journey ${journeyNum} start`,
        property: null,
        address: journey.startAddress || '',
        city: '',
        status: journey.status,
        scheduledAt: null,
        checkInAt: journey.startedAt,
        checkOutAt: null,
        latitude: journey.startLatitude,
        longitude: journey.startLongitude,
        mapsUrl: `https://www.google.com/maps?q=${journey.startLatitude},${journey.startLongitude}`,
        segmentKm: 0,
        travelExpenseId: null,
      });
    }

    const journeyVisits = getVisitsForJourney(journey, journeyIdx, journeys, checkedIn);
    journeyVisits.forEach((v, idx) => {
      let segmentKm = 0;
      const fromTime = idx === 0 ? journey.startedAt : journeyVisits[idx - 1].checkInAt;
      const fromPoint =
        idx === 0
          ? { latitude: journey.startLatitude, longitude: journey.startLongitude }
          : {
              latitude: journeyVisits[idx - 1].checkInLatitude,
              longitude: journeyVisits[idx - 1].checkInLongitude,
            };
      segmentKm = pathDistanceBetweenTimes(
        journey.trackPoints,
        fromTime,
        v.checkInAt,
        fromPoint,
        { latitude: v.checkInLatitude, longitude: v.checkInLongitude }
      );

      timeline.push({
        type: 'check_in',
        journeyId: journey._id,
        journeyNumber: journeyNum,
        siteVisitId: v._id,
        visitorName: v.visitorName,
        property: v.property,
        address: v.checkInAddress || v.address,
        city: v.city,
        status: v.status,
        scheduledAt: v.scheduledAt,
        checkInAt: v.checkInAt,
        checkOutAt: v.checkOutAt,
        latitude: v.checkInLatitude,
        longitude: v.checkInLongitude,
        mapsUrl: `https://www.google.com/maps?q=${v.checkInLatitude},${v.checkInLongitude}`,
        segmentKm,
        travelExpenseId: v.travelExpenseId || null,
      });
    });

    if (
      journey.status === 'ended'
      && journey.endLatitude != null
      && journey.endLongitude != null
    ) {
      const lastPoint = timeline[timeline.length - 1];
      const segmentKm =
        lastPoint?.latitude != null && lastPoint?.longitude != null
          ? pathDistanceBetweenTimes(
              journey.trackPoints,
              lastPoint.checkInAt || journey.startedAt,
              journey.endedAt,
              { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
              { latitude: journey.endLatitude, longitude: journey.endLongitude }
            )
          : 0;
      timeline.push({
        type: 'journey_end',
        journeyId: journey._id,
        journeyNumber: journeyNum,
        siteVisitId: null,
        visitorName: `Journey ${journeyNum} end`,
        property: null,
        address: journey.endAddress || '',
        city: '',
        status: 'ended',
        scheduledAt: null,
        checkInAt: journey.endedAt,
        checkOutAt: null,
        latitude: journey.endLatitude,
        longitude: journey.endLongitude,
        mapsUrl: `https://www.google.com/maps?q=${journey.endLatitude},${journey.endLongitude}`,
        segmentKm,
        travelExpenseId: null,
      });
    }
  });

  return timeline;
};

const mergeTrackPointsFromJourneys = (journeys = []) => {
  const merged = [];
  journeys.forEach((journey) => {
    (journey.trackPoints || []).forEach((p) => merged.push(p));
  });
  return serializeTrackPoints(merged);
};

const totalDistanceForJourneys = (journeys = []) => {
  const tracked = roundKm(
    journeys.reduce((sum, j) => sum + totalTrackedDistanceKm(j.trackPoints), 0)
  );
  return tracked;
};

const sortTrackPoints = (trackPoints = []) =>
  (Array.isArray(trackPoints) ? trackPoints : [])
    .slice()
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

const appendTrackPoint = (
  journey,
  { latitude, longitude, address = '', source = 'track', siteVisitId = null, recordedAt = new Date() }
) => {
  if (!journey) return false;
  if (!Array.isArray(journey.trackPoints)) journey.trackPoints = [];

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  const last = journey.trackPoints[journey.trackPoints.length - 1];
  if (last && source === 'track') {
    const movedM = haversineKm(last.latitude, last.longitude, lat, lon) * 1000;
    if (movedM < MIN_TRACK_METERS) return false;
  }

  if (journey.trackPoints.length >= MAX_TRACK_POINTS_PER_DAY) return false;

  journey.trackPoints.push({
    latitude: lat,
    longitude: lon,
    recordedAt,
    source,
    siteVisitId: siteVisitId || null,
    address: String(address || '').trim(),
  });
  return true;
};

const serializeTrackPoints = (trackPoints = []) =>
  sortTrackPoints(trackPoints).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    recordedAt: p.recordedAt,
    source: p.source || 'track',
    siteVisitId: p.siteVisitId || null,
    address: p.address || '',
  }));

export const createSiteVisitHandlers = ({ SiteVisit, Expense = null, TravelJourney = null }) => {
  const createSiteVisit = async (req, res) => {
    try {
      const payload = buildPayload(req.body);
      if (!payload.visitorName) {
        return res.status(400).json({ message: 'Visitor name is required' });
      }
      if (!payload.scheduledAt) {
        return res.status(400).json({ message: 'Scheduled date and time are required' });
      }
      const visit = await SiteVisit.create(payload);
      const populated = await populateVisit(SiteVisit, visit._id);
      return res.status(201).json({ message: 'Site visit scheduled', siteVisit: populated });
    } catch (error) {
      return res.status(500).json({ message: 'Error scheduling site visit', error: error?.message || error });
    }
  };

  const getSiteVisits = async (req, res) => {
    try {
      const { status, assignedTo, propertyId, from, to, search } = req.query;
      const filter = {};
      if (status?.trim()) filter.status = status.trim();
      if (assignedTo?.trim()) filter.assignedTo = assignedTo.trim();
      if (propertyId?.trim()) filter.property = propertyId.trim();
      if (from || to) {
        filter.scheduledAt = {};
        if (from) filter.scheduledAt.$gte = new Date(from);
        if (to) filter.scheduledAt.$lte = new Date(to);
      }
      if (search?.trim()) {
        const q = search.trim();
        filter.$or = [
          { visitorName: new RegExp(q, 'i') },
          { visitorPhone: new RegExp(q, 'i') },
          { visitorEmail: new RegExp(q, 'i') },
          { city: new RegExp(q, 'i') },
          { meetingPoint: new RegExp(q, 'i') },
          { address: new RegExp(q, 'i') },
        ];
      }
      const visits = await SiteVisit.find(filter)
        .populate('property', 'title propertyCode locality city address status listingType latitude longitude googleMapLink')
        .populate('lead', 'name businessName contactNumber')
        .populate('assignedTo', 'name email phone')
        .populate('createdBy', 'name email')
        .sort({ scheduledAt: 1 });
      return res.status(200).json(visits);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching site visits', error: error?.message || error });
    }
  };

  const getSiteVisitById = async (req, res) => {
    try {
      const visit = await populateVisit(SiteVisit, req.params.id);
      if (!visit) return res.status(404).json({ message: 'Site visit not found' });
      return res.status(200).json(visit);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching site visit', error: error?.message || error });
    }
  };

  const updateSiteVisit = async (req, res) => {
    try {
      const payload = buildPayload(req.body);
      if (!payload.visitorName) {
        return res.status(400).json({ message: 'Visitor name is required' });
      }
      if (!payload.scheduledAt) {
        return res.status(400).json({ message: 'Scheduled date and time are required' });
      }
      if (req.body.createdBy === undefined) delete payload.createdBy;

      const visit = await SiteVisit.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      });
      if (!visit) return res.status(404).json({ message: 'Site visit not found' });
      const populated = await populateVisit(SiteVisit, visit._id);
      return res.status(200).json({ message: 'Site visit updated', siteVisit: populated });
    } catch (error) {
      return res.status(500).json({ message: 'Error updating site visit', error: error?.message || error });
    }
  };

  const deleteSiteVisit = async (req, res) => {
    try {
      const visit = await SiteVisit.findByIdAndDelete(req.params.id);
      if (!visit) return res.status(404).json({ message: 'Site visit not found' });
      return res.status(200).json({ message: 'Site visit deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting site visit', error: error?.message || error });
    }
  };

  const startTravelJourney = async (req, res) => {
    try {
      if (!TravelJourney) {
        return res.status(500).json({ message: 'Travel journey model is not configured for this tenant' });
      }

      const employeeId = String(req.body.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const coords = await parseAndResolveCoords(req.body);
      if (!coords) {
        return res.status(400).json({ message: 'Valid latitude and longitude are required to start journey' });
      }

      const now = new Date();
      const dayStart = startOfBusinessDay(now);
      const active = await findActiveJourneyForDay(TravelJourney, employeeId, dayStart);

      if (active?.startedAt) {
        return res.status(409).json({
          message: 'You already have an active journey. End it before starting another.',
          journey: serializeJourney(active),
        });
      }

      const dayJourneys = await findJourneysForDay(TravelJourney, employeeId, dayStart);
      const journeyNumber = dayJourneys.length + 1;

      const journey = new TravelJourney({
        employee: employeeId,
        date: dayStart,
        status: 'active',
        startedAt: now,
        startLatitude: coords.latitude,
        startLongitude: coords.longitude,
        startAddress: coords.address,
        endedAt: null,
        endLatitude: null,
        endLongitude: null,
        endAddress: '',
        trackPoints: [],
      });

      appendTrackPoint(journey, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: coords.address,
        source: 'journey_start',
        recordedAt: now,
      });
      await journey.save();

      return res.status(200).json({
        message: `Journey ${journeyNumber} started — GPS tracking is on`,
        journey: serializeJourney(journey, journeyNumber),
        journeyNumber,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error starting journey', error: error?.message || error });
    }
  };

  const endTravelJourney = async (req, res) => {
    try {
      if (!TravelJourney) {
        return res.status(500).json({ message: 'Travel journey model is not configured for this tenant' });
      }

      const employeeId = String(req.body.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const coords = await parseAndResolveCoords(req.body);
      const now = new Date();
      const dayStart = startOfBusinessDay(req.body.date ? new Date(req.body.date) : now);
      const journeyId = String(req.body.journeyId || '').trim();
      let journey = journeyId
        ? await TravelJourney.findOne({ _id: journeyId, employee: employeeId, date: dayStart })
        : await findActiveJourneyForDay(TravelJourney, employeeId, dayStart);

      if (!journey?.startedAt) {
        return res.status(400).json({ message: 'No active journey to end. Start a journey first.' });
      }
      if (journey.status === 'ended') {
        return res.status(409).json({
          message: 'This journey is already ended',
          journey: serializeJourney(journey),
        });
      }

      journey.status = 'ended';
      journey.endedAt = now;
      if (coords) {
        journey.endLatitude = coords.latitude;
        journey.endLongitude = coords.longitude;
        journey.endAddress = coords.address;
        appendTrackPoint(journey, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: coords.address,
          source: 'journey_end',
          recordedAt: now,
        });
      }
      await journey.save();

      return res.status(200).json({
        message: 'Journey ended',
        journey: serializeJourney(journey),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error ending journey', error: error?.message || error });
    }
  };

  const checkInSiteVisit = async (req, res) => {
    try {
      const coords = await parseAndResolveCoords(req.body);
      if (!coords) {
        return res.status(400).json({ message: 'Valid latitude and longitude are required to check in' });
      }

      const visit = await SiteVisit.findById(req.params.id);
      if (!visit) return res.status(404).json({ message: 'Site visit not found' });

      const employeeId = req.body.employeeId || visit.assignedTo;
      const now = new Date();
      const dayStart = startOfBusinessDay(now);
      const dayEnd = endOfBusinessDay(now);

      let travelFromPreviousKm = null;
      const journey = employeeId
        ? await findActiveJourneyForDay(TravelJourney, employeeId, dayStart)
        : null;
      const journeyActive = Boolean(journey?.startedAt && journey.status === 'active');

      if (journeyActive && employeeId) {
        const previous = await SiteVisit.findOne({
          _id: { $ne: visit._id },
          assignedTo: employeeId,
          travelJourneyId: journey._id,
          checkInAt: { $gte: journey.startedAt, $lte: dayEnd },
          checkInLatitude: { $ne: null },
          checkInLongitude: { $ne: null },
        })
          .sort({ checkInAt: -1 })
          .select('checkInLatitude checkInLongitude checkInAt');

        const fromTime = previous?.checkInAt || journey.startedAt;
        const fromPoint = previous
          ? { latitude: previous.checkInLatitude, longitude: previous.checkInLongitude }
          : { latitude: journey.startLatitude, longitude: journey.startLongitude };

        travelFromPreviousKm = pathDistanceBetweenTimes(
          journey.trackPoints,
          fromTime,
          now,
          fromPoint,
          { latitude: coords.latitude, longitude: coords.longitude }
        );

        appendTrackPoint(journey, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: coords.address,
          source: 'check_in',
          siteVisitId: visit._id,
          recordedAt: now,
        });
        await journey.save();
      }

      visit.checkInAt = now;
      visit.checkInLatitude = coords.latitude;
      visit.checkInLongitude = coords.longitude;
      visit.checkInAddress = coords.address;
      visit.travelFromPreviousKm = travelFromPreviousKm;
      visit.travelJourneyId = journeyActive ? journey._id : visit.travelJourneyId || null;
      if (visit.status === 'Scheduled' || visit.status === 'Confirmed') {
        visit.status = 'Confirmed';
      }
      await visit.save();

      const populated = await populateVisit(SiteVisit, visit._id);
      return res.status(200).json({
        message: journeyActive
          ? 'Checked in at site'
          : 'Checked in at site (start journey to calculate travel distance)',
        siteVisit: populated,
        travelFromPreviousKm,
        journeyStarted: journeyActive,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error checking in', error: error?.message || error });
    }
  };

  const checkOutSiteVisit = async (req, res) => {
    try {
      const coords = await parseAndResolveCoords(req.body);
      if (!coords) {
        return res.status(400).json({ message: 'Valid latitude and longitude are required to check out' });
      }

      const visit = await SiteVisit.findById(req.params.id);
      if (!visit) return res.status(404).json({ message: 'Site visit not found' });
      if (!visit.checkInAt) {
        return res.status(400).json({ message: 'Check in before checking out' });
      }

      const now = new Date();
      visit.checkOutAt = now;
      visit.checkOutLatitude = coords.latitude;
      visit.checkOutLongitude = coords.longitude;
      visit.checkOutAddress = coords.address;
      if (visit.status !== 'Cancelled' && visit.status !== 'No Show') {
        visit.status = 'Completed';
      }
      await visit.save();

      const employeeId = req.body.employeeId || visit.assignedTo;
      const dayStart = startOfBusinessDay(now);
      const journey = employeeId
        ? await findActiveJourneyForDay(TravelJourney, employeeId, dayStart)
        : null;
      if (journey?.startedAt && journey.status === 'active') {
        appendTrackPoint(journey, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: coords.address,
          source: 'check_out',
          siteVisitId: visit._id,
          recordedAt: now,
        });
        await journey.save();
      }

      const populated = await populateVisit(SiteVisit, visit._id);
      return res.status(200).json({ message: 'Checked out from site', siteVisit: populated });
    } catch (error) {
      return res.status(500).json({ message: 'Error checking out', error: error?.message || error });
    }
  };

  const getTravelTimeline = async (req, res) => {
    try {
      const employeeId = String(req.query.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const date = req.query.date ? new Date(req.query.date) : new Date();
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }

      const dayStart = startOfBusinessDay(date);
      const dayEnd = endOfBusinessDay(date);
      const ratePerKm = getTravelRatePerKm();
      const journeys = await findJourneysForDay(TravelJourney, employeeId, dayStart);
      const activeJourney = journeys.find((j) => j.status === 'active') || null;
      const journeyStarted = journeys.length > 0;

      const visits = await SiteVisit.find({
        assignedTo: employeeId,
        $or: [
          { scheduledAt: { $gte: dayStart, $lte: dayEnd } },
          { checkInAt: { $gte: dayStart, $lte: dayEnd } },
        ],
      })
        .populate('property', 'title propertyCode locality city address latitude longitude googleMapLink')
        .populate('lead', 'name businessName contactNumber')
        .populate('assignedTo', 'name email phone')
        .sort({ checkInAt: 1, scheduledAt: 1 });

      const checkedIn = visits
        .filter((v) => v.checkInLatitude != null && v.checkInLongitude != null)
        .sort((a, b) => new Date(a.checkInAt) - new Date(b.checkInAt));

      const timeline = buildTimelineFromJourneys(journeys, checkedIn);
      const segmentSumKm = roundKm(timeline.reduce((sum, p) => sum + (Number(p.segmentKm) || 0), 0));
      const trackedKm = journeyStarted ? totalDistanceForJourneys(journeys) : 0;
      const totalDistanceKm = journeyStarted ? (trackedKm > 0 ? trackedKm : segmentSumKm) : 0;
      const estimatedExpense = roundKm(totalDistanceKm * ratePerKm, 0);
      const routeUrl = journeyStarted ? buildGoogleMapsDirectionsUrl(timeline) : null;
      const trackPoints = mergeTrackPointsFromJourneys(journeys);

      const enrichedTimeline = await Promise.all(timeline.map((p) => enrichPointAddress(p)));
      const journeysPayload = journeys.map((j, idx) => serializeJourney(j, idx + 1));
      const activeIdx = activeJourney
        ? journeys.findIndex((j) => String(j._id) === String(activeJourney._id))
        : -1;
      const journeyPayload = activeJourney
        ? serializeJourney(activeJourney, activeIdx >= 0 ? activeIdx + 1 : null)
        : journeysPayload[journeysPayload.length - 1] || null;

      for (const j of journeys) {
        if (j.startLatitude != null && isCoordOnlyAddress(j.startAddress)) {
          const startAddress = await resolveAddressOrCoords(j.startLatitude, j.startLongitude, j.startAddress);
          if (startAddress && !isCoordOnlyAddress(startAddress)) {
            j.startAddress = startAddress;
            await j.save().catch(() => {});
          }
        }
        if (j.endLatitude != null && isCoordOnlyAddress(j.endAddress)) {
          const endAddress = await resolveAddressOrCoords(j.endLatitude, j.endLongitude, j.endAddress);
          if (endAddress && !isCoordOnlyAddress(endAddress)) {
            j.endAddress = endAddress;
            await j.save().catch(() => {});
          }
        }
      }

      return res.status(200).json({
        date: dayStart.toISOString(),
        employeeId,
        ratePerKm,
        totalDistanceKm,
        estimatedExpense,
        currency: 'INR',
        routeUrl,
        journey: journeyPayload,
        journeys: journeysPayload,
        journeyCount: journeys.length,
        activeJourneyId: activeJourney?._id || null,
        journeyStarted,
        trackPoints,
        distanceMode: trackedKm > 0 ? 'gps_trail' : 'segment_fallback',
        visits,
        timeline: enrichedTimeline,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error building travel timeline', error: error?.message || error });
    }
  };

  const allocateTravelExpense = async (req, res) => {
    try {
      if (!Expense) {
        return res.status(500).json({ message: 'Expense model is not configured for this tenant' });
      }

      const employeeId = String(req.body.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const date = req.body.date ? new Date(req.body.date) : new Date();
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }

      const dayStart = startOfBusinessDay(date);
      const dayEnd = endOfBusinessDay(date);
      const ratePerKm = toNumberOrNull(req.body.ratePerKm) || getTravelRatePerKm();
      const journeys = await findJourneysForDay(TravelJourney, employeeId, dayStart);

      if (!journeys.length) {
        return res.status(400).json({
          message: 'Start at least one journey before allocating travel expense',
        });
      }

      if (journeys.some((j) => j.status === 'active')) {
        return res.status(400).json({
          message: 'End the active journey before allocating travel expense for the day',
        });
      }

      const visits = await SiteVisit.find({
        assignedTo: employeeId,
        checkInAt: { $gte: dayStart, $lte: dayEnd },
        checkInLatitude: { $ne: null },
        checkInLongitude: { $ne: null },
      }).sort({ checkInAt: 1 });

      if (!visits.length) {
        return res.status(400).json({
          message: 'Need at least one GPS check-in after starting a journey to allocate travel expense',
        });
      }

      const checkedIn = visits;
      journeys.forEach((journey, journeyIdx) => {
        const journeyVisits = getVisitsForJourney(journey, journeyIdx, journeys, checkedIn);
        journeyVisits.forEach((cur, idx) => {
          const fromTime = idx === 0 ? journey.startedAt : journeyVisits[idx - 1].checkInAt;
          const fromPoint =
            idx === 0
              ? { latitude: journey.startLatitude, longitude: journey.startLongitude }
              : {
                  latitude: journeyVisits[idx - 1].checkInLatitude,
                  longitude: journeyVisits[idx - 1].checkInLongitude,
                };
          cur.travelFromPreviousKm = pathDistanceBetweenTimes(
            journey.trackPoints,
            fromTime,
            cur.checkInAt,
            fromPoint,
            { latitude: cur.checkInLatitude, longitude: cur.checkInLongitude }
          );
        });
      });

      let totalDistanceKm = totalDistanceForJourneys(journeys);
      if (totalDistanceKm <= 0) {
        const timeline = buildTimelineFromJourneys(journeys, checkedIn);
        totalDistanceKm = roundKm(timeline.reduce((sum, p) => sum + (Number(p.segmentKm) || 0), 0));
      }
      const amount = Math.round(totalDistanceKm * ratePerKm);

      if (amount <= 0) {
        return res.status(400).json({ message: 'Calculated travel distance is zero — nothing to allocate' });
      }

      const already = visits.find((v) => v.travelExpenseId);
      if (already?.travelExpenseId && !req.body.force) {
        return res.status(409).json({
          message: 'Travel expense already allocated for this day. Pass force=true to create another.',
          expenseId: already.travelExpenseId,
        });
      }

      const ymd = dayStart.toISOString().slice(0, 10);
      const expense = await Expense.create({
        description: `Site visit travel (${ymd}) · ${totalDistanceKm} km × ₹${ratePerKm}/km · ${journeys.length} journey(s) · ${visits.length} check-in(s)`,
        amount,
        date: dayStart,
        category: 'Travel',
      });

      const now = new Date();
      await Promise.all(
        visits.map((v) => {
          v.travelExpenseId = expense._id;
          v.travelExpenseAllocatedAt = now;
          return v.save();
        })
      );

      const routePoints = [];
      journeys.forEach((journey) => {
        if (journey.startLatitude != null) {
          routePoints.push({ latitude: journey.startLatitude, longitude: journey.startLongitude });
        }
        getVisitsForJourney(
          journey,
          journeys.indexOf(journey),
          journeys,
          checkedIn
        ).forEach((v) => {
          routePoints.push({ latitude: v.checkInLatitude, longitude: v.checkInLongitude });
        });
        if (journey.endLatitude != null) {
          routePoints.push({ latitude: journey.endLatitude, longitude: journey.endLongitude });
        }
      });

      return res.status(201).json({
        message: 'Travel expense allocated',
        expense,
        totalDistanceKm,
        ratePerKm,
        amount,
        visitCount: visits.length,
        journeyCount: journeys.length,
        journeys: journeys.map((j, idx) => serializeJourney(j, idx + 1)),
        routeUrl: buildGoogleMapsDirectionsUrl(routePoints),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error allocating travel expense', error: error?.message || error });
    }
  };

  const recordJourneyTrack = async (req, res) => {
    try {
      if (!TravelJourney) {
        return res.status(500).json({ message: 'Travel journey model is not configured for this tenant' });
      }

      const employeeId = String(req.body.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const coords = parseCoords(req.body);
      if (!coords) {
        return res.status(400).json({ message: 'Valid latitude and longitude are required' });
      }

      const now = new Date();
      const dayStart = startOfBusinessDay(req.body.date ? new Date(req.body.date) : now);
      const journey = await findActiveJourneyForDay(TravelJourney, employeeId, dayStart);

      if (!journey?.startedAt || journey.status !== 'active') {
        return res.status(400).json({ message: 'No active journey — start a journey first' });
      }

      const added = appendTrackPoint(journey, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: coords.address,
        source: 'track',
        recordedAt: now,
      });

      if (added) await journey.save();

      return res.status(200).json({
        message: added ? 'Location recorded on journey trail' : 'Location unchanged (too close to last point)',
        recorded: added,
        trackPointCount: journey.trackPoints?.length || 0,
        totalDistanceKm: totalTrackedDistanceKm(journey.trackPoints),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error recording journey track', error: error?.message || error });
    }
  };

  return {
    createSiteVisit,
    getSiteVisits,
    getSiteVisitById,
    updateSiteVisit,
    deleteSiteVisit,
    checkInSiteVisit,
    checkOutSiteVisit,
    startTravelJourney,
    endTravelJourney,
    recordJourneyTrack,
    getTravelTimeline,
    allocateTravelExpense,
  };
};
