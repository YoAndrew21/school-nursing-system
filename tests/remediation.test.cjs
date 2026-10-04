// Dependency-free regression checks. The DOM doubles do not replace browser visual QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class Element {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
    this.dataset = {};
    Object.entries(attrs).filter(([key]) => key.startsWith('data-')).forEach(([key, value]) => {
      this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    });
    this.style = {};
    this.listeners = {};
    this.children = [];
    this.value = attrs.value || '';
    this.name = attrs.name || '';
    this.type = attrs.type || '';
    this.checked = 'checked' in attrs;
    this.hidden = 'hidden' in attrs;
    this.validity = { badInput: false };
    this.open = false;
    this.textContent = '';
    const classes = new Set((attrs.class || '').split(/\s+/));
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, active = !classes.has(name)) => active ? classes.add(name) : classes.delete(name),
    };
  }
  get id() { return this.attrs.id; }
  set id(value) { this.attrs.id = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, callback, options = {}) {
    (this.listeners[name] ||= []).push({ callback, once: options.once });
  }
  dispatchEvent(event) {
    const listeners = [...(this.listeners[event.type] || [])];
    listeners.forEach(({ callback }) => callback(event));
    this.listeners[event.type] = (this.listeners[event.type] || []).filter(listener => !listener.once);
  }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; this.textContent = ''; }
  get lastChild() { return this.children.at(-1); }
  querySelector(selector) {
    if (selector === '.field-error') return this.error;
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    if (selector === '.hint[id]') return this.hints || [];
    return [];
  }
  closest(selector) { return selector === '.field' ? this.field : null; }
  matches(selector) {
    return selector.split(',').some(part => part.trim() === `#${this.id}` ||
      (part.trim() === '[data-digits]' && 'data-digits' in this.attrs) ||
      (part.trim() === '[data-run]' && 'data-run' in this.attrs));
  }
  getBoundingClientRect() { return { width: 0, height: 0 }; }
  getContext() { return { clearRect() {} }; }
  showModal() { this.open = true; }
  close(value) { this.returnValue = value; this.open = false; this.dispatchEvent({ type: 'close' }); }
  focus() {}
  scrollIntoView() {}
}

