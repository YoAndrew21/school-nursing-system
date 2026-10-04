/*
 * Carga masiva de estudiantes: lectura del Excel y base guardada en el
 * navegador (localStorage) para completar el formulario a partir del RUN.
 * El lector de Excel se carga solo al abrir esta ventana. La plantilla con
 * formato es un archivo fijo (plantillas/), generado con tools/generar-plantilla.js.
 */
(function () {
  'use strict';

  // Translation helper. Falls back to the original Spanish string if i18n is unavailable.
  const tr = (text, params) => window.I18N?.t?.(text, params) ?? text;
  const message = (key, params = {}) => ({ key, params });
  const translate = value => typeof value === 'string' ? tr(value) : tr(value.key, value.params);

  const $ = (sel, root = document) => root.querySelector(sel);

  const STORAGE_KEY = 'dae-enfermeria:estudiantes:v1';
  const XLSX_SRC = 'vendor/xlsx.full.min.js';
  const SHEET_NAME = 'Estudiantes';
  const TABLE_LIMIT = 100;
  const MAX_ERRORS_SHOWN = 8;

  // Columnas de la plantilla → campos del formulario (los encabezados se comparan
  // sin tildes, mayúsculas ni símbolos: «RUN *» equivale a «RUN»)
  const COLUMNS = [
    { name: 'run', header: 'RUN', aliases: ['rut', 'run alumno', 'rut alumno', 'run estudiante', 'rut estudiante'] },
    { name: 'identificationType', header: 'Tipo de identificación', aliases: ['tipo identificacion', 'identification type', 'identificationType'] },
    { name: 'identificationValue', header: 'Identificación', aliases: ['identificador', 'identification', 'identification value', 'identificationValue'] },
    { name: 'apPaterno', header: 'Apellido paterno', aliases: ['paterno', 'primer apellido'], max: 30 },
    { name: 'apMaterno', header: 'Apellido materno', aliases: ['materno', 'segundo apellido'], max: 30 },
    { name: 'nombres', header: 'Nombres', aliases: ['nombre', 'nombres alumno'], max: 40 },
    { name: 'sexo', header: 'Sexo', aliases: ['genero'], parse: parseSexo },
    { name: 'fechaNac', header: 'Fecha de nacimiento', aliases: ['fecha nacimiento', 'nacimiento', 'fecha nac'], parse: parseDate },
    { name: 'curso', header: 'Curso', aliases: ['nivel', 'curso alumno'], max: 30 },
    { name: 'horario', header: 'Horario', aliases: ['jornada'], max: 30 },
    { name: 'calle', header: 'Calle', aliases: ['direccion', 'domicilio'], max: 50 },
    { name: 'numero', header: 'Número', aliases: ['nro', 'n°', 'num', 'numero casa'], max: 10 },
    { name: 'poblacion', header: 'Población / Villa', aliases: ['poblacion', 'villa', 'sector'], max: 40 },
    { name: 'resComuna', header: 'Comuna', aliases: ['comuna residencia'], max: 30 },
    { name: 'resProvincia', header: 'Provincia', aliases: ['provincia residencia'], max: 30 },
    { name: 'codifCom', header: 'Codif. comuna', aliases: ['codigo comuna', 'cod comuna', 'codificacion comuna'], parse: (v) => text(v).replace(/\D/g, '').slice(0, 3) },
  ];

  let db = loadDb();
  // Prevent an import started before privacy erasure from restoring erased data.
  let clearGeneration = 0;
  const listeners = [];

  /* ---------- utilidades ---------- */

  function norm(v) {
    return String(v == null ? '' : v)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function text(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function cleanRun(v) {
    return String(v || '').replace(/[^0-9kK]/g, '').toUpperCase().replace(/^0+(?=\d)/, '');
  }

  function validRun(v) {
    const c = cleanRun(v);
    if (c.length < 2) return false;
    const body = c.slice(0, -1);
    if (!/^\d{1,8}$/.test(body)) return false;
    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const r = 11 - (sum % 11);
    return c.slice(-1) === (r === 11 ? '0' : r === 10 ? 'K' : String(r));
  }

  function formatRun(c) {
    return c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
  }

  // This is an application input policy, not an official IPE format.
  // Numeric input only; preserve leading zeroes and trim surrounding whitespace.
  // The length cap is a technical bound, not an official IPE length rule.
  const IPE_MAX_LENGTH = 30;
  function validIpe(value) {
    const id = String(value ?? '').trim();
    return id.length >= 1 && id.length <= IPE_MAX_LENGTH && /^[0-9]+$/.test(id);
  }

  function parseIdentificationType(value) {
    if (!String(value ?? '').trim()) return 'run';
    const type = norm(value);
    if (['run', 'rut', 'runchileno', 'chileanrun'].includes(type)) return 'run';
    if (['provisional', 'ipe', 'provisionalipe', 'identificacionprovisional', 'identificacionprovisionalipe', 'provisionalidentification', 'identificadorprovisorioescolar', 'ipeidentificadorprovisorioescolar'].includes(type)) return 'ipe';
    return '';
  }

  function identificationKey(type, value) {
    if (type === 'run') return `run:${cleanRun(value)}`;
    if (type === 'ipe') return `ipe:${String(value ?? '').trim()}`;
    return '';
  }

  function migrateStudent(record, legacyKey = '') {
    const identificationType = record.identificationType === 'provisional' ? 'ipe' : (record.identificationType || 'run');
    const identificationValue = String(record.identificationValue ?? record.run ?? legacyKey).trim();
    return { ...record, identificationType, identificationValue, run: identificationType === 'run' ? identificationValue : '' };
  }

  function parseSexo(v) {
    const n = norm(v);
    if (['1', 'm', 'masculino', 'hombre', 'h', 'varon'].includes(n)) return '1';
    if (['2', 'f', 'femenino', 'mujer'].includes(n)) return '2';
    return '';
  }

  function isoDate(y, m, d) {
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function parseDate(v) {
    if (typeof v === 'number' && window.XLSX) {
      const p = XLSX.SSF.parse_date_code(v);
      return p ? isoDate(p.y, p.m, p.d) : '';
    }
    const s = text(v);
    let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
    m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
    if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    return '';
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

  /* ---------- lectura del Excel ---------- */

  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) {
      xlsxPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = XLSX_SRC;
        s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('xlsx')));
        s.onerror = () => {
          xlsxPromise = null;
          reject(userError('No se pudo cargar el lector de Excel. Recargue la página e intente de nuevo.'));
        };
        document.head.appendChild(s);
      });
    }
    return xlsxPromise;
  }

  function columnFor(header) {
    const h = norm(header);
    if (!h) return null;
    return COLUMNS.find((c) => norm(c.header) === h || c.aliases.some((a) => norm(a) === h)) || null;
  }

  function parseWorkbook(X, buffer, filename) {
    // raw: no interpretar textos de CSV (evita fechas en formato de EE. UU.)
    const options = { type: 'array', raw: true };
    if (/\.csv$/i.test(filename)) {
      // Keep legacy Windows-1252 CSV compatible while supporting accented UTF-8 headers.
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer));
        options.codepage = 65001;
      } catch (_) { /* Use the reader's existing encoding fallback. */ }
    }
    const wb = X.read(buffer, options);
    const sheetName = wb.SheetNames.find((n) => norm(n) === norm(SHEET_NAME)) || wb.SheetNames[0];
    const ws = sheetName && wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) throw userError('El archivo no tiene datos.');

    const firstRow = X.utils.decode_range(ws['!ref']).s.r + 1;
    const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });

    const headerIdx = rows.slice(0, 20).findIndex(row => row.some(cell => ['run', 'identificationValue'].includes(columnFor(cell)?.name)));
    if (headerIdx < 0) throw userError('No se encontró una columna «RUN» o «Identificación». Use la plantilla.');

    const map = [];
    rows[headerIdx].forEach((cell, i) => {
      const col = columnFor(cell);
      if (col && !map.some((m) => m.col === col)) map.push({ col, i });
    });

    const students = {};
    const errors = [];
    let duplicates = 0;

    rows.slice(headerIdx + 1).forEach((row, k) => {
      if (!row.some((cell) => text(cell))) return;
      const rowNum = firstRow + headerIdx + 1 + k;
      const rec = {};
      map.forEach(({ col, i }) => {
        const v = row[i];
        let out = col.parse ? col.parse(v) : ['run', 'identificationValue'].includes(col.name) ? String(v ?? '').trim() : text(v);
        if (col.max) out = out.slice(0, col.max);
        rec[col.name] = out;
      });

      const type = parseIdentificationType(rec.identificationType);
      const rawId = rec.identificationValue || rec.run || '';
      if (!type) return errors.push({ row: rowNum, msg: 'Tipo de identificación no reconocido; use RUN o IPE' });
      if (rec.identificationValue && rec.run && (type === 'run' ? cleanRun(rec.identificationValue) !== cleanRun(rec.run) : rec.identificationValue !== rec.run)) {
        return errors.push({ row: rowNum, msg: 'las columnas RUN e Identificación contienen valores distintos' });
      }
      if (type === 'run') {
        const run = cleanRun(rawId);
        if (!run) return errors.push({ row: rowNum, msg: 'falta el RUN' });
        if (!validRun(run)) return errors.push({ row: rowNum, msg: 'RUN inválido («{run}»)', params: { run: rawId } });
        rec.identificationValue = formatRun(run);
      } else {
        if (!validIpe(rawId)) return errors.push({ row: rowNum, msg: 'IPE inválido: ingrese entre 1 y 30 dígitos, sin puntos ni guion' });
        rec.identificationValue = rawId.trim();
      }
      if (!rec.apPaterno && !rec.nombres) return errors.push({ row: rowNum, msg: 'faltan el apellido y los nombres' });

      rec.identificationType = type;
      rec.run = type === 'run' ? rec.identificationValue : '';
      const key = identificationKey(type, rec.identificationValue);
      if (students[key]) duplicates++;
      students[key] = rec;
    });

    return { students, errors, duplicates };
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
    const generation = clearGeneration;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      showResult('bad', 'Formato no admitido', ['Use un archivo .xlsx, .xls o .csv (puede partir de la plantilla).']);
      return;
    }
    showResult('busy', message('Leyendo «{file}»…', { file: file.name }));

    let parsed;
    try {
      const X = await loadXlsx();
      const buffer = await file.arrayBuffer();
      if (generation !== clearGeneration) return;
      parsed = parseWorkbook(X, buffer, file.name);
    } catch (e) {
      if (generation !== clearGeneration) return;
      showResult('bad', 'No se pudo leer el archivo', [e.userMessage || 'Verifique que sea un Excel válido y que no esté protegido con contraseña.']);
      return;
    }

    const details = [];
    if (parsed.duplicates) details.push(message('{count} identificación(es) repetida(s) del mismo tipo: se usó la última fila.', { count: parsed.duplicates }));
    parsed.errors.slice(0, MAX_ERRORS_SHOWN).forEach(e => details.push(() => tr('Fila {row}: {message}.', { row: e.row, message: tr(e.msg, e.params) })));
    if (parsed.errors.length > MAX_ERRORS_SHOWN) details.push(message('… y {count} fila(s) más con errores.', { count: parsed.errors.length - MAX_ERRORS_SHOWN }));

    const count = Object.keys(parsed.students).length;
    if (!count) {
      showResult('bad', 'No se cargó ningún estudiante', details.length ? details : ['La hoja no tiene filas con datos bajo los encabezados.']);
      return;
    }

    try {
      saveDb({ schema: 2, fileName: file.name, loadedAt: Date.now(), students: parsed.students });
    } catch (e) {
      showResult('bad', 'No se pudo guardar la base', [e.userMessage]);
      return;
    }

    search.value = '';
    renderBase();
    const title = () => tr('{count} estudiantes cargados', { count }) + (parsed.errors.length ? tr(' · {count} fila(s) omitida(s)', { count: parsed.errors.length }) : '');
    showResult(parsed.errors.length ? 'warn' : 'ok', title, details);
  }

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
  });
  $('#stuClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- interfaz pública ---------- */

  window.DAEStudents = {
    identification: { validIpe, key: identificationKey, ipeMaxLength: IPE_MAX_LENGTH },
    clearLocalData() {
      clearGeneration++;
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
      result.hidden = true;
      search.value = '';
      renderBase();
      dialog.showModal();
      loadXlsx().catch(() => {});
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
