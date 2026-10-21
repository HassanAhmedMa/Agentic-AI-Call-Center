const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('frontend/user/auth.js', 'utf8');
function fixture(responder, location = {}) {
  let loaded;
  const nodes = new Map(); const calls = []; const routes = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {id, value:'', dataset:{}, style:{}, checked:true,
      classList:{toggle(){},add(){}}, querySelector(){return null;},
      appendChild(){},querySelectorAll(){return [];}, closest(){return node(id+'Group');}, addEventListener(){}, setAttribute(){}});
    return nodes.get(id);
  }
  const window = {location:{hash:'',search:'',pathname:'/portal/auth.html',assign(url){routes.push(url);},replace(url){routes.push(url);},...location},scrollTo(){}};
  const context = {window, document:{getElementById:node,
    querySelectorAll(){return [];},addEventListener(name,fn){if(name==='DOMContentLoaded')loaded=fn;},
    createElement(){return node('toast');}, body:{appendChild(){},prepend(){}}},
    history:{pushState(){},replaceState(){}},URLSearchParams,Date,Error,console,
    clearTimeout(){},setTimeout(){},clearInterval(){},setInterval(){},
    async fetch(url, options) {calls.push({url,options});if(responder)return responder(url,options);return {
      ok:true,status:200, async json(){return {customer_number:'123456',url:'https://auth.example.test/auth/v1/authorize?provider=google'};}};}};
  vm.runInNewContext(fs.readFileSync('frontend/user/portal-api.js','utf8'), context);
  vm.runInNewContext(source, context);
  return {window,node,calls,routes,load:()=>loaded(),runScript:code=>vm.runInNewContext(code,context)};
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
  const {window,node,calls,routes}=fixture(); window.switchLoginChannel('phone');
  node('loginPhoneInput').value='01012345678';node('loginPasswordInput').value='Synthetic-Password-123';
  await window.handleLoginSubmit({preventDefault(){}});
  assert.equal(calls[0].url,'/api/v1/portal/login');
  assert.equal(JSON.parse(calls[0].options.body).identifier,'+201012345678');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(node('loginPasswordInput').value,'');
  assert.deepEqual(routes,['index.html']);
});
test('dashboard navigation verifies backend session first',async()=>{
  const {window,calls,routes}=fixture();await window.handleContinueToDashboard();
  assert.equal(calls[0].url,'/api/v1/portal/session');assert.deepEqual(routes,['index.html']);
});

test('native date value is accepted and calendar button opens its picker',()=>{
  const {window,node}=fixture();
  assert.equal(window.PortalAuthUtils.parseDOB('1990-06-15'),'1990-06-15');
  let opened=false;node('signupDobInput').showPicker=()=>{opened=true;};
  window.openDobPicker();assert.equal(opened,true);
});

test('Google button starts same-origin PKCE rather than exposing credentials',async()=>{
  const {window,calls,routes}=fixture();await window.handleGoogleLogin();
  assert.equal(calls[0].url,'/api/v1/portal/google');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.deepEqual(routes,['https://auth.example.test/auth/v1/authorize?provider=google']);
});

test('Google callback exchanges code, removes URL and opens dashboard',async()=>{
  const {window,calls,routes,load}=fixture();
  window.location.search='?code=synthetic-code&oauth_state=synthetic-state';
  await load();
  assert.equal(calls[0].url,'/api/v1/portal/google/exchange');
  assert.equal(JSON.parse(calls[0].options.body).code,'synthetic-code');
  assert.deepEqual(routes,['index.html']);
});
test('new Google patient completes verified profile without password or OTP',async()=>{
  const {window,node,calls,load}=fixture(async()=>({ok:false,status:409,async json(){return {error:{code:'REGISTRATION_REQUIRED',details:{email_verified:true,email:'synthetic@example.test'}}};}}));
  window.location.search='?code=synthetic-code&oauth_state=synthetic-state';
  await load();
  assert.equal(node('signupEmailInput').value,'synthetic@example.test');
  assert.equal(node('signupEmailInput').readOnly,true);
  assert.equal(node('signupPasswordInput').required,false);
  assert.equal(node('signupPasswordInputGroup').hidden,true);
  node('signupNameInput').value='Synthetic Patient';node('signupPhoneInput').value='01012345678';node('signupDobInput').value='1990-06-15';
  await window.handleSignupSubmit({preventDefault(){}});
  assert.equal(calls[1].url,'/api/v1/portal/verify');
  assert.equal(JSON.parse(calls[1].options.body).registration.email,'synthetic@example.test');
});

for (const host of ['localhost','127.0.0.1']) {
  for (const port of ['5500','5501','8000','8002']) {
    test(`loopback ${host}:${port} uses matching host and session credentials`,async()=>{
      const staticPage=['5500','5501'].includes(port);
      const location={hostname:host,port,protocol:'http:',pathname:staticPage?'/auth.html':'/portal/auth.html'};
      const {window,calls}=fixture(undefined,location);
      await window.handleGoogleLogin();
      assert.equal(calls[0].url,(staticPage?`http://${host}:8002`:'')+'/api/v1/portal/google');
      assert.equal(calls[0].options.credentials,staticPage?'include':'same-origin');
      assert.equal(JSON.parse(calls[0].options.body).return_path,location.pathname);
    });
  }
}
test('explicit local API port is shared by login and dashboard session',async()=>{
  const {window,calls,load,runScript}=fixture(undefined,{hostname:'localhost',port:'5501',protocol:'http:',pathname:'/auth.html'});
  window.CLINIC_API_BASE_URL='http://localhost:8000';
  await window.handleGoogleLogin();
  runScript(fs.readFileSync('frontend/user/portal-session.js','utf8'));
  await load();
  assert.equal(calls[0].url,'http://localhost:8000/api/v1/portal/google');
  assert.equal(calls[1].url,'http://localhost:8000/api/v1/portal/session');
  assert.equal(calls[1].options.credentials,'include');
});
