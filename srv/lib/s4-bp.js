const cds = require('@sap/cds');

/**
 * S/4 Business Partner connector (design doc §7).
 *
 * Single read/write path to S/4 via the *released* Business Partner API,
 * reached over a configurable destination (default SHD250SYSTEM, sap-client 250).
 *
 * Locally (no destination bound) this falls back to a deterministic mock so the
 * app is fully runnable with `cds watch`. On BTP the `API_BUSINESS_PARTNER`
 * required service in package.json#cds.requires resolves to the destination.
 */

const DESTINATION = process.env.S4_DESTINATION || 'SHD250SYSTEM';

function isBound() {
  // The remote service is configured (and thus a destination exists) on BTP.
  try {
    return !!cds.env.requires?.API_BUSINESS_PARTNER;
  } catch {
    return false;
  }
}

async function connect() {
  // Lazily connect to the imported Service Consumption Model / OData service.
  return cds.connect.to('API_BUSINESS_PARTNER');
}

/** Read current BP (old value). */
async function readBusinessPartner(bpNumber) {
  if (!bpNumber) return null;
  if (!isBound()) return mockRead(bpNumber);

  const s4 = await connect();
  const { A_BusinessPartner } = s4.entities;
  return s4.run(
    SELECT.one.from(A_BusinessPartner)
      .where({ BusinessPartner: bpNumber })
  );
}

/** Create/change BP (post). Returns { bpNumber, message }. */
async function writeBusinessPartner(cr) {
  if (!isBound()) return mockWrite(cr);

  const s4 = await connect();
  const { A_BusinessPartner } = s4.entities;
  const payload = mapToS4(cr);

  if (cr.bpNumber) {
    await s4.run(UPDATE(A_BusinessPartner, { BusinessPartner: cr.bpNumber }).with(payload));
    return { bpNumber: cr.bpNumber, message: 'BP changed in S/4.' };
  }
  const created = await s4.run(INSERT.into(A_BusinessPartner).entries(payload));
  const bpNumber = created?.BusinessPartner || created?.[0]?.BusinessPartner;
  return { bpNumber, message: 'BP created in S/4.' };
}

function mapToS4(cr) {
  return {
    BusinessPartnerCategory: cr.bpCategory,
    BusinessPartnerGrouping: cr.bpGrouping,
    BusinessPartnerName:     cr.name1,
    OrganizationBPName1:     cr.name1,
    OrganizationBPName2:     cr.name2,
    SearchTerm1:             cr.searchTerm1,
    SearchTerm2:             cr.searchTerm2,
  };
}

function parseError(e) {
  return (
    e?.message ||
    e?.reason ||
    e?.response?.data?.error?.message?.value ||
    'Unknown S/4 error'
  );
}

// ------------------------------------------------------------------ mocks

function mockRead(bpNumber) {
  return {
    BusinessPartner: bpNumber,
    BusinessPartnerCategory: '2',
    BusinessPartnerGrouping: '0001',
    BusinessPartnerName: `Mock BP ${bpNumber}`,
    OrganizationBPName1: `Mock BP ${bpNumber}`,
    OrganizationBPName2: 'Pte Ltd',
    SearchTerm1: 'MOCK',
    SearchTerm2: '',
  };
}

function mockWrite(cr) {
  const bpNumber = cr.bpNumber || String(Math.floor(1e9 + Math.random() * 9e8));
  return { bpNumber, message: `[mock] BP ${cr.bpNumber ? 'changed' : 'created'} (${DESTINATION}).` };
}

module.exports = {
  DESTINATION,
  readBusinessPartner,
  writeBusinessPartner,
  parseError,
};
