import { createServer } from 'node:http';

const port = Number(process.env.RECEIVER_PORT ?? 4000);
let available = false;
let deliveryCount = 0;
const appliedEvents = new Set();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
  });
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/status') {
    sendJson(response, 200, {
      available,
      deliveryCount,
      appliedEffects: appliedEvents.size,
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/control') {
    const body = JSON.parse(await readBody(request));
    available = body.available === true;
    sendJson(response, 200, { available });
    return;
  }

  if (request.method === 'POST' && request.url === '/webhook-receiver') {
    await readBody(request);
    deliveryCount += 1;

    if (!available) {
      sendJson(response, 503, { error: 'receiver unavailable' });
      return;
    }

    const eventId = request.headers['x-relay-event-id'];
    const firstApplication = !appliedEvents.has(eventId);
    if (firstApplication) {
      appliedEvents.add(eventId);
    }

    sendJson(response, 200, {
      delivered: true,
      effectApplied: firstApplication,
    });
    return;
  }

  sendJson(response, 404, { error: 'not found' });
});

server.listen(port, () => {
  console.log(`Demo receiver listening on http://localhost:${port}`);
});