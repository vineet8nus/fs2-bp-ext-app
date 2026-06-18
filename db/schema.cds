namespace znus.bp;

using { cuid, managed } from '@sap/cds/common';

/**
 * BP Change & Extend — governance/request layer.
 * Master data stays in S/4. This model captures a *request*:
 *   active instance  = current BP snapshot (old value, loaded from S/4)
 *   draft instance   = the edits (new value)
 * Fiori Elements renders old vs new natively in draft edit mode.
 */

type RequestType : String enum {
  Change;
  Extend;
}

type RequestStatus : String enum {
  Draft;
  InApproval;
  Approved;
  Rejected;
  Posted;
  Failed;
}

type BPRole : String enum {
  Vendor;
  Customer;
}

/** Root: one change/extend request for a Business Partner. */
entity ChangeRequest : cuid, managed {
  requestType     : RequestType default #Change;
  status          : RequestStatus default #Draft;

  // --- BP identity ---
  bpNumber        : String(10);
  bpCategory      : String(1);          // 1 person, 2 org, 3 group
  bpGrouping      : String(4);
  deptCode        : String(10);
  requestorEmail  : String(241);

  // --- header old/new BP attributes (current snapshot lands here on draft create) ---
  name1           : String(40);
  name2           : String(40);
  name3           : String(40);
  name4           : String(40);
  searchTerm1     : String(20);
  searchTerm2     : String(20);

  // --- posting result ---
  postedBpNumber  : String(10);
  postingMessage  : String(5000);

  // --- compositions (mirror the Object Page facets / screenshot tabs) ---
  addresses       : Composition of many Address       on addresses.parent = $self;
  emails          : Composition of many Email         on emails.parent = $self;
  relationships   : Composition of many Relationship  on relationships.parent = $self;
  identifications : Composition of many Identification on identifications.parent = $self;
  taxCategories   : Composition of many TaxCategory   on taxCategories.parent = $self;
  companyCodes    : Composition of many CompanyCode   on companyCodes.parent = $self;
  purchasingOrgs  : Composition of many PurchasingOrg on purchasingOrgs.parent = $self;
  bankChains      : Composition of many BankChain     on bankChains.parent = $self;
  attachments     : Composition of many Attachment    on attachments.parent = $self;
}

entity Address : cuid {
  parent      : Association to ChangeRequest;
  addressType : String(4);
  street      : String(60);
  houseNumber : String(10);
  city        : String(40);
  postalCode  : String(10);
  country     : String(3);
  region      : String(3);
}

entity Email : cuid {
  parent  : Association to ChangeRequest;
  address : String(241);
  isDefault : Boolean default false;
}

entity Relationship : cuid {
  parent            : Association to ChangeRequest;
  relationshipType  : String(6);
  partnerBpNumber   : String(10);
  validFrom         : Date;
  validTo           : Date;
}

entity Identification : cuid {
  parent       : Association to ChangeRequest;
  idType       : String(6);
  idNumber     : String(60);
  idCountry    : String(3);
  validFrom    : Date;
  validTo      : Date;
}

entity TaxCategory : cuid {
  parent      : Association to ChangeRequest;
  taxType     : String(4);
  taxNumber   : String(60);
  taxCountry  : String(3);
}

entity CompanyCode : cuid {
  parent          : Association to ChangeRequest;
  companyCode     : String(4);
  reconAccount    : String(10);
  paymentTerms    : String(4);
  paymentMethod   : String(10);
  paymentBlock    : String(1);
}

entity PurchasingOrg : cuid {
  parent          : Association to ChangeRequest;
  purchasingOrg   : String(4);
  orderCurrency   : String(5);
  paymentTerms    : String(4);
}

entity BankChain : cuid {
  parent       : Association to ChangeRequest;
  bankCountry  : String(3);
  bankKey      : String(15);
  bankAccount  : String(18);
  iban         : String(34);
}

entity Attachment : cuid {
  parent    : Association to ChangeRequest;
  fileName  : String(255);
  mimeType  : String(120);
  content   : LargeBinary @Core.MediaType: mimeType;
}

/**
 * Field-rule config (the "mandatory-by-context" matrix, §5).
 * Read by feature-control logic so policy changes need no code change.
 */
entity FieldRule {
  key ID          : Integer;
  requestType     : RequestType;
  role            : BPRole;
  fieldName       : String(60);
  mandatory       : Boolean default false;
  readOnly        : Boolean default false;
  hidden          : Boolean default false;
}

/** Configurable destination / connectivity settings (§7). */
entity Config {
  key ID          : String(40);
  value           : String(200);
}
