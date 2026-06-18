/**
 * S/4HANA released Business Partner API — external service model (PLACEHOLDER).
 *
 * Phase-0 action (design doc §7): replace this hand-written stub with the real
 * Service Consumption Model generated from the official API metadata:
 *
 *     cds import API_BUSINESS_PARTNER.edmx --as cds
 *
 * (download the EDMX from SAP API Business Hub / your S/4 system at
 *  /sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata).
 *
 * Only the fields actually consumed by srv/lib/s4-bp.js are declared here so the
 * model compiles and `cds.connect.to('API_BUSINESS_PARTNER')` resolves. The real
 * API has many more entities/segments (company code, purchasing org, bank, tax,
 * relationships, identification) — import them when wiring the full post path.
 */
@cds.external
service API_BUSINESS_PARTNER {

  @cds.persistence.skip
  entity A_BusinessPartner {
    key BusinessPartner       : String(10);
        BusinessPartnerCategory : String(1);
        BusinessPartnerGrouping : String(4);
        BusinessPartnerName     : String(81);
        OrganizationBPName1     : String(40);
        OrganizationBPName2     : String(40);
        SearchTerm1             : String(20);
        SearchTerm2             : String(20);
  }
}
