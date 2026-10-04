/* Local two-phase student import. Parsing runs in a disposable worker;
 * only explicit confirmation writes the validated database to localStorage.
 */
(function () {
  'use strict';

  // Translation helper. Falls back to the original Spanish string if i18n is unavailable.
  const tr = (text, params) => window.I18N?.t?.(text, params) ?? text;
  const message = (key, params = {}) => ({ key, params });
  const translate = value => typeof value === 'string' ? tr(value) : tr(value.key, value.params);

  const $ = (sel, root = document) => root.querySelector(sel);

  const STORAGE_KEY = 'dae-enfermeria:estudiantes:v1';
  const TABLE_LIMIT = 100;
  const MAX_ERRORS_SHOWN = 8;

  const { validIpe, identificationKey, limits } = StudentImport;

  let db = loadDb();
  // Prevent an import started before privacy erasure from restoring erased data.
  let importGeneration = 0;
  let pendingImport = null;
  let activeWorker = null;
  const listeners = [];

  /* ---------- utilidades ---------- */

  const norm = StudentImport.norm;
  function migrateStudent(record, legacyKey = '') {
    const identificationType = record.identificationType === 'provisional' ? 'ipe' : (record.identificationType || 'run');
    const identificationValue = String(record.identificationValue ?? record.run ?? legacyKey).trim();
    return { ...record, identificationType, identificationValue, run: identificationType === 'run' ? identificationValue : '' };
  }

  function userError(msg) {
    const e = new Error(msg);
    e.userMessage = msg;
    return e;
  }

  /* ---------- almacenamiento ---------- */

  function loadDb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.students || !Object.keys(data.students).length) return null;
      const students = {};
      Object.entries(data.students).forEach(([key, record]) => {
        const student = migrateStudent(record, key);
        const idKey = identificationKey(student.identificationType, student.identificationValue);
        if (idKey) students[idKey] = student;
      });
      return { ...data, schema: 2, students };
    } catch (e) {
      return null;
    }
  }

  function saveDb(data) {
    try {
      if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      throw userError('El navegador no tiene espacio suficiente o no permite guardar datos. Pruebe con un archivo más pequeño.');
    }
    db = data;
    listeners.forEach((fn) => fn());
  }

  /* ---------- ventana ---------- */

  const dialog = $('#studentsDialog');
  const fileInput = $('#stuFile');
  const drop = $('#stuDrop');
  const result = $('#stuResult');
  const search = $('#stuSearch');
  const deleteBtn = $('#stuDelete');

  let resultContent = null;
  function showResult(kind, title, details = []) {
    resultContent = { kind, title, details };
    renderResult();
  }

  function renderResult() {
    if (!resultContent) return;
    const { kind, title, details } = resultContent;
    result.hidden = false;
    result.className = `stu-result is-${kind}`;
    result.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = typeof title === 'function' ? title() : translate(title);
    result.appendChild(strong);
    if (details.length) {
      const ul = document.createElement('ul');
      details.forEach((d) => {
        const li = document.createElement('li');
        li.textContent = typeof d === 'function' ? d() : translate(d);
        ul.appendChild(li);
      });
      result.appendChild(ul);
    }
  }

  function formatStamp(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function renderBase() {
    $('#stuEmpty').hidden = !!db;
    $('#stuBase').hidden = !db;
    resetDelete();
    if (!db) return;

    const list = Object.values(db.students);
    $('#stuMeta').textContent = tr('{count} estudiantes · «{file}» · cargado el {time}', { count: list.length, file: db.fileName, time: formatStamp(db.loadedAt) });

    const q = norm(search.value);
    const matches = list
      .filter((s) => !q || norm(`${s.identificationValue} ${s.apPaterno} ${s.apMaterno} ${s.nombres} ${s.curso}`).includes(q) || norm(`${s.nombres} ${s.apPaterno} ${s.apMaterno}`).includes(q))
      .sort((a, b) => `${a.apPaterno} ${a.apMaterno} ${a.nombres}`.localeCompare(`${b.apPaterno} ${b.apMaterno} ${b.nombres}`, 'es'));

    const tbody = $('#stuRows');
    tbody.replaceChildren();
    matches.slice(0, TABLE_LIMIT).forEach((s) => {
      const tr = document.createElement('tr');
      [translate(s.identificationType === 'ipe' ? 'IPE' : 'RUN chileno'), s.identificationValue, [s.apPaterno, s.apMaterno].filter(Boolean).join(' ') + (s.nombres ? `, ${s.nombres}` : ''), s.curso || '—'].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const note = $('#stuTableNote');
    if (!matches.length) note.textContent = tr('Sin resultados para la búsqueda.');
    else if (matches.length > TABLE_LIMIT) note.textContent = tr('Mostrando {limit} de {count}. Use la búsqueda para encontrar a un estudiante.', { limit: TABLE_LIMIT, count: matches.length });
    else note.textContent = '';
  }

  async function handleFile(file) {
    if (!file) return;
    cancelImport();
    const generation = importGeneration;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      showResult('bad', 'Formato no admitido', ['Use un archivo .xlsx, .xls o .csv (puede partir de la plantilla).']);
      return;
    }
    if (file.size > limits.MAX_FILE_BYTES) {
      showResult('bad', 'No se pudo leer el archivo', [message('El archivo supera el límite de {mb} MiB.', { mb: 5 })]);
      return;
    }
    showResult('busy', message('Leyendo «{file}»…', { file: file.name }));
    $('#stuPreview').hidden = false;
    $('#stuPreviewStats').replaceChildren();
    $('#stuReplacement').textContent = '';
    $('#stuConfirmImport').disabled = true;
    result.setAttribute('aria-busy', 'true');

    try {
      const buffer = await file.arrayBuffer();
      if (generation !== importGeneration) return;
      if (buffer.byteLength > limits.MAX_FILE_BYTES) throw userError(message('El archivo supera el límite de {mb} MiB.', { mb: 5 }));
      const parsed = await parseInWorker(buffer, file.name);
      if (generation !== importGeneration) return;
      pendingImport = { generation, fileName: file.name, parsed };
      result.setAttribute('aria-busy', 'false');
      renderPreview();
      showResult(parsed.errorRows ? 'warn' : 'ok', 'Archivo validado: revise antes de importar.', importDetails(parsed));
      $('#stuPreviewTitle').focus();
    } catch (e) {
      if (generation !== importGeneration) return;
      $('#stuPreview').hidden = true;
      result.setAttribute('aria-busy', 'false');
      showResult('bad', 'No se pudo leer el archivo', [e.userMessage || 'Verifique que sea un Excel válido y que no esté protegido con contraseña.']);
    }
  }

  function importDetails(parsed) {
    const details = [];
    for (const [reports, key] of [[parsed.errors, 'Error · Fila {row}: {message}'], [parsed.warnings, 'Advertencia · Fila {row}: {message}']]) {
      reports.slice(0, MAX_ERRORS_SHOWN).forEach(report => details.push(() => tr(key, {
        row: report.row, message: tr(report.msg, { ...report.params, field: report.params?.field ? tr(report.params.field) : undefined }),
      })));
      if (reports.length > MAX_ERRORS_SHOWN) details.push(message('Hay {count} avisos adicionales; se muestran los primeros {limit} de cada tipo.', { count: reports.length - MAX_ERRORS_SHOWN, limit: MAX_ERRORS_SHOWN }));
    }
    if (!parsed.count) details.push('No hay estudiantes válidos para importar.');
    return details;
  }

  function renderPreview() {
    if (!pendingImport) return;
    const { fileName, parsed } = pendingImport;
    const stats = $('#stuPreviewStats');
    stats.replaceChildren();
    [message('Archivo: {file}', { file: fileName }),
      message('Filas detectadas: {count}', { count: parsed.totalRows }),
      message('Estudiantes válidos: {count}', { count: parsed.count }),
      message('Filas con errores: {count}', { count: parsed.errorRows }),
      message('Filas con advertencias: {count}', { count: parsed.warningRows }),
      message('RUN: {count}', { count: parsed.runCount }), message('IPE: {count}', { count: parsed.ipeCount })
    ].forEach(value => { const li = document.createElement('li'); li.textContent = translate(value); stats.appendChild(li); });
    $('#stuReplacement').textContent = tr(db
      ? 'Al confirmar, se reemplazará la base actual. Las filas con errores se excluirán.'
      : 'Al confirmar, se creará la base local. Las filas con errores se excluirán.');
    $('#stuConfirmImport').disabled = !parsed.count;
  }

  function cancelImport() {
    importGeneration++;
    pendingImport = null;
    if (activeWorker) activeWorker.cancel();
    $('#stuPreview').hidden = true;
    $('#stuPreviewStats').replaceChildren();
    $('#stuReplacement').textContent = '';
    $('#stuConfirmImport').disabled = true;
    result.setAttribute('aria-busy', 'false');
    resultContent = null;
    result.replaceChildren();
    result.hidden = true;
  }

  function parseInWorker(buffer, filename) {
    return new Promise((resolve, reject) => {
      if (!window.Worker) return reject(userError('Este navegador no permite el procesamiento local seguro de archivos.'));
      let worker;
      try { worker = new Worker('js/student-import-worker.js'); }
      catch (_) { return reject(userError('No se pudo iniciar el lector local. Use HTTPS o localhost.')); }
      let timer;
      const finish = (callback, value) => {
        clearTimeout(timer);
        worker.terminate();
        if (activeWorker?.worker === worker) activeWorker = null;
        callback(value);
      };
      activeWorker = { worker, cancel: () => finish(reject, new Error('cancelled')) };
      worker.onmessage = event => event.data.error
        ? finish(reject, userError(event.data.error)) : finish(resolve, event.data.parsed);
      worker.onerror = () => finish(reject, userError('No se pudo iniciar el lector local. Use HTTPS o localhost.'));
      worker.onmessageerror = () => finish(reject, userError('No se pudo leer el archivo'));
      timer = setTimeout(() => finish(reject, userError(message('La lectura superó {seconds} segundos. Use un archivo más pequeño.', { seconds: limits.MAX_PARSE_MS / 1000 }))), limits.MAX_PARSE_MS);
      try { worker.postMessage({ buffer, filename }, [buffer]); }
      catch (e) { finish(reject, e); }
    });
  }

  $('#stuConfirmImport').addEventListener('click', () => {
    if (!pendingImport || pendingImport.generation !== importGeneration || !pendingImport.parsed.count) return;
    const { fileName, parsed } = pendingImport;
    try {
      saveDb({ schema: 2, fileName, loadedAt: Date.now(), students: parsed.students });
    } catch (e) {
      showResult('bad', 'No se pudo guardar la base', [e.userMessage]);
      return;
    }
    const { count, errorRows } = parsed;
    const details = importDetails(parsed);
    cancelImport();
    search.value = '';
    renderBase();
    const title = () => tr('{count} estudiantes cargados', { count }) + (errorRows ? tr(' · {count} fila(s) omitida(s)', { count: errorRows }) : '');
    showResult(errorRows ? 'warn' : 'ok', title, details);
  });
  $('#stuCancelImport').addEventListener('click', () => {
    cancelImport();
    showResult('ok', 'Importación cancelada. La base anterior no cambió.');
  });

  let deleteTimer;
  function resetDelete() {
    clearTimeout(deleteTimer);
    deleteBtn.classList.remove('is-confirm');
    $('#stuDeleteLabel').textContent = tr('Eliminar base');
  }

  deleteBtn.addEventListener('click', () => {
    if (!deleteBtn.classList.contains('is-confirm')) {
      deleteBtn.classList.add('is-confirm');
      $('#stuDeleteLabel').textContent = tr('¿Eliminar? Confirmar');
      deleteTimer = setTimeout(resetDelete, 4000);
      return;
    }
    cancelImport();
    saveDb(null);
    renderBase();
    showResult('ok', 'Base de estudiantes eliminada', ['El autocompletado por identificación queda desactivado hasta cargar otro archivo.']);
  });

  $('#stuPick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files[0]);
    fileInput.value = '';
  });

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', (e) => {
    if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-over');
  });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    handleFile(e.dataTransfer.files[0]);
  });

  search.addEventListener('input', renderBase);
  document.addEventListener('languagechange', () => {
    const confirming = deleteBtn.classList.contains('is-confirm');
    renderBase();
    if (confirming) {
      deleteBtn.classList.add('is-confirm');
      $('#stuDeleteLabel').textContent = tr('¿Eliminar? Confirmar');
      deleteTimer = setTimeout(resetDelete, 4000);
    }
    if (!result.hidden) renderResult();
    renderPreview();
  });
  $('#stuClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cancelImport);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- interfaz pública ---------- */

  window.DAEStudents = {
    identification: { validIpe, key: identificationKey, ipeMaxLength: StudentImport.IPE_MAX_LENGTH },
    clearLocalData() {
      cancelImport();
      db = null;
      search.value = '';
      fileInput.value = '';
      resultContent = null;
      result.replaceChildren();
      result.hidden = true;
      $('#stuRows').replaceChildren();
      $('#stuMeta').textContent = '';
      $('#stuTableNote').textContent = '';
      renderBase();
      listeners.forEach(fn => fn());
      localStorage.removeItem(STORAGE_KEY);
    },
    open() {
      cancelImport();
      result.hidden = true;
      search.value = '';
      renderBase();
      dialog.showModal();
    },
    info() {
      return db ? { count: Object.keys(db.students).length, fileName: db.fileName, loadedAt: db.loadedAt } : null;
    },
    find(value, type = 'run') {
      if (!db) return null;
      const rec = db.students[identificationKey(type, value)];
      return rec ? Object.assign({}, rec) : null;
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    db = loadDb();
    if (dialog.open) renderBase();
    listeners.forEach((fn) => fn());
  });
})();
