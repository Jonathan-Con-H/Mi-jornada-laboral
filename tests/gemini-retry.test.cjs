const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Ejecutar el motor real con un modelo simulado, sin Google ni datos laborales.
const source = fs.readFileSync(require('node:path').join(__dirname, '../mi-jornada-gemini.js'), 'utf8')
  .replace('window.miJornadaGemini = { ask };',
    'window.miJornadaGemini = { ask, generateWithRetry, withTimeout };');
function setup() {
  const timers = new Map(), waits = [];
  let id = 0;
  const context = {
    window: {}, AbortController,
    setTimeout(fn, delay) {
      const key = ++id;
      if (delay < 10000) { waits.push(delay); queueMicrotask(fn); }
      else timers.set(key, fn);
      return key;
    },
    clearTimeout(key) { timers.delete(key); }
  };
  vm.runInNewContext(source, context);
  return { ...context.window.miJornadaGemini, timers, waits };
}
test('500 de alta demanda seguido de éxito: una sola respuesta y aviso de reintento', async () => {
  const h = setup(), statuses = [];
  let calls = 0;
  const result = await h.generateWithRetry({ generateContent: async () => {
    if (++calls === 1) throw Error('AI: [500 ] This model is currently experiencing high demand.');
    return 'correcto';
  } }, 'hola', s => statuses.push(s));
  assert.equal(result, 'correcto');
  assert.equal(calls, 2);
  assert.deepEqual(h.waits, [2000]);
  assert.match(statuses[0], /Reintento 1 de 2/);
  assert.equal(h.timers.size, 0);
});
test('503 persistente: máximo tres peticiones con pausas de 2 y 4 segundos', async () => {
  const h = setup(); let calls = 0;
  await assert.rejects(h.generateWithRetry({ generateContent: async () => {
    calls++; throw Object.assign(Error('Unavailable'), { status: 503 });
  } }, 'hola'), /dos reintentos/);
  assert.equal(calls, 3);
  assert.deepEqual(h.waits, [2000, 4000]);
  assert.equal(h.timers.size, 0);
});
for (const message of ['[429 ] quota', '[403 ] permission denied', 'app-check/token-error', 'Failed to fetch']) {
  test('no reintenta ' + message, async () => {
    const h = setup(); let calls = 0;
    await assert.rejects(h.generateWithRetry({ generateContent: async () => {
      calls++; throw Error(message);
    } }, 'hola'), e => e.message === message);
    assert.equal(calls, 1);
    assert.deepEqual(h.waits, []);
  });
}
test('petición bloqueada: se aborta, no se reintenta ni se devuelve la respuesta tardía', async () => {
  const h = setup(); let signal, resolveRequest, calls = 0;
  const pending = h.generateWithRetry({ generateContent: (_, options) => {
    calls++; signal = options.signal;
    return new Promise(resolve => { resolveRequest = resolve; });
  } }, 'hola');
  const rejected = assert.rejects(pending, /tarda demasiado/);
  for (const fn of h.timers.values()) fn();
  await rejected;
  assert.equal(signal.aborted, true);
  resolveRequest('respuesta tardía');
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(h.timers.size, 0);
});
test('timeout del SDK se traduce y no se reintenta', async () => {
  const h = setup();
  await assert.rejects(h.generateWithRetry({ generateContent: async () => {
    throw Object.assign(Error('signal aborted'), { name: 'AbortError' });
  } }, 'hola'), /tarda demasiado/);
  assert.deepEqual(h.waits, []);
});
test('inicialización bloqueada termina sin seguir con el envío', async () => {
  const h = setup(); let continued = false;
  const pending = h.withTimeout(new Promise(() => {}), 25000, 'Conexión segura agotada')
    .then(() => { continued = true; });
  const rejected = assert.rejects(pending, /Conexión segura agotada/);
  for (const fn of h.timers.values()) fn();
  await rejected;
  assert.equal(continued, false);
});
