const cds = require('@sap/cds');
const s4 = require('./lib/s4-bp');

/**
 * BP Change & Extend service handlers.
 *
 * Design intent (see design doc §5/§7):
 *  - On draft create the current BP snapshot is pulled from S/4 (old value).
 *  - Actions drive the status lifecycle and the single write path to S/4.
 *  - No hand-rolled state: the draft–active model is the old/new diff.
 *
 * `req.subject` resolves to the concrete instance the request targets (draft or
 * active), so we never juggle composite draft keys by hand.
 */
module.exports = class ZBpService extends cds.ApplicationService {
  async init() {
    // `this.entities` is not populated at init time in this CAP setup, so all
    // handler targets are registered by name string (resolved at dispatch).
    // Entities are resolved lazily inside handlers, where the model is ready.
    const ROOT = 'ChangeRequests';
    const DRAFTS = 'ChangeRequests.drafts';

    // --- Determination: load current BP snapshot on draft create (§3, §5) ---
    // Mutate req.data in `before NEW` so the snapshot is part of the draft INSERT
    // (a nested UPDATE inside the create tx would deadlock the single connection).
    this.before('NEW', DRAFTS, async (req) => {
      const { bpNumber, requestType } = req.data;
      if (bpNumber && requestType !== 'Extend') {
        const snap = await s4.readBusinessPartner(bpNumber);
        if (snap) Object.assign(req.data, this._mapSnapshot(snap));
      }
    });

    // Re-load snapshot when the BP number is (re)entered on an existing draft.
    this.before('UPDATE', DRAFTS, async (req) => {
      const { bpNumber, requestType } = req.data;
      if (bpNumber && requestType !== 'Extend') {
        const snap = await s4.readBusinessPartner(bpNumber);
        if (snap) Object.assign(req.data, this._mapSnapshot(snap));
      }
    });

    // --- §4: "What do you want to extend? Vendor / Customer" ---
    this.on('extend', ROOT, async (req) => {
      const { role } = req.data;
      await UPDATE(req.subject).with({ requestType: 'Extend' });
      req.info(`Request marked as Extend (${role}). Context-relevant facets unlocked.`);
      return this._read(req);
    });

    // --- §4: "Select company code to proceed" ---
    this.on('selectCompanyCode', ROOT, async (req) => {
      const { companyCode } = req.data;
      const cr = await SELECT.one.from(req.subject).columns('ID', 'IsActiveEntity');
      await INSERT.into(this._childOf(req, 'companyCodes')).entries({
        parent_ID: cr.ID,
        companyCode,
      });
      req.info(`Company code ${companyCode} added.`);
      return this._read(req);
    });

    // --- check: run validations on demand (§5) ---
    this.on('check', ROOT, async (req) => {
      const cr = await this._readDeep(req);
      const problems = this._validate(cr);
      if (problems.length) problems.forEach((m) => req.warn(m));
      else req.info('Check passed — no issues found.');
      return this._read(req);
    });

    // --- submit: validate hard, then move to approval (§6) ---
    this.on('submit', ROOT, async (req) => {
      const cr = await this._readDeep(req);
      const problems = this._validate(cr);
      if (problems.length) return req.reject(400, problems.join(' | '));
      await UPDATE(req.subject).with({ status: 'InApproval' });
      // TODO(Phase 3): trigger Flexible Workflow / SBPA scenario here.
      req.info('Submitted for approval.');
      return this._read(req);
    });

    // --- approve / reject: guarded actions (§6) ---
    this.on('approve', ROOT, async (req) => {
      await UPDATE(req.subject).with({ status: 'Approved' });
      req.info('Request approved.');
      return this._read(req);
    });

    // NB: action is named `reject` in CDS but bound to this method to avoid
    // shadowing ApplicationService.prototype.reject.
    this.on('rejectRequest', ROOT, async (req) => {
      const { reason } = req.data;
      await UPDATE(req.subject).with({ status: 'Rejected', postingMessage: reason });
      req.info('Request rejected.');
      return this._read(req);
    });

    // --- postToS4: single write path via released BP API (§7) ---
    this.on('postToS4', ROOT, async (req) => {
      const cr = await this._readDeep(req);
      if (cr.status !== 'Approved') return req.reject(400, 'Only Approved requests can be posted.');
      try {
        const result = await s4.writeBusinessPartner(cr);
        await UPDATE(req.subject).with({
          status: 'Posted',
          postedBpNumber: result.bpNumber,
          postingMessage: result.message || 'Posted successfully.',
        });
        req.info(`Posted to S/4. BP: ${result.bpNumber}`);
      } catch (e) {
        await UPDATE(req.subject).with({ status: 'Failed', postingMessage: s4.parseError(e) });
        return req.reject(502, `Posting failed: ${s4.parseError(e)}`);
      }
      return this._read(req);
    });

    return super.init();
  }

  // ---------------------------------------------------------------- helpers

  _mapSnapshot(snap) {
    return {
      bpCategory:  snap.BusinessPartnerCategory,
      bpGrouping:  snap.BusinessPartnerGrouping,
      name1:       snap.BusinessPartnerName || snap.OrganizationBPName1,
      name2:       snap.OrganizationBPName2,
      searchTerm1: snap.SearchTerm1,
      searchTerm2: snap.SearchTerm2,
    };
  }

  _validate(cr) {
    const problems = [];
    if (!cr) return problems;
    if (!cr.bpGrouping) problems.push('BP grouping is required.');
    if (!cr.name1) problems.push('Name 1 is required.');
    // Mandatory-by-context: recon account required when a company-code role is added (§5).
    for (const cc of cr.companyCodes || []) {
      if (!cc.reconAccount) problems.push(`Reconciliation account required for company code ${cc.companyCode || '?'}.`);
    }
    // IBAN sanity (§5).
    for (const bc of cr.bankChains || []) {
      if (bc.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(bc.iban)) {
        problems.push(`IBAN ${bc.iban} is not well-formed.`);
      }
    }
    return problems;
  }

  _childOf(req, name) {
    const { ChangeRequests } = this.entities;
    const isDraft = req.subject?.ref?.[0]?.where?.some?.(
      (t) => t.ref?.[0] === 'IsActiveEntity' && t.val === false
    );
    const root = isDraft ? ChangeRequests.drafts : ChangeRequests;
    return root.elements[name].target;
  }

  _read(req) {
    return SELECT.one.from(req.subject);
  }

  _readDeep(req) {
    return SELECT.one.from(req.subject).columns((cr) => {
      cr('*'), cr.companyCodes('*'), cr.bankChains('*');
    });
  }
};