function setup({ denied = false, stored = {}, realPdf = false } = {}) {
  const elements = [];
  for (const match of read('index.html').matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      attrs[attr[1]] = (attr[2] || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }
    const element = new Element(attrs);
    element.tag = match[1];
    elements.push(element);
  }
  const ids = Object.fromEntries(elements.filter(el => el.id).map(el => [el.id, el]));
  const inputs = elements.filter(el => el.name && ['input', 'textarea', 'select'].includes(el.tag));
  inputs.namedItem = name => inputs.find(el => el.name === name);
  const form = ids.daeForm;
  form.elements = inputs;
  const fields = {};
  inputs.forEach(input => {
    const field = fields[input.name] ||= new Element();
    field.error ||= new Element();
    field.hints = input.name === 'identificationValue' ? [ids.identificationPolicy, ids.provisionalPdfNotice, ids.runLookup] : input.name === 'fechaNac' ? [ids.anioNacHint] : [];
    input.field = field;
  });
  form.querySelectorAll = selector => {
    const name = /\[name="([^"]+)"\]/.exec(selector)?.[1];
    return name ? inputs.filter(input => input.name === name) : [];
  };
  const document = new Element();
  document.documentElement = {};
  document.querySelectorAll = selector => {
    if (selector === '#previewFrame iframe') return elements.filter(el => el.tag === 'iframe');
    if (selector === '.steps a') return elements.filter(el => el.dataset.step);
    if (selector === '.card') return [];
    if (selector.startsWith('.')) return elements.filter(el => el.classList.contains(selector.slice(1)));
    if (selector.startsWith('#')) return ids[selector.slice(1)] ? [ids[selector.slice(1)]] : [];
    const attr = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    return attr ? elements.filter(el => attr in el.attrs) : [];
  };
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.createElement = () => new Element();
  document.head = new Element();
  ids.saveStatus.querySelector = () => elements.find(el => el.classList.contains('save-text'));
  const storage = new Map(Object.entries(stored));
  const timers = new Map();
  let timerId = 0;
  let downloads = 0;
  let previews = 0;
  let generated = 0;
  const context = {
    document, console, Date, Blob, URL, TextDecoder, location: { protocol: 'http:' },
    navigator: { pdfViewerEnabled: true },
    localStorage: {
      getItem(key) { if (denied) throw Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (denied) throw Error('Storage denied'); storage.set(key, value); },
      removeItem(key) { if (denied) throw Error('Storage denied'); storage.delete(key); },
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Image: class {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener() {}, scrollTo() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    open: () => { previews++; return { location: {}, close() {} }; },
    DAE: {
      weekdayIndex: () => '1',
      fitCircunstancia: () => ({ mode: 'normal', size: 9 }),
      buildPdf() { generated++; return { output: () => new Blob(['PDF']), save() { downloads++; } }; },
    },
  };
  context.window = context;
  vm.createContext(context);
  if (realPdf) {
    context.jspdf = require('../vendor/jspdf.umd.min.js');
    vm.runInContext(read('js/pdf.js'), context);
  }
  vm.runInContext(read('js/i18n.js'), context);
  vm.runInContext(read('js/estudiantes.js'), context);
  // Expose private pure functions only in this in-memory test copy.
  const source = read('js/app.js').replace('  init();',
    '  window.review = { parseCalendarDate, computeAge, dateError, renderValidation, clearLocalData, download, openPreview, getData, validRun, validIdentification, lookupStudent, setData };\n  init();');
  vm.runInContext(source, context);
  document.dispatchEvent({ type: 'DOMContentLoaded' });
  return {
    context, elements, ids, fields, storage, timers, form,
    get downloads() { return downloads; }, get previews() { return previews; }, get generated() { return generated; },
    flush() { const queued = [...timers.values()]; timers.clear(); queued.forEach(fn => fn()); },
    input(name, value) {
      const element = inputs.namedItem(name);
      element.value = value;
      form.dispatchEvent({ type: 'input', target: element });
    },
    blur(name) { form.dispatchEvent({ type: 'focusout', target: inputs.namedItem(name) }); },
  };
}

test('calendar validation handles leap centuries, impossible dates and ordering', () => {
  const { context } = setup();
  const { parseCalendarDate, dateError, computeAge } = context.review;
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '0000-01-01', '2026-1-01', 'bad']) assert.equal(parseCalendarDate(value), null, value);
  for (const value of ['2000-02-29', '2024-02-29', '2026-04-30']) assert.ok(parseCalendarDate(value), value);
  assert.match(dateError('fechaAcc', { fechaAcc: '9999-01-01' }), /futura/);
  assert.match(dateError('fechaNac', { fechaNac: '2020-01-02', fechaAcc: '2020-01-01' }), /posterior/);
  assert.match(dateError('fechaRegistro', { fechaRegistro: '2026-02-31' }), /válida/);
  assert.match(dateError('fechaCierre', { fechaCierre: '2026-13-01' }), /válida/);
  assert.equal(computeAge('2020-01-01', '2020-01-01'), '0');
  assert.equal(computeAge('2010-07-15', '2020-07-14'), '9');
  assert.equal(computeAge('2010-07-15', '2020-07-15'), '10');
  assert.equal(computeAge('2010-01-01', '2026-02-31'), '');
});

test('date edits clear stale ages and expose associated, translated validation errors', () => {
  const env = setup();
  env.input('fechaAcc', '2020-07-15');
  env.input('fechaNac', '2010-07-15');
  assert.equal(env.ids.edad.value, '10');
  env.input('fechaNac', '');
  assert.equal(env.ids.edad.value, '');
  env.input('fechaNac', '2021-01-01');
  env.blur('fechaNac');
  assert.equal(env.ids.edad.value, '');
  assert.equal(env.ids.fechaNac.getAttribute('aria-invalid'), 'true');
  assert.match(env.ids.fechaNac.getAttribute('aria-describedby'), /fechaNacError/);
  assert.match(env.ids.fechaNac.getAttribute('aria-describedby'), /anioNacHint/);
  env.context.I18N.apply('en');
  assert.match(env.fields.fechaNac.error.textContent, /after the accident/);
  env.context.I18N.apply('ja');
  assert.match(env.fields.fechaNac.error.textContent, /事故発生日/);
  env.input('fechaNac', '2010-01-01');
  assert.equal(env.ids.fechaNac.getAttribute('aria-invalid'), 'false');
  env.blur('curso');
  assert.equal(env.ids.curso.getAttribute('aria-invalid'), 'true');
  env.input('curso', 'Fictional class');
  assert.equal(env.ids.curso.getAttribute('aria-invalid'), 'false');
});

