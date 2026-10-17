const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('frontend/user/auth.js', 'utf8');
function fixture() {
  const nodes = new Map(); const calls = []; const routes = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {id, value:'', dataset:{}, style:{}, checked:true,
      classList:{toggle(){},add(){}}, querySelector(){return null;},
      querySelectorAll(){return [];}, setAttribute(){}});
    return nodes.get(id);
  }
  const window = {location:{hash:'',assign(url){routes.push(url);}},scrollTo(){}};
  const context = {window, document:{getElementById:node,
    querySelectorAll(){return [];},addEventListener(){},
    createElement(){return node('toast');}, body:{appendChild(){}}},
    history:{pushState(){}},URLSearchParams,Date,Error,console,
    clearInterval(){},setInterval(){},
    async fetch(url, options) {calls.push({url,options});return {
      ok:true,status:200, async json(){return {customer_number:'123456'};}};}};
  vm.runInNewContext(source, context);
  return {window,node,calls,routes};
}
test('Egyptian numbers and Arabic digits share canonical identity',()=>{
  const {window}=fixture();
  for(const phone of ['01012345678','+20 1012345678','٠١٠١٢٣٤٥٦٧٨'])
    assert.equal(window.PortalAuthUtils.normalizePhone(phone),'+201012345678');
  assert.throws(()=>window.PortalAuthUtils.normalizePhone('garbage'));
  assert.throws(()=>window.PortalAuthUtils.parseDOB('31 / 02 / 2000'));
  assert.equal(window.PortalAuthUtils.parseDOB('١٥ / ٠٦ / ١٩٩٠'),'1990-06-15');
});
test('phone/password login uses backend and clears password field',async()=>{
  const {window,node,calls}=fixture(); window.switchLoginChannel('phone');
  node('loginPhoneInput').value='01012345678';node('loginPasswordInput').value='Synthetic-Password-123';
  await window.handleLoginSubmit({preventDefault(){}});
  assert.equal(calls[0].url,'/api/v1/portal/login');
  assert.equal(JSON.parse(calls[0].options.body).identifier,'+201012345678');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(node('loginPasswordInput').value,'');
});
test('dashboard navigation verifies backend session first',async()=>{
  const {window,calls,routes}=fixture();await window.handleContinueToDashboard();
  assert.equal(calls[0].url,'/api/v1/portal/session');assert.deepEqual(routes,['index.html']);
});
