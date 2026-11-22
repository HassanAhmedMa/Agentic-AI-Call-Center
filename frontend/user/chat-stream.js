(function (root) {
  'use strict';
  function createParser(onEvent) {
    let buffer = '';
    return function feed(chunk) {
      buffer += chunk.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const record = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = 'message';
        const data = [];
        for (const line of record.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (data.length) onEvent(event, JSON.parse(data.join('\n')));
      }
    };
  }
  root.ClinicChatStream = {createParser};
  if (typeof module !== 'undefined') module.exports = root.ClinicChatStream;
})(typeof window !== 'undefined' ? window : globalThis);