test('storage denial preserves usable language selection and selector state', () => {
  const env = setup({ denied: true });
  assert.equal(env.context.I18N.language, 'es');
  for (const language of ['en', 'ja', 'es']) {
    assert.doesNotThrow(() => env.context.I18N.apply(language));
    assert.equal(env.context.I18N.language, language);
    for (const button of env.elements.filter(el => el.dataset.lang)) {
      assert.equal(button.getAttribute('aria-pressed'), String(button.dataset.lang === language));
    }
  }
  env.input('nombres', 'Fictional');
  env.flush();
  assert.equal(env.elements.find(el => el.classList.contains('save-text')).textContent, 'Sin guardado local');
});

test('only marked UI is translated; dynamic state and interpolation survive language switches', () => {
  const env = setup();
  env.ids.nombres.value = 'Curso';
  const unmarked = new Element(); unmarked.textContent = 'Curso';
  env.elements.push(unmarked);
  for (const language of ['en', 'ja', 'es']) {
    env.context.I18N.apply(language);
    assert.equal(env.ids.nombres.value, 'Curso');
    assert.equal(unmarked.textContent, 'Curso');
    assert.equal(env.context.I18N.t('Leyendo «{file}»…', { file: '{count}.csv' }).includes('{count}.csv'), true);
  }
  env.ids.stuDelete.dispatchEvent({ type: 'click' });
  env.context.I18N.apply('en');
  assert.equal(env.ids.stuDeleteLabel.textContent, 'Delete? Confirm');
  assert.equal(env.ids.stuDelete.classList.contains('is-confirm'), true);
  env.context.I18N.apply('ja');
  assert.equal(env.ids.stuDeleteLabel.textContent, '削除を確定');
});

test('invalid dates cannot be bypassed by PDF download or preview', async () => {
  const env = setup();
  env.input('fechaAcc', '9999-01-01');
  env.context.review.openPreview();
  assert.equal(env.previews, 0);
  const pending = env.context.review.download();
  assert.equal(env.ids.dialogCancel.textContent, 'Cancelar');
  env.ids.dialog.close('cancel');
  await pending;
  assert.equal(env.downloads, 0);
});

test('clear confirmation cancellation preserves data; acceptance removes only application keys', async () => {
  const env = setup({ stored: {
    'dae-enfermeria:v1': JSON.stringify({ schema: 2, nombres: 'Fictional', diagnostico: 'Synthetic', firma: 'data:image/png;base64,c3ludGhldGlj' }),
    'dae-enfermeria:estudiantes:v1': JSON.stringify({ students: { synthetic: { nombres: 'Fictional' } } }),
    'dae-enfermeria:prefs': '{}', 'school-nursing-language': 'en', unrelated: 'keep',
  } });
  let pending = env.context.review.clearLocalData();
  assert.match(env.ids.dialogBody.innerHTML, /medical information/);
  env.ids.dialog.close('cancel'); await pending;
  assert.ok(env.storage.has('dae-enfermeria:v1'));
  assert.equal(env.ids.nombres.value, 'Fictional');
  assert.ok(env.context.review.getData().firma);
  env.input('nombres', 'Disposable fictional draft');
  pending = env.context.review.clearLocalData();
  env.ids.dialog.close('ok'); await pending;
  env.blur('nombres');
  env.context.I18N.apply('ja'); // Selecting a language may save this non-sensitive preference again.
  env.flush();
  for (const key of ['dae-enfermeria:v1', 'dae-enfermeria:estudiantes:v1', 'dae-enfermeria:prefs']) assert.equal(env.storage.has(key), false, key);
  assert.equal(env.storage.get('unrelated'), 'keep');
  assert.equal(env.ids.nombres.value, '');
  assert.equal(env.ids.diagnostico.value, '');
  assert.equal(env.context.review.getData().firma, '');
  assert.equal(env.context.DAEStudents.info(), null);
  assert.equal(env.ids.stuRows.children.length, 0);
  assert.equal(env.ids.stuResult.children.length, 0);
  env.input('nombres', 'New fictional draft'); env.flush();
  assert.ok(env.storage.has('dae-enfermeria:v1'));
});

