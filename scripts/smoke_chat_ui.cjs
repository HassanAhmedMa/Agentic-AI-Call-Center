// Isolated browser UI regression: all API responses are synthetic and intercepted.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({headless:true,
    ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const doctor = {id:7,name_en:'Dr. Heba Samir',name_ar:'Synthetic doctor',
      specialty:{name_en:'Orthopedics',name_ar:'Orthopedics'}};
    let turns = 0;
    const event = (type,data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    await page.route('**/api/v1/**', async route => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint.endsWith('/chat/message')) {
        turns++;
        const widgets = turns === 1 ? [
          {type:'doctor_cards',doctors:[{id:7,name:doctor.name_en,title:'Orthopedics',
            specialty:'Orthopedics',fee:'350 EGP',shift_start:'09:00',shift_end:'14:00'}]},
          {type:'doctor_recommendations',doctor_id:7,slots:[
            {date:'2026-11-25',start_time:'09:30'},{date:'2026-11-25',start_time:'10:30'}]},
        ] : turns === 2 ? [{type:'action_proposal',selection:{doctor,doctor_id:7,
          date:'2026-11-25',start_time:'10:30',operation:'book'}}] : [
          {type:'appointment_success',operation:'book',appointment:{id:9001,doctor}},
        ];
        await route.fulfill({contentType:'text/event-stream',body:
          widgets.map(widget=>event('widget',widget)).join('') +
          event('token',{text:turns===3?'Your appointment is confirmed.':'Please review your options.'}) +
          event('done',{status:'ok'})});
      } else {
        const body = endpoint.endsWith('/session') ? {customer_number:'synthetic-ui-patient',
          first_name:'Synthetic',full_name:'Synthetic Patient',profile_complete:true} :
          endpoint.endsWith('/status') ? {chat_public_coming_soon:false} :
          {appointments:[],total:0};
        await route.fulfill({json:body});
      }
    });
    const base = process.env.CHAT_UI_BASE || 'http://127.0.0.1:8004';
    await page.goto(base+'/portal/chat.html');
    await page.waitForFunction(()=>!!window.ClinicSession);
    await page.locator('#chatTextInput').fill('Find the best orthopedics appointment.');
    await page.evaluate(()=>window.sendChatMessage());
    const suggestions = page.locator('[data-doctor-id="7"] .slot-pill-btn');
    assert.equal(await suggestions.count(),2);
    assert.match(await suggestions.first().innerText(),/Nov/);
    assert.doesNotMatch(await suggestions.first().innerText(),/Before|After/);
    await suggestions.last().click();
    const confirm = page.getByRole('button',{name:/Confirm book.*Heba.*10:30/});
    await confirm.waitFor();
    await confirm.click();
    await page.locator('.chat-action-success').waitFor();
    await page.goto(base+'/portal/appointments.html');
    await page.goto(base+'/portal/chat.html');
    await page.locator('.chat-action-success').waitFor();
    assert.equal(await page.locator('[data-doctor-id="7"] .slot-pill-btn').count(),2);
    assert.equal(await page.locator('.chat-action-doctor').count(),1);
    await page.evaluate(()=>window.createNewConversation());
    assert.equal(await page.locator('.chat-action-success').count(),0);
    await page.evaluate(()=>{
      const history = JSON.parse(localStorage.getItem('shiffaa_chat_threads_v2:synthetic-ui-patient'));
      window.switchConversation(history.threads[1].id);
    });
    await page.locator('.chat-action-success').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    assert.deepEqual(errors,[]);
    const screenshot = path.join(os.tmpdir(),'clinic-chat-release-ui.png');
    await page.screenshot({path:screenshot,fullPage:true});
    console.log('PASS: readable dates, named confirmation, restored widgets, previous chats, mobile width.');
    console.log('Screenshot: '+screenshot);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
