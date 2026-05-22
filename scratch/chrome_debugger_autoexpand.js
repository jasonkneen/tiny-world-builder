const { spawn } = require('child_process');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--mute-audio',
  'http://localhost:3000/tiny-world-builder'
];

console.log('Starting Chrome with debugging port 9222...');
const chromeProcess = spawn(chromePath, args);

setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    const targets = await res.json();
    const pageTarget = targets.find(t => t.url.includes('tiny-world-builder'));
    if (!pageTarget) {
      console.error('Could not find page target!');
      chromeProcess.kill();
      process.exit(1);
    }

    console.log(`Connecting to WebSocket: ${pageTarget.webSocketDebuggerUrl}`);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.onopen = () => {
      console.log('WebSocket connected. Enabling Runtime and Log...');
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      
      // Set localStorage and reload the page
      console.log('Setting autoExpand=1 in localStorage and reloading...');
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: "localStorage.setItem('tinyworld:render:autoExpand', '1'); location.reload();"
        }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const argsText = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log(`[PAGE CONSOLE - ${type}] ${argsText}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[PAGE EXCEPTION]', msg.params.exceptionDetails);
      } else if (msg.method === 'Log.entryAdded') {
        console.log(`[PAGE LOG - ${msg.params.entry.level}] ${msg.params.entry.text}`);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

  } catch (err) {
    console.error('Failed to connect to Chrome:', err);
    chromeProcess.kill();
    process.exit(1);
  }
}, 2000);

setTimeout(() => {
  console.log('Stopping test after 10 seconds...');
  chromeProcess.kill();
  process.exit(0);
}, 12000);