test('clear storage failure is reported without claiming successful deletion', async () => {
  const env = setup({ denied: true });
  const pending = env.context.review.clearLocalData();
  env.ids.dialog.close('ok'); await pending;
  assert.match(env.ids.toast.textContent, /No se puede confirmar/);
  assert.equal(env.ids.nombres.value, '');
  assert.equal(env.context.DAEStudents.info(), null);
});

test('CSV and XLSX imports retain student values while results and errors switch languages', async () => {
  const X = require('../vendor/xlsx.full.min.js');
  const env = setup();
  env.context.XLSX = X;
  const rows = [['RUN', 'Apellido paterno', 'Nombres', 'Curso'],
    ['12.345.678-5', 'Fictional', 'Curso', 'Synthetic'], ['12.345.678-9', 'Fictional', 'Example', 'Synthetic']];
  const workbook = X.utils.book_new();
  X.utils.book_append_sheet(workbook, X.utils.aoa_to_sheet(rows), 'Estudiantes');
  const files = [
    { name: 'synthetic.csv', buffer: Buffer.from(rows.map(row => row.join(',')).join('\n')) },
    { name: 'synthetic.xlsx', buffer: X.write(workbook, { type: 'buffer', bookType: 'xlsx' }) },
  ];
  for (const file of files) {
    env.ids.stuFile.files = [{ name: file.name, arrayBuffer: async () => file.buffer }];
    env.ids.stuFile.dispatchEvent({ type: 'change' });
    await new Promise(setImmediate);
    assert.equal(env.context.DAEStudents.info().count, 1);
    for (const language of ['es', 'en', 'ja']) {
      env.context.I18N.apply(language);
      assert.equal(env.context.DAEStudents.find('123456785').nombres, 'Curso');
      const title = env.ids.stuResult.children[0].textContent;
      assert.match(title, language === 'es' ? /estudiantes cargados/ : language === 'en' ? /students imported/ : /取り込みました/);
      const detail = env.ids.stuResult.children[1].children[0].textContent;
      assert.match(detail, language === 'es' ? /RUN inválido/ : language === 'en' ? /Invalid RUN/ : /RUNが無効/);
    }
  }
});

test('an import pending at erasure cannot restore student data', async () => {
  const env = setup();
  env.context.XLSX = require('../vendor/xlsx.full.min.js');
  let finishRead;
  const readPromise = new Promise(resolve => { finishRead = resolve; });
  env.ids.stuFile.files = [{ name: 'synthetic.csv', arrayBuffer: () => readPromise }];
  env.ids.stuFile.dispatchEvent({ type: 'change' });
  await new Promise(setImmediate);
  const pending = env.context.review.clearLocalData();
  env.ids.dialog.close('ok'); await pending;
  finishRead(Buffer.from('RUN,Nombres\n12.345.678-5,Fictional'));
  await new Promise(setImmediate);
  assert.equal(env.context.DAEStudents.info(), null);
  assert.equal(env.storage.has('dae-enfermeria:estudiantes:v1'), false);
  assert.equal(env.ids.stuResult.children.length, 0);
});

test('all marked translations and parameter names match across EN and JA', () => {
  const source = read('js/i18n.js');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(0, source.indexOf("  let current = 'es';")) + 'globalThis.dict = dictionaries;})();', context);
  for (const key of Object.keys(context.dict.en)) {
    assert.ok(context.dict.ja[key], key);
    const params = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    assert.deepEqual(params(context.dict.en[key]), params(key), key);
    assert.deepEqual(params(context.dict.ja[key]), params(key), key);
  }
  for (const match of read('index.html').matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
    assert.ok(context.dict.en[match[1]], match[1]);
    assert.ok(context.dict.ja[match[1]], match[1]);
  }
});

