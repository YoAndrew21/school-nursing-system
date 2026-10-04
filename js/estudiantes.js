/*
 * Carga masiva de estudiantes: lectura del Excel y base guardada en el
 * navegador (localStorage) para completar el formulario a partir del RUN.
 * El lector de Excel se carga solo al abrir esta ventana. La plantilla con
 * formato es un archivo fijo (plantillas/), generado con tools/generar-plantilla.js.
 */
(function () {
  'use strict';

  // Translation helper. Falls back to the original Spanish string if i18n is unavailable.
  const tr = (text) => window.I18N?.t?.(text) ?? text;

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
      return data && data.students && Object.keys(data.students).length ? data : null;
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

  function parseWorkbook(X, buffer) {
    // raw: no interpretar textos de CSV (evita fechas en formato de EE. UU.)
    const wb = X.read(buffer, { type: 'array', raw: true });
    const sheetName = wb.SheetNames.find((n) => norm(n) === norm(SHEET_NAME)) || wb.SheetNames[0];
    const ws = sheetName && wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) throw userError('El archivo no tiene datos.');

    const firstRow = X.utils.decode_range(ws['!ref']).s.r + 1;
    const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });

    const headerIdx = rows.slice(0, 20).findIndex((row) => row.some((cell) => columnFor(cell) === COLUMNS[0]));
    if (headerIdx < 0) throw userError('No se encontró la columna «RUN». Use la plantilla y no cambie los nombres de las columnas.');

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
        let out = col.parse ? col.parse(v) : text(v);
        if (col.max) out = out.slice(0, col.max);
        rec[col.name] = out;
      });

      const rawRun = text(row[map.find((m) => m.col === COLUMNS[0]).i]);
      const run = cleanRun(rawRun);
      if (!run) return errors.push({ row: rowNum, msg: 'falta el RUN' });
      if (!validRun(run)) return errors.push({ row: rowNum, msg: `RUN inválido («${rawRun}»)` });
      if (!rec.apPaterno && !rec.nombres) return errors.push({ row: rowNum, msg: 'faltan el apellido y los nombres' });

      rec.run = formatRun(run);
      if (students[run]) duplicates++;
      students[run] = rec;
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

  function showResult(kind, title, details = []) {
    result.hidden = false;
    result.className = `stu-result is-${kind}`;
    result.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = title;
    result.appendChild(strong);
    if (details.length) {
      const ul = document.createElement('ul');
      details.forEach((d) => {
        const li = document.createElement('li');
        li.textContent = d;
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
    $('#stuMeta').textContent = `${list.length} estudiantes · «${db.fileName}» · cargado el ${formatStamp(db.loadedAt)}`;

    const q = norm(search.value);
    const matches = list
      .filter((s) => !q || norm(`${s.run} ${s.apPaterno} ${s.apMaterno} ${s.nombres} ${s.curso}`).includes(q) || norm(`${s.nombres} ${s.apPaterno} ${s.apMaterno}`).includes(q))
      .sort((a, b) => `${a.apPaterno} ${a.apMaterno} ${a.nombres}`.localeCompare(`${b.apPaterno} ${b.apMaterno} ${b.nombres}`, 'es'));

    const tbody = $('#stuRows');
    tbody.replaceChildren();
    matches.slice(0, TABLE_LIMIT).forEach((s) => {
      const tr = document.createElement('tr');
      [s.run, [s.apPaterno, s.apMaterno].filter(Boolean).join(' ') + (s.nombres ? `, ${s.nombres}` : ''), s.curso || '—'].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const note = $('#stuTableNote');
    if (!matches.length) note.textContent = tr('Sin resultados para la búsqueda.');
    else if (matches.length > TABLE_LIMIT) note.textContent = `Mostrando ${TABLE_LIMIT} de ${matches.length}. Use la búsqueda para encontrar a un estudiante.`;
    else note.textContent = '';
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      showResult('bad', tr('Formato no admitido'), ['Use un archivo .xlsx, .xls o .csv (puede partir de la plantilla).']);
      return;
    }
    showResult('busy', `Leyendo «${file.name}»…`);

    let parsed;
    try {
      const X = await loadXlsx();
      parsed = parseWorkbook(X, await file.arrayBuffer());
    } catch (e) {
      showResult('bad', tr('No se pudo leer el archivo'), [e.userMessage || 'Verifique que sea un Excel válido y que no esté protegido con contraseña.']);
      return;
    }

    const details = [];
    if (parsed.duplicates) details.push(`${parsed.duplicates} RUN repetido(s): se usó la última fila.`);
    parsed.errors.slice(0, MAX_ERRORS_SHOWN).forEach((e) => details.push(`Fila ${e.row}: ${e.msg}.`));
    if (parsed.errors.length > MAX_ERRORS_SHOWN) details.push(`… y ${parsed.errors.length - MAX_ERRORS_SHOWN} fila(s) más con errores.`);

    const count = Object.keys(parsed.students).length;
    if (!count) {
      showResult('bad', tr('No se cargó ningún estudiante'), details.length ? details : ['La hoja no tiene filas con datos bajo los encabezados.']);
      return;
    }

    try {
      saveDb({ fileName: file.name, loadedAt: Date.now(), students: parsed.students });
    } catch (e) {
      showResult('bad', tr('No se pudo guardar la base'), [e.userMessage]);
      return;
    }

    search.value = '';
    renderBase();
    const skipped = parsed.errors.length ? ` · ${parsed.errors.length} fila(s) omitida(s)` : '';
    showResult(parsed.errors.length ? 'warn' : 'ok', `${count} estudiantes cargados${skipped}`, details);
  }

  let deleteTimer;
  function resetDelete() {
    clearTimeout(deleteTimer);
    deleteBtn.classList.remove('is-confirm');
    deleteBtn.lastChild.textContent = ' Eliminar base';
  }

  deleteBtn.addEventListener('click', () => {
    if (!deleteBtn.classList.contains('is-confirm')) {
      deleteBtn.classList.add('is-confirm');
      deleteBtn.lastChild.textContent = ' ¿Eliminar? Confirmar';
      deleteTimer = setTimeout(resetDelete, 4000);
      return;
    }
    saveDb(null);
    renderBase();
    showResult('ok', tr('Base de estudiantes eliminada'), ['El autocompletado por RUN queda desactivado hasta cargar otro Excel.']);
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
  document.addEventListener('languagechange', renderBase);
  $('#stuClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- interfaz pública ---------- */

  window.DAEStudents = {
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
    find(run) {
      if (!db) return null;
      const rec = db.students[cleanRun(run)];
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
