
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map();
function node(selector){if(!nodes.has(selector))nodes.set(selector,{hidden:false,disabled:false,value:'',dataset:{ar:'ar',en:'en'},textContent:'',addEventListener(){},reset(){},focus(){},closest(){return node(selector+' parent')}});return nodes.get(selector);}
const context=vm.createContext({document:{querySelector:node,querySelectorAll(){return []},documentElement:{lang:'ar',dir:'rtl'}},fetch:async()=>({ok:true,status:200,json:async()=>({provider:'supabase',otp_length:6})}),setInterval(){},console,Date,FormData:function(){}});
vm.runInContext(fs.readFileSync('services/clinic-backend/src/clinic_backend/static/register.js','utf8'),context);
(async()=>{
await new Promise(setImmediate);
context.fetch=async()=>({ok:true,status:204,json:async()=>{throw Error('no JSON body')}});
await vm.runInContext("api('auth/logout', {}, 'synthetic')",context);
vm.runInContext("pendingForm={email:'synthetic@example.test'};accessToken='synthetic';document.querySelector('#registration').hidden=true;",context);
await vm.runInContext("busy(async()=>{throw Error('VALIDATION_FAILED')})",context);
assert.equal(node('#registration').hidden,false,'Invalid profile must be editable');
assert.equal(node('#verification').hidden,true);
assert.equal(vm.runInContext('accessToken',context),'synthetic','Do not consume another OTP to fix a profile');
console.log('Logout and invalid-profile repair state passed');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
