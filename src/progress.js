export function createProgressReporter({ enabled = true, stream = process.stderr } = {}) {
  if (!enabled) {
    return {
      step() {},
      detail() {},
      startBatch() {},
      batch() {},
      finishBatch() {},
      done() {},
    };
  }

  let lastWasInline = false;
  let spinnerTimer = null;
  let spinnerFrame = 0;
  const spinnerFrames = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▁'];

  function newlineAfterInline() {
    stopSpinner();
    if (lastWasInline) {
      stream.write('\n');
      lastWasInline = false;
    }
  }

  function step(index, total, message) {
    newlineAfterInline();
    stream.write(`[${index}/${total}] ${message}\n`);
  }

  function detail(message) {
    newlineAfterInline();
    stream.write(`      ${message}\n`);
  }

  function renderBatch({ completed, total, processed, totalItems, frame = '█' }) {
    const width = 24;
    const ratio = total ? completed / total : 1;
    const filled = Math.round(width * ratio);
    const bar = `${'█'.repeat(filled)}${'-'.repeat(width - filled)}`;
    const percent = Math.round(ratio * 100);
    stream.write(`\r      ${frame} [${bar}] ${completed}/${total} batches | ${processed}/${totalItems} SKUs | ${percent}%`);
    lastWasInline = true;
  }

  function stopSpinner() {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
  }

  function startBatch(state) {
    stopSpinner();
    spinnerFrame = 0;
    renderBatch({ ...state, frame: spinnerFrames[spinnerFrame] });
    spinnerTimer = setInterval(() => {
      spinnerFrame = (spinnerFrame + 1) % spinnerFrames.length;
      renderBatch({ ...state, frame: spinnerFrames[spinnerFrame] });
    }, 500);
  }

  function batch(state) {
    renderBatch(state);
  }

  function finishBatch(state) {
    stopSpinner();
    renderBatch({ ...state, frame: '█' });
  }

  function done(message) {
    newlineAfterInline();
    if (message) {
      stream.write(`      ${message}\n`);
    }
  }

  return { step, detail, startBatch, batch, finishBatch, done };
}