test('real PDF remains Spanish and can produce blobs for preview and download in every UI language', () => {
  const env = setup({ realPdf: true });
  for (const language of ['es', 'en', 'ja']) {
    env.context.I18N.apply(language);
    const doc = env.context.DAE.buildPdf({ nombres: 'Fictional', fechaAcc: '2020-01-01' });
    assert.equal(doc.getNumberOfPages(), 1);
    assert.match(doc.internal.pages[1].join('\n'), /DECLARACION INDIVIDUAL DE ACCIDENTE ESCOLAR/);
    assert.ok(doc.output('blob').size > 0);
    assert.ok(doc.output('arraybuffer').byteLength > 0);
  }
});

// All identification values below are fictional test fixtures, never issued IPE examples.
test('RUN validation is unchanged; numeric IPE policy is separate from RUN', () => {
  const env = setup();
  assert.equal(env.context.review.validRun('12.345.678-5'), true);
  assert.equal(env.context.review.validRun('12.345.678-9'), false);
  assert.equal(env.context.review.validIdentification('run', '12.345.678-9'), false);
  for (const id of ['123456789', '000123', ' 123456789 ', '1234567890']) {
    assert.equal(env.context.review.validIdentification('ipe', id), true, id);
  }
  for (const id of ['', ' ', '1'.repeat(31), 'IPE-DEMO-0001', '123.456', '123-456', '123 456', 'IPE\n123', '識別番号']) {
    assert.equal(env.context.review.validIdentification('ipe', id), false, id);
  }
  assert.equal(env.context.review.validIdentification('unknown', '123'), false);
});

test('legacy invalid RUN never becomes IPE; explicit malformed IPE reports its own type', async () => {
  const env = setup();
  await importRows(env, [['RUN', 'Nombres'], ['12.345.678-5', 'Fictional'], ['IPE-DEMO-0001', 'Rejected'], ['123456789', 'Rejected numeric']]);
  assert.equal(env.context.DAEStudents.info().count, 1);
  assert.equal(env.context.DAEStudents.find('123456789', 'ipe'), null);
  assert.match(env.ids.stuResult.children[1].children[0].textContent, /RUN inválido/);
  await importRows(env, [['Tipo de identificación', 'Identificación', 'Nombres'], ['IPE', '123456789', 'Fictional IPE'], ['IPE', 'IPE-DEMO-0001', 'Rejected IPE'], ['Unknown', '123', 'Rejected type']]);
  assert.equal(env.context.DAEStudents.info().count, 1);
  assert.match(env.ids.stuResult.children[1].children[0].textContent, /IPE inválido/);
  assert.match(env.ids.stuResult.children[1].children[1].textContent, /Tipo de identificación no reconocido/);
  for (const lang of ['en', 'ja']) {
    env.context.I18N.apply(lang);
    const details = env.ids.stuResult.children[1].children.map(el => el.textContent).join(' ');
    assert.doesNotMatch(details, /RUN inválido|IPE inválido|Tipo de identificación no reconocido/);
  }
});

test('prior provisional storage becomes IPE without erasing values or unrelated fields', () => {
  const env = setup({ stored: {
    'dae-enfermeria:v1': JSON.stringify({ schema: 2, identificationType: 'provisional', identificationValue: ' 000123 ', nombres: 'Fictional', curso: 'Demo' }),
    'dae-enfermeria:estudiantes:v1': JSON.stringify({ students: { 'provisional:000123': { identificationType: 'provisional', identificationValue: ' 000123 ', nombres: 'Fictional stored' } } }),
  } });
  assert.equal(env.ids.identificationType.value, 'ipe');
  assert.equal(env.context.DAEStudents.find('000123', 'ipe').identificationType, 'ipe');
  assert.equal(env.context.DAEStudents.find('000123', 'ipe').identificationValue, '000123');
  env.input('identificationType', 'run');
  assert.equal(env.ids.nombres.value, 'Fictional');
  assert.equal(env.ids.curso.value, 'Demo');
  env.input('identificationType', 'ipe');
  assert.equal(env.ids.nombres.value, 'Fictional');
});

