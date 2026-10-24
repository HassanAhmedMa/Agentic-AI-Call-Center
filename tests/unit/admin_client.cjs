const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const calls = [];
let writes = 0;
const storage = {getItem(){return null}, removeItem(){}, setItem(){writes++}};
const context = vm.createContext({
 window: {dispatchEvent(){}, addEventListener(){}, location:{hash:'',protocol:'http:',host:'localhost'}, prompt(){throw Error('Unexpected prompt')}},
 document:{readyState:'loading',addEventListener(){},getElementById(){return null},querySelectorAll(){return []}},
 localStorage:storage, sessionStorage:storage,
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:123,full_name:'Synthetic'})}},
 CustomEvent:class {},FormData:class {},Date,URLSearchParams,console,
 setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},performance:{now(){return 0}}
});
vm.runInContext(fs.readFileSync('frontend/admin/api.js','utf8'),context);
(async()=>{
 context.window.ClinicApi.setAdminToken('synthetic-review-token');
 await context.window.ClinicApi.getPatient('123');
 assert.equal(calls[0].url,'/api/v1/admin/patients/123');
 assert.equal(calls[0].options.headers['X-Admin-Token'],'synthetic-review-token');
 assert.equal(writes,0,'No persistent browser storage for credentials or patient cache');
 console.log('Admin client prefix, header and storage checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
