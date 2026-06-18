const cds = require('@sap/cds');
const { GET, POST, PATCH, expect } = cds.test(__dirname + '/..');

// Bind a draft helper
const draftKey = (ID) => `(ID=${ID},IsActiveEntity=false)`;

describe('BP Change & Extend — foundation', () => {
  it('serves OData $metadata with ChangeRequests', async () => {
    const { status, data } = await GET('/bp/$metadata');
    expect(status).to.equal(200);
    expect(data).to.contain('ChangeRequests');
  });

  it('seeds the Config table (S4_DESTINATION=SHD250SYSTEM)', async () => {
    const { data } = await GET('/bp-config/Configs');
    const dest = data.value.find((c) => c.ID === 'S4_DESTINATION');
    expect(dest).to.exist;
    expect(dest.value).to.equal('SHD250SYSTEM');
  });

  it('loads the S/4 snapshot (old value) on draft create', async () => {
    const { status, data } = await POST('/bp/ChangeRequests', {
      requestType: 'Change',
      bpNumber: '4711',
    });
    expect(status).to.equal(201);
    expect(data.name1).to.match(/Mock BP 4711/);
    expect(data.bpGrouping).to.equal('0001');
  });

  it('runs the extend action and flips requestType to Extend', async () => {
    const { data: created } = await POST('/bp/ChangeRequests', {
      requestType: 'Change',
      bpNumber: '4712',
    });
    const { status, data } = await POST(
      `/bp/ChangeRequests${draftKey(created.ID)}/BpService.extend`,
      { role: 'Vendor' }
    );
    expect(status).to.equal(200);
    expect(data.requestType).to.equal('Extend');
  });

  it('blocks submit when mandatory fields are missing', async () => {
    const { data: created } = await POST('/bp/ChangeRequests', { requestType: 'Change' });
    try {
      await POST(`/bp/ChangeRequests${draftKey(created.ID)}/BpService.submit`, {});
      expect.fail('submit should have been rejected');
    } catch (e) {
      expect(e.response.status).to.be.within(400, 499);
    }
  });
});