async function importRows(env, rows, bookType = 'csv') {
  const X = require('../vendor/xlsx.full.min.js');
  env.context.XLSX = X;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), 'Estudiantes');
  const buffer = bookType === 'csv' ? Buffer.from(rows.map(r => r.join(',')).join('\n'))
    : X.write(wb, { type: 'buffer', bookType });
  env.ids.stuFile.files = [{ name: `fictional.${bookType === 'biff8' ? 'xls' : bookType}`, arrayBuffer: async () => buffer }];
  env.ids.stuFile.dispatchEvent({ type: 'change' });
  await new Promise(setImmediate);
}

test('mixed CSV, XLSX and XLS import uses typed keys and preserves provisional values', async () => {
  for (const format of ['csv', 'xlsx', 'biff8']) {
    const env = setup();
    await importRows(env, [
      ['Identificación', 'Tipo de identificación', 'Nombres', 'Curso'],
      ['12.345.678-5', 'RUN', 'Fictional RUN', 'Demo A'],
      ['123456789', 'IPE', 'Fictional provisional', 'Demo B'],
      ['123456785', 'IPE', 'Fictional collision', 'Demo C'],
      ['000123', 'Provisional', 'Fictional zeros', 'Demo D'],
      ['12.345.678-9', 'RUN', 'Rejected RUN', 'Demo'],
      ['anything', 'unknown', 'Rejected type', 'Demo'],
    ], format);
    const students = env.context.DAEStudents;
    assert.equal(students.info().count, 4, format);
    assert.equal(students.find('12.345.678-5').identificationType, 'run');
    assert.equal(students.find('123456785', 'ipe').nombres, 'Fictional collision');
    assert.equal(students.find('123456789', 'run'), null);
    assert.equal(students.find('000123', 'ipe').identificationValue, '000123');
    for (const query of ['12.345.678-5', '000123']) {
      env.ids.stuSearch.value = query;
      env.ids.stuSearch.dispatchEvent({ type: 'input' });
      assert.equal(env.ids.stuRows.children.length, query === '12.345.678-5' ? 2 : 1);
    }
    const saved = JSON.parse(env.storage.get('dae-enfermeria:estudiantes:v1'));
    assert.equal(saved.schema, 2);
    assert.ok(saved.students['run:123456785']);
    assert.ok(saved.students['ipe:123456785']);
    assert.equal(saved.students['ipe:123456785'].run, '');
    env.input('identificationValue', '12.345.678-5');
    assert.equal(env.ids.nombres.value, 'Fictional RUN');
    env.input('identificationType', 'ipe');
    env.input('identificationValue', '123456789');
    env.blur('identificationValue');
    assert.equal(env.ids.nombres.value, 'Fictional provisional');
    assert.equal(env.context.review.getData().identificationValue, '123456789');
    assert.equal(env.context.review.getData().run, '');
    env.flush();
    const restored = setup({ stored: Object.fromEntries(env.storage) });
    assert.equal(restored.ids.identificationType.value, 'ipe');
    assert.equal(restored.ids.run.value, '123456789');
    assert.equal(restored.context.DAEStudents.find('123456785', 'ipe').nombres, 'Fictional collision');
  }
});

test('legacy database, draft and RUN-only spreadsheet remain compatible', async () => {
  const env = setup({ stored: {
    'dae-enfermeria:v1': JSON.stringify({ schema: 2, run: '12.345.678-5', nombres: 'Fictional draft' }),
    'dae-enfermeria:estudiantes:v1': JSON.stringify({ students: { '123456785': { run: '12.345.678-5', nombres: 'Fictional legacy' } } }),
  } });
  assert.equal(env.ids.identificationType.value, 'run');
  assert.equal(env.ids.run.value, '12.345.678-5');
  assert.equal(env.context.DAEStudents.find('12.345.678-5').identificationType, 'run');
  await importRows(env, [['RUN', 'Nombres'], ['12.345.678-5', 'Fictional import']]);
  assert.equal(env.context.DAEStudents.info().count, 1);
  assert.equal(env.context.DAEStudents.find('123456785').nombres, 'Fictional import');
  // New files may retain RUN as their value column with an explicit provisional type.
  await importRows(env, [['RUN', 'Tipo de identificación', 'Nombres'], ['000123', 'IPE', 'Fictional IPE']]);
  assert.equal(env.context.DAEStudents.find('000123', 'ipe').identificationValue, '000123');
  env.ids.stuFile.files = [{ name: 'fictional-legacy.csv', arrayBuffer: async () => Buffer.from('RUN,Nombres\n12.345.678-5,Fictício', 'latin1') }];
  env.ids.stuFile.dispatchEvent({ type: 'change' });
  await new Promise(setImmediate);
  assert.equal(env.context.DAEStudents.find('123456785').nombres, 'Fictício');
});

