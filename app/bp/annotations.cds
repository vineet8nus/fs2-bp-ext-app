using ZBpService from '../../srv/bp-service';

// =====================================================================
//  BP Request — List Report + Object Page (design doc §8)
// =====================================================================

annotate ZBpService.ChangeRequests with @(
  UI: {
    // ---- List Report worklist ----
    SelectionFields: [ bpNumber, name1, requestType, status, bpGrouping, createdBy, createdAt ],

    LineItem: [
      { $Type: 'UI.DataField', Value: requestType, @UI.Importance: #High },
      { $Type: 'UI.DataField', Value: bpNumber },
      { $Type: 'UI.DataField', Value: name1 },
      { $Type: 'UI.DataField', Value: bpGrouping },
      { $Type: 'UI.DataField', Value: status },
      { $Type: 'UI.DataField', Value: createdBy },
      { $Type: 'UI.DataField', Value: createdAt },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.submit',  Label: 'Submit' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.approve', Label: 'Approve' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.postToS4', Label: 'Post to S/4' },
    ],

    HeaderInfo: {
      TypeName: 'BP Request',
      TypeNamePlural: 'BP Requests',
      Title:       { Value: name1 },
      Description: { Value: bpNumber },
    },

    // ---- Object Page actions (Check / Submit / Approve / Reject / Post) ----
    Identification: [
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.check',            Label: 'Check' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.extend',           Label: 'Extend Role' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.selectCompanyCode', Label: 'Add Company Code' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.submit',           Label: 'Submit' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.approve',          Label: 'Approve' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.rejectRequest',     Label: 'Reject' },
      { $Type: 'UI.DataFieldForAction', Action: 'ZBpService.postToS4',         Label: 'Post to S/4' },
    ],

    // ---- Object Page facets = the screenshot tabs ----
    Facets: [
      { $Type: 'UI.ReferenceFacet', ID: 'General',        Label: 'General',          Target: '@UI.FieldGroup#General' },
      { $Type: 'UI.ReferenceFacet', ID: 'Identification', Label: 'Identification',   Target: 'identifications/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'Tax',            Label: 'Tax Category',     Target: 'taxCategories/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'Bank',           Label: 'Bank Chain',       Target: 'bankChains/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'CompanyCode',    Label: 'Company Code',     Target: 'companyCodes/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'PurchasingOrg',  Label: 'Purchasing Org',   Target: 'purchasingOrgs/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'Relationships',  Label: 'Relationships',    Target: 'relationships/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'Addresses',      Label: 'Addresses',        Target: 'addresses/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', ID: 'Attachments',    Label: 'Attachments',      Target: 'attachments/@UI.LineItem' },
    ],

    FieldGroup #General: {
      Data: [
        { Value: requestType },
        { Value: status },
        { Value: bpNumber },
        { Value: bpCategory },
        { Value: bpGrouping },
        { Value: deptCode },
        { Value: requestorEmail },
        { Value: name1 },
        { Value: name2 },
        { Value: searchTerm1 },
        { Value: postedBpNumber },
        { Value: postingMessage },
      ],
    },
  },
);

annotate ZBpService.ChangeRequests with @(
  Capabilities.Insertable: true,
  Capabilities.Updatable: true,
  Capabilities.Deletable: true,
);

// ---- child line items ----
annotate ZBpService.CompanyCodes with @UI.LineItem: [
  { Value: companyCode }, { Value: reconAccount }, { Value: paymentTerms }, { Value: paymentMethod }, { Value: paymentBlock },
];
annotate ZBpService.PurchasingOrgs with @UI.LineItem: [
  { Value: purchasingOrg }, { Value: orderCurrency }, { Value: paymentTerms },
];
annotate ZBpService.Identifications with @UI.LineItem: [
  { Value: idType }, { Value: idNumber }, { Value: idCountry }, { Value: validFrom }, { Value: validTo },
];
annotate ZBpService.TaxCategories with @UI.LineItem: [
  { Value: taxType }, { Value: taxNumber }, { Value: taxCountry },
];
annotate ZBpService.BankChains with @UI.LineItem: [
  { Value: bankCountry }, { Value: bankKey }, { Value: bankAccount }, { Value: iban },
];
annotate ZBpService.Relationships with @UI.LineItem: [
  { Value: relationshipType }, { Value: partnerBpNumber }, { Value: validFrom }, { Value: validTo },
];
annotate ZBpService.Addresses with @UI.LineItem: [
  { Value: addressType }, { Value: street }, { Value: houseNumber }, { Value: city }, { Value: postalCode }, { Value: country },
];
annotate ZBpService.Attachments with @UI.LineItem: [
  { Value: fileName }, { Value: mimeType },
];
