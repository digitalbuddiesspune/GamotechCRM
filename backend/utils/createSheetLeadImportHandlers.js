import { mapSheetStatusToCrmStatus, parseMetaLeadCsv } from './parseMetaLeadCsv.js';
import { assertCanManageLeads, resolveLeadAccess } from './leadAccess.js';

const buildCrmDescription = (row) =>
  [
    row.remark ? `Remark: ${row.remark}` : '',
    row.configurationInterest ? `Configuration: ${row.configurationInterest}` : '',
    row.propertyUsedFor ? `Used for: ${row.propertyUsedFor}` : '',
    row.visitPreference ? `Visit: ${row.visitPreference}` : '',
    row.pickupRequested ? `Pickup: ${row.pickupRequested}` : '',
    row.executiveName ? `Executive: ${row.executiveName}` : '',
    row.campaignName ? `Campaign: ${row.campaignName}` : '',
    row.platform ? `Platform: ${row.platform}` : '',
    row.sheetLeadStatus ? `Sheet status: ${row.sheetLeadStatus}` : '',
  ]
    .filter(Boolean)
    .join('\n');

export function createSheetLeadImportHandlers({
  SheetLead,
  Lead,
  Employee,
  tenantKey,
}) {
  const resolveOwnerId = async (importedBy) => {
    if (importedBy) return importedBy;

    const envMap = {
      gamotechSolution: ['GAMOTECH_ADS_LEAD_OWNER_ID', 'GAMOTECH_ADS_LEAD_OWNER_EMAIL'],
    };
    const [idKey, emailKey] = envMap[tenantKey] || [];
    if (idKey && process.env[idKey]) return process.env[idKey];
    if (emailKey && process.env[emailKey]) {
      const byEmail = await Employee.findOne({
        email: new RegExp(`^${String(process.env[emailKey]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        status: 'Active',
      }).select('_id');
      if (byEmail) return byEmail._id;
    }
    const fallback = await Employee.findOne({ status: 'Active' }).sort({ createdAt: 1 }).select('_id');
    return fallback?._id || null;
  };

  const upsertCrmLead = async (row, generatedBy) => {
    const payload = {
      name: row.fullName,
      businessName: row.formName || row.campaignName || row.fullName || 'N/A',
      contactNumber: row.phone,
      leadSource: row.platform ? `Meta Ads (${row.platform})` : 'Google Sheet Import',
      description: buildCrmDescription(row),
      status: mapSheetStatusToCrmStatus(row.sheetLeadStatus, tenantKey),
      externalLeadId: row.metaLeadId || '',
      adPlatform: 'meta',
      campaignId: row.campaignId || '',
      campaignName: row.campaignName || '',
      adId: row.adId || '',
      formId: row.formId || '',
      email: '',
    };

    if (row.metaLeadId) {
      const existing = await Lead.findOne({ externalLeadId: row.metaLeadId, adPlatform: 'meta' });
      if (existing) {
        Object.assign(existing, {
          ...payload,
          generatedBy: existing.generatedBy || generatedBy,
        });
        await existing.save();
        return existing;
      }
    }

    const byPhone = await Lead.findOne({ contactNumber: row.phone }).sort({ createdAt: -1 });
    if (byPhone && !row.metaLeadId) {
      Object.assign(byPhone, {
        name: payload.name,
        businessName: payload.businessName,
        leadSource: payload.leadSource,
        description: payload.description,
        status: payload.status,
      });
      await byPhone.save();
      return byPhone;
    }

    return Lead.create({
      ...payload,
      generatedBy,
    });
  };

  const importCsv = async (req, res) => {
    try {
      const csvText = req.body?.csvText || req.body?.csv || '';
      const fileName = String(req.body?.fileName || 'upload.csv').trim();
      const importedBy = req.body?.importedBy || req.body?.employeeId || req.body?.actorId || null;

      const access = await resolveLeadAccess(Employee, importedBy);
      assertCanManageLeads(access);

      if (!String(csvText).trim()) {
        return res.status(400).json({ message: 'csvText is required' });
      }

      const parsed = parseMetaLeadCsv(csvText);
      if (!parsed.leads.length) {
        return res.status(400).json({
          message: 'No valid lead rows found in CSV',
          errors: parsed.errors,
          headerMode: parsed.headerMode,
        });
      }

      const ownerId = await resolveOwnerId(importedBy);
      if (!ownerId) {
        return res.status(500).json({
          message: 'No Active employee found to own imported leads. Create an employee first.',
        });
      }

      let created = 0;
      let updated = 0;
      let crmCreated = 0;
      let crmUpdated = 0;
      const failures = [...parsed.errors];

      for (const row of parsed.leads) {
        try {
          const filter = row.metaLeadId
            ? { metaLeadId: row.metaLeadId }
            : { phone: row.phone, fullName: row.fullName };

          let sheetDoc = await SheetLead.findOne(filter);
          const sheetPayload = {
            ...row,
            sourceFileName: fileName,
            importedAt: new Date(),
            importedBy: ownerId,
          };
          delete sheetPayload._rowNumber;

          if (sheetDoc) {
            Object.assign(sheetDoc, sheetPayload);
            updated += 1;
          } else {
            sheetDoc = new SheetLead(sheetPayload);
            created += 1;
          }

          const beforeCrm = sheetDoc.crmLead;
          const crmLead = await upsertCrmLead(row, ownerId);
          if (crmLead) {
            sheetDoc.crmLead = crmLead._id;
            if (beforeCrm && String(beforeCrm) === String(crmLead._id)) crmUpdated += 1;
            else if (beforeCrm) crmUpdated += 1;
            else crmCreated += 1;
          }

          await sheetDoc.save();
        } catch (error) {
          failures.push(`Row ${row._rowNumber || '?'}: ${error.message || 'import failed'}`);
        }
      }

      return res.status(200).json({
        message: 'CSV import completed',
        summary: {
          totalParsed: parsed.leads.length,
          sheetCreated: created,
          sheetUpdated: updated,
          crmCreated,
          crmUpdated,
          failed: failures.length,
          headerMode: parsed.headerMode,
        },
        errors: failures.slice(0, 50),
      });
    } catch (error) {
      console.error(`[${tenantKey}] sheet lead import error:`, error);
      const status = error.statusCode || 500;
      return res.status(status).json({
        message: error.message || 'Failed to import CSV leads',
      });
    }
  };

  const getSheetLeads = async (req, res) => {
    try {
      const filter = {};
      if (req.query.search) {
        const q = String(req.query.search).trim();
        filter.$or = [
          { fullName: new RegExp(q, 'i') },
          { phone: new RegExp(q, 'i') },
          { executiveName: new RegExp(q, 'i') },
          { campaignName: new RegExp(q, 'i') },
          { metaLeadId: new RegExp(q, 'i') },
        ];
      }
      if (req.query.platform) filter.platform = req.query.platform;
      if (req.query.executiveName) filter.executiveName = new RegExp(String(req.query.executiveName), 'i');

      const leads = await SheetLead.find(filter)
        .populate('importedBy', 'name email')
        .populate('crmLead')
        .sort({ createdTime: -1, importedAt: -1 })
        .limit(Number(req.query.limit) || 500);

      res.status(200).json(leads);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching sheet leads', error: error.message });
    }
  };

  return { importCsv, getSheetLeads };
}