test('identification controls, errors and PDF notice translate in ES/EN/JA', () => {
  const env = setup();
  env.input('identificationType', 'ipe');
  env.blur('identificationValue');
  assert.equal(env.ids.run.getAttribute('aria-invalid'), 'true');
  assert.match(env.ids.run.getAttribute('aria-describedby'), /identificationPolicy/);
  for (const language of ['es', 'en', 'ja']) {
    env.context.I18N.apply(language);
    assert.equal(env.ids.identificationLabel.textContent, env.context.I18N.t('IPE — Identificador Provisorio Escolar'));
    assert.ok(env.ids.identificationPolicy.textContent);
    assert.equal(env.ids.provisionalPdfNotice.hidden, false);
    assert.ok(env.fields.identificationValue.error.textContent);
    assert.match(env.ids.run.placeholder, /123456789/);
  }
  env.input('identificationValue', '123456789');
  assert.equal(env.ids.run.getAttribute('aria-invalid'), 'false');
  env.input('identificationType', 'run');
  assert.equal(env.ids.run.value, '');
  assert.equal(env.ids.provisionalPdfNotice.hidden, true);
});

test('Spanish PDF uses the existing official identification field for both types', () => {
  const env = setup({ realPdf: true });
  for (const language of ['es', 'en', 'ja']) {
    env.context.I18N.apply(language);
    const pdf = env.context.DAE.buildPdf({ identificationType: 'ipe', identificationValue: '123456789', nombres: 'Fictional' });
    const page = pdf.internal.pages[1].join('\n');
    assert.match(page, /R.U.N. ALUMNO/);
    assert.match(page, /123456789/);
    assert.match(page, /DECLARACION INDIVIDUAL DE ACCIDENTE ESCOLAR/);
    assert.ok(pdf.output('blob').size > 0);
    const legacy = env.context.DAE.buildPdf({ run: '12.345.678-5' });
    const typed = env.context.DAE.buildPdf({ identificationType: 'run', identificationValue: '12.345.678-5' });
    assert.equal(typed.internal.pages[1].join('\n'), legacy.internal.pages[1].join('\n'));
  }
});

test('updated template has typed identification, text format and preserved dropdowns/frozen panes', () => {
  const X = require('../vendor/xlsx.full.min.js');
  const buffer = fs.readFileSync(path.join(root, 'plantillas/Plantilla_Estudiantes.xlsx'));
  const wb = X.read(buffer, { type: 'buffer', cellNF: true, sheetStubs: true });
  assert.equal(wb.Sheets.Estudiantes.A4.v, 'Identificación *');
  assert.equal(wb.Sheets.Estudiantes.O4.v, 'Tipo de identificación');
  assert.equal(wb.Sheets.Estudiantes.A5.z, '@');
  const zip = X.CFB.read(buffer, { type: 'buffer' });
  const i = zip.FullPaths.findIndex(p => p.endsWith('/xl/worksheets/sheet1.xml'));
  const xml = Buffer.from(zip.FileIndex[i].content).toString();
  assert.match(xml, /xSplit="1" ySplit="4"/);
  assert.match(xml, /RUN,IPE/);
  assert.match(xml, /OFFSET\(Listas!/);
  assert.doesNotMatch(xml, /sqref="A10:A3004"/);
  assert.doesNotMatch(xml, /El RUN debe tener entre 3 y 12/);
});
