const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createParser} = require('../../frontend/user/chat-stream.js');
test('SSE preserves events split across arbitrary network chunks', () => {
 const received = [];
 const feed = createParser((event, data) => received.push([event,data]));
 const stream = 'event: token\ndata: {"text":"hello"}\n\nevent: error\ndata: {"message":"timeout"}\n\n';
 for (const character of stream) feed(character);
 assert.deepEqual(received, [['token',{text:'hello'}],['error',{message:'timeout'}]]);
});
