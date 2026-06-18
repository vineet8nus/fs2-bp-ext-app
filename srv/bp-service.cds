using { nus.bp as db } from '../db/schema';

/**
 * BP Change & Extend governance service (OData V4, draft-enabled).
 * Replaces the freestyle "MDG-lite" app: List Report + Object Page over one draft BO.
 */
service BpService @(path: '/bp', requires: 'authenticated-user') {

  @odata.draft.enabled
  entity ChangeRequests as projection on db.ChangeRequest actions {

    // --- §4: custom dialogs → RAP/CAP actions ---
    @cds.odata.bindingparameter.name: '_it'
    action extend( role : db.BPRole @title: 'Role' )            returns ChangeRequests;

    @cds.odata.bindingparameter.name: '_it'
    action selectCompanyCode( companyCode : String(4) @title: 'Company Code' ) returns ChangeRequests;

    action check()    returns ChangeRequests;   // on-demand validation
    action submit()   returns ChangeRequests;   // triggers approval flow
    action approve()  returns ChangeRequests;   // guarded
    action rejectRequest( reason : String(200) ) returns ChangeRequests; // guarded
    action postToS4() returns ChangeRequests;   // write-back via released BP API
  };

  entity Addresses        as projection on db.Address;
  entity Emails           as projection on db.Email;
  entity Relationships    as projection on db.Relationship;
  entity Identifications  as projection on db.Identification;
  entity TaxCategories    as projection on db.TaxCategory;
  entity CompanyCodes     as projection on db.CompanyCode;
  entity PurchasingOrgs   as projection on db.PurchasingOrg;
  entity BankChains       as projection on db.BankChain;
  entity Attachments      as projection on db.Attachment;
}

/** Admin/config service — separate so config maintenance is access-controlled. */
service BpConfigService @(path: '/bp-config', requires: 'authenticated-user') {
  entity FieldRules as projection on db.FieldRule;
  entity Configs    as projection on db.Config;
}
