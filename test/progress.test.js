import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createProgressReporter } from '../src/progress.js';

function captureStream() {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { stream, read: () => output };
}

test('progress reporter writes steps and batch progress', () => {
  const capture = captureStream();
  const progress = createProgressReporter({ enabled: true, stream: capture.stream });

  progress.step(1, 2, 'Leyendo...');
  progress.detail('10 filas');
  progress.batch({ completed: 1, total: 2, processed: 500, totalItems: 1000 });
  progress.done('listo');

  const output = capture.read();
  assert.match(output, /\[1\/2\] Leyendo/);
  assert.match(output, /10 filas/);
  assert.match(output, /1\/2 batches/);
  assert.match(output, /listo/);
});

test('progress reporter animates and finishes a batch', async () => {
  const capture = captureStream();
  const progress = createProgressReporter({ enabled: true, stream: capture.stream });

  progress.startBatch({ completed: 0, total: 2, processed: 0, totalItems: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 550));
  progress.finishBatch({ completed: 1, total: 2, processed: 500, totalItems: 1000 });
  progress.done('listo');

  const output = capture.read();
  assert.match(output, /▁|▂|▃|▄|▅|▆|▇|█/);
  assert.match(output, /1\/2 batches/);
  assert.match(output, /listo/);
});

test('disabled progress reporter is silent', () => {
  const capture = captureStream();
  const progress = createProgressReporter({ enabled: false, stream: capture.stream });

  progress.step(1, 1, 'Nada');
  progress.startBatch({ completed: 0, total: 1, processed: 0, totalItems: 1 });
  progress.batch({ completed: 1, total: 1, processed: 1, totalItems: 1 });
  progress.finishBatch({ completed: 1, total: 1, processed: 1, totalItems: 1 });
  progress.done('listo');

  assert.equal(capture.read(), '');
});
