const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(store) {
  const events = new Map();
  const window = {location:{hostname:'127.0.0.1',host:'127.0.0.1:8004'},
    addEventListener(name, handler){events.set(name, handler);}};
  const context = {window, console, Date, Intl, setTimeout(){}, clearTimeout(){}, setInterval(){}, clearInterval(){},
    localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},
    document:{getElementById(){return null;},addEventListener(name,handler){events.set(name,handler);}},
    fetch:async()=>({ok:false}), WebSocket:class {}};
  vm.runInNewContext(fs.readFileSync('frontend/user/chat.js','utf8'), context);
  events.get('DOMContentLoaded')();
  return {window, signIn:identity=>events.get('clinic:session-loaded')({detail:{customer_number:identity}})};
}

test('new chat retains previous thread and isolates signed-in patient history',()=>{
  const store = new Map();
  const app = fixture(store);
  assert.equal(store.size,0,'no history loaded before patient verification');
  app.signIn('synthetic-patient-A');
  const key = 'shiffaa_chat_threads_v2:synthetic-patient-A';
  const original = JSON.parse(store.get(key));
  original.threads[0].messages.push({role:'user',content:'My synthetic appointment'});
  store.set(key,JSON.stringify(original));
  app.window.createNewConversation();
  const updated = JSON.parse(store.get(key));
  assert.equal(updated.threads.length,2);
  assert.equal(updated.threads[1].messages[0].content,'My synthetic appointment');
  const returned = fixture(store);
  returned.signIn('synthetic-patient-A');
  assert.equal(JSON.parse(store.get(key)).threads.length,2,'navigation preserves chats');
  returned.signIn('synthetic-patient-B');
  const other = JSON.parse(store.get('shiffaa_chat_threads_v2:synthetic-patient-B'));
  assert.equal(other.threads.length,1);
  assert.deepEqual(other.threads[0].messages,[]);
});
