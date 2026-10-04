/*
 * Lógica de la interfaz: estado del formulario, validación, guardado local,
 * firma en pantalla, vista previa y descarga del PDF.
 */
(function () {
  'use strict';

  // Translation helper. Falls back to the original Spanish string if i18n is unavailable.
  const tr = (text, params) => window.I18N?.t?.(text, params) ?? text;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = 'dae-enfermeria:v1';
  const form = $('#daeForm');

  const DEFAULTS = {
    identificationType: 'run',
    tipoEst: '2',
    estNombre: 'Colegio San Maximiliano Kolbe',
    estProvincia: 'Llanquihue',
    estComuna: 'Puerto Montt',
  };

  // Borradores guardados con una versión anterior (schema distinto) toman el
  // nombre actual del establecimiento al recuperarse
  const DRAFT_SCHEMA = 2;

  // Datos que se conservan al comenzar un formulario nuevo
  const KEEP_ON_RESET = ['tipoEst', 'estNombre', 'estProvincia', 'estComuna', 'horario'];
  // Se conservan solo si está marcada la opción «Mantener la firma…»
  const SIGNATURE_FIELDS = ['rectorNombre', 'firma'];
  const PREFS_KEY = 'dae-enfermeria:prefs';

  const REQUIRED = [
    { name: 'curso', label: 'Curso', section: 'sec-a' },
    { name: 'apPaterno', label: 'Apellido paterno', section: 'sec-b' },
    { name: 'nombres', label: 'Nombres', section: 'sec-b' },
    { name: 'identificationValue', label: 'Identificación del estudiante', section: 'sec-b', check: (value, data) => validIdentification(data.identificationType, value) },
    { name: 'sexo', label: 'Sexo', section: 'sec-b' },
    { name: 'fechaAcc', label: 'Fecha del accidente', section: 'sec-c' },
    { name: 'horaAcc', label: 'Hora del accidente', section: 'sec-c' },
    { name: 'tipoAcc', label: 'Tipo de accidente', section: 'sec-c' },
    { name: 'circunstancia', label: 'Circunstancia del accidente', section: 'sec-e' },
  ];

  // Campos que se completan desde la base de estudiantes (carga masiva)
  const STUDENT_FIELDS = ['identificationType', 'identificationValue', 'apPaterno', 'apMaterno', 'nombres', 'sexo', 'fechaNac', 'curso', 'horario', 'calle', 'numero', 'poblacion', 'resComuna', 'resProvincia', 'codifCom'];

  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const touched = new Set();
  let showAllErrors = false;

  /* ---------- utilidades ---------- */

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function debounce(fn, ms) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = () => {
      clearTimeout(t);
      fn();
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  function cleanRun(v) {
    return String(v || '').replace(/[^0-9kK]/g, '').toUpperCase();
  }

  function validRun(v) {
    const c = cleanRun(v);
    if (c.length < 2) return false;
    const body = c.slice(0, -1);
    const dv = c.slice(-1);
    if (!/^\d{1,8}$/.test(body)) return false;
    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const r = 11 - (sum % 11);
    const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
    return dv === expected;
  }

  function formatRun(v) {
    const c = cleanRun(v);
    if (c.length < 2) return String(v || '').trim();
    const body = c.slice(0, -1).replace(/^0+(?=\d)/, '');
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
  }

  function validIdentification(type, value) {
    if (type === 'run') return validRun(value);
    if (type === 'ipe') return DAEStudents.identification.validIpe(value);
    return false;
  }

  function renderIdentification() {
    const provisional = $('#identificationType').value === 'ipe';
    const input = $('#run');
    input.maxLength = provisional ? DAEStudents.identification.ipeMaxLength : 12;
    input.placeholder = provisional ? tr('Ejemplo ficticio: 123456789') : '12.345.678-9';
    input.setAttribute('autocapitalize', provisional ? 'none' : 'characters');
    input.setAttribute('inputmode', provisional ? 'numeric' : 'text');
    $('#identificationLabel').textContent = tr(provisional ? 'IPE — Identificador Provisorio Escolar' : 'R.U.N. del alumno');
    $('#identificationPolicy').textContent = tr(provisional
      ? 'Ingrese entre 1 y 30 dígitos, sin puntos ni guion. El límite es técnico, no un formato oficial de IPE. No se verifica el dígito de RUN.'
      : 'Ingrese un RUN válido (revise el dígito verificador).');
    $('#provisionalPdfNotice').hidden = !provisional;
    fieldEl('identificationValue').querySelector('.field-error').textContent = tr(provisional
      ? 'IPE inválido: ingrese entre 1 y 30 dígitos, sin puntos ni guion.'
      : 'Ingrese un RUN válido (revise el dígito verificador).');
  }

  function computeAge(birth, ref) {
    const b = parseCalendarDate(birth);
    const r = parseCalendarDate(ref || todayISO());
    if (!b || !r || birth > todayISO() || (ref && ref > todayISO()) || birth > (ref || todayISO())) return '';
    let age = Number(r.y) - Number(b.y);
    if (Number(r.m) < Number(b.m) || (Number(r.m) === Number(b.m) && Number(r.d) < Number(b.d))) age--;
    return age >= 0 && age < 100 ? String(age) : '';
  }

  function fileName(d) {
    const slug = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    const parts = ['Accidente_Escolar', slug(d.apPaterno), slug((d.nombres || '').split(/\s+/)[0]), d.fechaAcc || todayISO()];
    return parts.filter(Boolean).join('_') + '.pdf';
  }

  /* ---------- lectura / escritura del formulario ---------- */

  function getData() {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'radio') {
        if (!(el.name in data)) data[el.name] = '';
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    });
    data.firma = signature.value();
    // Keep the legacy RUN property for existing PDF callers; IPE is never a RUN.
    data.run = data.identificationType === 'run' ? data.identificationValue : '';
    return data;
  }

  function setData(data) {
    data = { ...data };
    if (data.identificationType === 'provisional') data.identificationType = 'ipe';
    if ('run' in data && !('identificationValue' in data)) data.identificationValue = data.run;
    if ('run' in data && !('identificationType' in data)) data.identificationType = 'run';
    if ('identificationType' in data) $('#identificationType').value = data.identificationType;
    renderIdentification();
    Array.from(form.elements).forEach((el) => {
      if (!el.name || !(el.name in data)) return;
      if (el.type === 'radio') el.checked = el.value === data[el.name];
      else el.value = data[el.name] == null ? '' : data[el.name];
    });
    if ('firma' in data) signature.setValue(data.firma || '');
  }

  /* ---------- guardado local ---------- */

  const saveStatus = $('#saveStatus');
  const saveText = $('.save-text', saveStatus);
  let saveMessage = 'Borrador local';
  let saveParams = {};
  let saveTitle = '';
  let localDataCleared = false;
  function renderSaveStatus() {
    saveText.textContent = tr(saveMessage, saveParams);
    saveStatus.title = tr(saveTitle);
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  const save = debounce(() => {
    if (localDataCleared) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(getData(), { schema: DRAFT_SCHEMA })));
      const t = new Date();
      saveMessage = 'Guardado {time}';
      saveParams = { time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` };
      saveTitle = 'Borrador guardado en este navegador';
    } catch (e) {
      saveMessage = 'Sin guardado local';
      saveTitle = 'El navegador no permite guardar el borrador';
    }
    saveStatus.classList.remove('is-saving');
    renderSaveStatus();
  }, 500);

  function markDirty() {
    if (localDataCleared) return;
    saveStatus.classList.add('is-saving');
    saveMessage = 'Guardando…';
    renderSaveStatus();
    save();
  }

  /* ---------- validación y progreso ---------- */

  // Validate calendar components without JavaScript Date rollover or timezone conversion.
  function parseCalendarDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const [y, m, d] = match.slice(1).map(Number);
    if (y < 1 || m < 1 || m > 12) return null;
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d >= 1 && d <= days[m - 1] ? { y, m, d } : null;
  }

  const DATE_FIELDS = [
    { name: 'fechaRegistro', label: 'Fecha de registro de los datos', section: 'sec-a' },
    { name: 'fechaNac', label: 'Fecha de nacimiento', section: 'sec-b' },
    { name: 'fechaAcc', label: 'Fecha del accidente', section: 'sec-c' },
    { name: 'fechaCierre', label: 'Fecha de cierre del caso', section: 'sec-d' },
  ];

  function dateError(name, data) {
    if (!DATE_FIELDS.some(field => field.name === name)) return '';
    const el = form.elements.namedItem(name);
    const value = data[name];
    if (el?.validity?.badInput || (value && !parseCalendarDate(value))) return 'Ingrese una fecha válida.';
    if (!value) return '';
    if (name === 'fechaAcc' && value > todayISO()) return 'La fecha del accidente no puede ser futura.';
    if (name === 'fechaNac' && value > todayISO()) return 'La fecha de nacimiento no puede ser futura.';
    if (name === 'fechaNac' && parseCalendarDate(data.fechaAcc) && value > data.fechaAcc) return 'La fecha de nacimiento no puede ser posterior al accidente.';
    return '';
  }

  function isFilled(req, data) {
    const v = String(data[req.name] || '').trim();
    if (!v) return false;
    return req.check ? req.check(v, data) : true;
  }

  function fieldEl(name) {
    const input = form.querySelector(`[name="${name}"]`);
    return input ? input.closest('.field') : null;
  }

  function renderValidation(data) {
    let done = 0;
    const perSection = {};

    REQUIRED.forEach((req) => {
      const ok = isFilled(req, data) && !dateError(req.name, data);
      if (ok) done++;
      perSection[req.section] = (perSection[req.section] !== false) && ok;
      const field = fieldEl(req.name);
      if (field) setFieldValidation(req.name, field, !ok && (showAllErrors || touched.has(req.name)));
    });

    const invalidDates = DATE_FIELDS.filter(req => dateError(req.name, data));
    DATE_FIELDS.forEach(req => {
      const field = fieldEl(req.name);
      const message = dateError(req.name, data);
      const error = field.querySelector('.field-error');
      if (req.name === 'fechaAcc') error.textContent = tr(message || 'Indique la fecha.');
      else error.textContent = tr(message);
      const showError = showAllErrors || touched.has(req.name);
      setFieldValidation(req.name, field, showError && (!!message || (req.name === 'fechaAcc' && !data.fechaAcc)));
      if (message) perSection[req.section] = false;
    });

    $('#progressText').textContent = tr('{done} de {total}', { done, total: REQUIRED.length });
    $('#progressBar').style.width = `${(done / REQUIRED.length) * 100}%`;
    $('.progress-box').classList.toggle('is-complete', done === REQUIRED.length && !invalidDates.length);

    $$('.steps a').forEach((a) => {
      const id = a.dataset.step;
      a.classList.toggle('is-done', id in perSection && perSection[id]);
    });

    const missing = REQUIRED.filter(req => !isFilled(req, data));
    return missing.concat(invalidDates.filter(req => !missing.some(item => item.name === req.name)));
  }

  function setFieldValidation(name, field, invalid) {
    field.classList.toggle('is-invalid', !!invalid);
    const error = field.querySelector('.field-error');
    if (error) error.id = `${name}Error`;
    $$(`[name="${name}"]`, form).forEach(input => {
      input.setAttribute('aria-invalid', String(!!invalid));
      const ids = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      if (error) ids.add(error.id);
      field.querySelectorAll('.hint[id]').forEach(hint => ids.add(hint.id));
      if (ids.size) input.setAttribute('aria-describedby', [...ids].join(' '));
    });
  }

  /* ---------- campos derivados ---------- */

  function renderDerived(data) {
    const wd = parseCalendarDate(data.fechaAcc) ? DAE.weekdayIndex(data.fechaAcc) : '';
    $('#weekdayOut').textContent = wd ? tr('{day} · código {code}', { day: tr(DIAS[Number(wd) - 1]), code: wd }) : '—';

    const nac = parseCalendarDate(data.fechaNac);
    $('#anioNacHint').textContent = nac ? tr('Año de nacimiento en el PDF: {year}', { year: nac.y }) : tr('En el PDF se imprime solo el año.');

    $('#witnesses').classList.toggle('is-highlight', data.tipoAcc === '1');
  }

  const renderCircMeter = debounce(() => {
    const text = $('#circunstancia').value;
    $('#circCount').textContent = `${text.length} / 700`;
    const badge = $('#circFit');
    if (!text.trim()) {
      badge.hidden = true;
      return;
    }
    let fit;
    try {
      fit = DAE.fitCircunstancia(text);
    } catch (e) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.className = 'fit-badge';
    if (fit.mode === 'normal') {
      badge.textContent = tr('Cabe en tamaño normal');
    } else if (fit.mode === 'reducido') {
      badge.textContent = tr('Se imprimirá con letra reducida ({size} pt)', { size: fit.size });
      badge.classList.add('is-warn');
    } else {
      badge.textContent = tr('Demasiado largo: se recortará en el PDF');
      badge.classList.add('is-bad');
    }
  }, 150);

  /* ---------- actualización general ---------- */

  function refresh() {
    const data = getData();
    renderDerived(data);
    renderValidation(data);
    markDirty();
    preview.schedule();
  }

  form.addEventListener('input', (e) => {
    localDataCleared = false;
    const el = e.target;
    if (el.matches('[data-digits]')) {
      const clean = el.value.replace(/\D/g, '');
      if (clean !== el.value) el.value = clean;
    }
    if (el.name === 'identificationType') {
      $('#run').value = '';
      lookupKey = '';
      lookupState = '';
      renderIdentification();
      renderRunLookup();
    }
    if (el.matches('[data-run]') || (el.id === 'run' && $('#identificationType').value === 'run')) {
      const clean = el.value.replace(/[^0-9kK.\-]/g, '');
      if (clean !== el.value) el.value = clean;
    }
    if (el.name === 'fechaNac' || el.name === 'fechaAcc') {
      const age = computeAge($('#fechaNac').value, $('#fechaAcc').value);
      $('#edad').value = age;
    }
    if (el.name === 'circunstancia') renderCircMeter();
    if (el.type === 'radio') touched.add(el.name);
    // Con guion y dígito verificador el RUN está completo; sin guion se busca al salir del campo
    if (el.id === 'run') {
      if ($('#identificationType').value === 'run' && /-\s*[0-9kK]$/.test(el.value) && lookupStudent()) return;
      renderRunLookup();
    }
    refresh();
  });

  form.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el.name) return;
    if (el.value.trim() && (el.matches('[data-run]') || (el.id === 'run' && $('#identificationType').value === 'run'))) el.value = formatRun(el.value);
    else if (el.id === 'run') el.value = el.value.trim();
    if (el.type !== 'radio') touched.add(el.name);
    if (el.id === 'run' && lookupStudent()) return;
    refresh();
  });

  $('#run').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupStudent();
  });

  /* ---------- base de estudiantes: autocompletado por RUN ---------- */

  let lookupKey = ''; // Typed identity last looked up; protects edited auto-filled values.
  let lookupState = '';

  function renderRunLookup() {
    const info = DAEStudents.info();
    const box = $('#runLookup');
    const current = DAEStudents.identification.key($('#identificationType').value, $('#run').value);
    const state = $('#run').value.trim() && current === lookupKey ? lookupState : '';
    box.className = 'hint run-lookup' + (state ? ` is-${state}` : '');
    let msg;
    if (!info) msg = tr('Sin base de estudiantes: cargue un archivo para completar los datos con su identificación.');
    else if (state === 'found') msg = tr('✓ Datos completados desde la base de estudiantes.');
    else if (state === 'missing') msg = tr('Identificación no encontrada en la base de estudiantes para el tipo seleccionado.');
    else msg = tr('Base de {count} estudiantes: seleccione el tipo e ingrese la identificación para completar sus datos.', { count: info.count });
    $('#runLookupText').textContent = msg;
  }

  // Devuelve true si completó el formulario (ya actualizado)
  function lookupStudent() {
    const type = $('#identificationType').value;
    const value = $('#run').value.trim();
    const key = DAEStudents.identification.key(type, value);
    if (key !== lookupKey) {
      lookupKey = '';
      lookupState = '';
    }
    if (!DAEStudents.info() || !validIdentification(type, value) || key === lookupKey) {
      renderRunLookup();
      return false;
    }
    lookupKey = key;
    const student = DAEStudents.find(value, type);
    lookupState = student ? 'found' : 'missing';
    renderRunLookup();
    if (!student) return false;

    const next = {};
    STUDENT_FIELDS.forEach((k) => {
      next[k] = student[k] || '';
    });
    if (!next.horario) delete next.horario; // el horario se conserva entre formularios
    next.identificationValue = type === 'run' ? formatRun(value) : value;
    next.edad = computeAge(next.fechaNac, $('#fechaAcc').value);
    setData(next);
    STUDENT_FIELDS.forEach((k) => touched.add(k));
    refresh();
    renderRunLookup();
    const name = [student.nombres, student.apPaterno].filter(Boolean).join(' ');
    toast('Datos de {name} cargados desde la base de estudiantes.', { name: name || next.identificationValue });
    return true;
  }

  DAEStudents.onChange(() => {
    lookupKey = '';
    lookupState = '';
    renderRunLookup();
  });

  form.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- firma en pantalla ---------- */

  const signature = (function createSignaturePad() {
    const canvas = $('#sigCanvas');
    const ctx = canvas.getContext('2d');
    const placeholder = $('#sigPlaceholder');
    const INK = '#1b2f7a';
    let value = '';
    let drawing = false;
    let last = null;
    let lastMid = null;
    let paintToken = 0;
    let onChange = () => {};

    function cssSize() {
      const r = canvas.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }

    function setup() {
      const { w, h } = cssSize();
      if (!w || !h) return;
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width === pw && canvas.height === ph) return;
      canvas.width = pw;
      canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    }

    function paint() {
      const token = ++paintToken;
      const { w, h } = cssSize();
      ctx.clearRect(0, 0, w, h);
      placeholder.hidden = !!value;
      if (!value) return;
      const img = new Image();
      img.onload = () => {
        if (token !== paintToken) return;
        const padX = 20;
        const boxW = w - padX * 2;
        const boxH = h - 52;
        const k = Math.min(boxW / img.width, boxH / img.height, 1);
        const dw = img.width * k;
        const dh = img.height * k;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, (w - dw) / 2, h - 30 - dh, dw, dh);
      };
      img.src = value;
    }

    // Recorta la imagen al área con trazos (para que escale bien en el PDF)
    function trimmed(source) {
      const sw = source.width;
      const sh = source.height;
      if (!sw || !sh) return '';
      const px = source.getContext('2d').getImageData(0, 0, sw, sh).data;
      let minX = sw;
      let minY = sh;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (px[(y * sw + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return '';
      const pad = 4;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(sw - 1, maxX + pad);
      maxY = Math.min(sh - 1, maxY + pad);
      const out = document.createElement('canvas');
      out.width = maxX - minX + 1;
      out.height = maxY - minY + 1;
      out.getContext('2d').drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }

    function commit() {
      value = trimmed(canvas);
      placeholder.hidden = !!value;
      onChange(value);
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function lineWidth(e) {
      return e.pointerType === 'pen' && e.pressure ? 1.2 + e.pressure * 2.6 : 2.4;
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      setup();
      paintToken++; // cancela un repintado pendiente
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      last = pos(e);
      lastMid = last;
      placeholder.hidden = true;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(last.x, last.y, lineWidth(e) / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      (events.length ? events : [e]).forEach((ev) => {
        const p = pos(ev);
        const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        ctx.lineWidth = lineWidth(ev);
        ctx.beginPath();
        ctx.moveTo(lastMid.x, lastMid.y);
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        ctx.stroke();
        last = p;
        lastMid = mid;
      });
    });

    function end() {
      if (!drawing) return;
      drawing = false;
      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      commit();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);

    function loadFile(file) {
      if (!file) return;
      if (!/^image\/(png|jpeg)$/.test(file.type)) {
        toast('Use una imagen PNG o JPG.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1200 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k));
          c.height = Math.max(1, Math.round(img.height * k));
          const cx = c.getContext('2d');
          cx.drawImage(img, 0, 0, c.width, c.height);
          // Quita el fondo blanco (escaneos / fotos de papel)
          const id = cx.getImageData(0, 0, c.width, c.height);
          const px = id.data;
          for (let i = 0; i < px.length; i += 4) {
            const m = Math.min(px[i], px[i + 1], px[i + 2]);
            if (m > 225) px[i + 3] = 0;
            else if (m > 190) px[i + 3] = Math.round((px[i + 3] * (225 - m)) / 35);
          }
          cx.putImageData(id, 0, 0);
          value = trimmed(c);
          if (!value) toast('La imagen parece estar en blanco.');
          paint();
          onChange(value);
        };
        img.onerror = () => toast('No se pudo leer la imagen.');
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    $('#sigUpload').addEventListener('click', () => $('#sigFile').click());
    $('#sigFile').addEventListener('change', (e) => {
      loadFile(e.target.files[0]);
      e.target.value = '';
    });
    $('#sigClear').addEventListener('click', () => {
      value = '';
      paint();
      onChange(value);
    });

    window.addEventListener('resize', debounce(setup, 150));
    if ('ResizeObserver' in window) new ResizeObserver(debounce(setup, 100)).observe(canvas);
    setup();

    return {
      value: () => value,
      setValue(v) {
        value = v || '';
        setup();
        paint();
      },
      onChange(fn) {
        onChange = fn;
      },
    };
  })();

  signature.onChange(() => { localDataCleared = false; refresh(); });

  /* ---------- PDF: vista previa y descarga ---------- */

  function buildDoc(data) {
    const values = data || getData();
    if (DATE_FIELDS.some(req => dateError(req.name, values))) return null;
    try {
      return DAE.buildPdf(values);
    } catch (e) {
      console.error(e);
      toast('No se pudo generar el PDF. Recargue la página e intente de nuevo.');
      return null;
    }
  }

  const preview = (function () {
    const mq = window.matchMedia('only screen and (min-width: 1367px)');
    const frames = $$('#previewFrame iframe');
    const empty = $('#previewEmpty');
    const state = $('#previewState');
    const live = $('#livePreview');
    const canEmbed = navigator.pdfViewerEnabled !== false;
    const urls = [null, null];
    let front = 0;
    let timer = null;

    function render() {
      clearTimeout(timer);
      const doc = buildDoc();
      if (!doc) return;
      const url = URL.createObjectURL(doc.output('blob'));
      const back = 1 - front;
      const frame = frames[back];
      if (urls[back]) URL.revokeObjectURL(urls[back]);
      urls[back] = url;
      let swapped = false;
      const swap = () => {
        if (swapped || urls[back] !== url) return;
        swapped = true;
        frames[back].classList.add('is-front');
        frames[front].classList.remove('is-front');
        front = back;
        const t = new Date();
        state.textContent = `${tr('Actualizada')} ${t.toLocaleTimeString(window.I18N?.language === 'en' ? 'en-GB' : window.I18N?.language === 'ja' ? 'ja-JP' : 'es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
      };
      frame.onload = swap;
      setTimeout(swap, 1500);
      frame.src = url + '#toolbar=0&navpanes=0&view=FitH';
    }

    function syncState() {
      if (!canEmbed) {
        empty.hidden = false;
        empty.textContent = tr('Este navegador no puede mostrar el PDF dentro de la página. Use «Descargar PDF» para revisarlo.');
        state.textContent = tr('No disponible');
        live.disabled = true;
        return;
      }
      empty.hidden = live.checked;
      state.textContent = live.checked ? tr('Se actualiza mientras escribe') : tr('En pausa');
      if (live.checked && mq.matches) render();
    }

    live.addEventListener('change', syncState);
    mq.addEventListener('change', () => {
      if (mq.matches) syncState();
    });

    return {
      init: syncState,
      clear() {
        clearTimeout(timer);
        frames.forEach((frame, i) => {
          frame.onload = null;
          frame.removeAttribute('src');
          frame.classList.remove('is-front');
          if (urls[i]) URL.revokeObjectURL(urls[i]);
          urls[i] = null;
        });
        empty.hidden = false;
        state.textContent = tr('En pausa');
      },
      schedule() {
        if (!canEmbed || !live.checked || !mq.matches) return;
        clearTimeout(timer);
        state.textContent = tr('Actualizando…');
        timer = setTimeout(render, 700);
      },
    };
  })();

  function openPreview() {
    if (DATE_FIELDS.some(req => dateError(req.name, getData()))) {
      showAllErrors = true;
      renderValidation(getData());
      toast('Hay fechas inválidas');
      return;
    }
    const win = window.open('', '_blank');
    const doc = buildDoc();
    if (!doc) {
      if (win) win.close();
      return;
    }
    const url = URL.createObjectURL(doc.output('blob'));
    if (win) {
      win.location.href = url;
    } else {
      toast('El navegador bloqueó la ventana emergente. Use «Descargar PDF».');
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  async function download() {
    const data = getData();
    showAllErrors = true;
    const missing = renderValidation(data);
    if (missing.length) {
      const hasInvalidDates = DATE_FIELDS.some(req => dateError(req.name, data));
      const choice = await ask({
        title: hasInvalidDates ? 'Hay fechas inválidas' : 'Faltan datos obligatorios',
        html: () => `<p>${tr('Complete estos campos antes de generar la declaración:')}</p><ul>${missing.map(m => `<li>${tr(m.label)}${dateError(m.name, data) ? ': ' + tr(dateError(m.name, data)) : ''}</li>`).join('')}</ul>`,
        primary: hasInvalidDates ? 'Corregir fechas' : 'Completar datos',
        secondary: hasInvalidDates ? 'Cancelar' : 'Descargar de todos modos',
      });
      if (hasInvalidDates || choice !== 'secondary') {
        if (choice === 'primary') focusField(missing[0].name);
        return;
      }
    }
    const doc = buildDoc(data);
    if (!doc) return;
    doc.save(fileName(data));
    toast('PDF generado y descargado.');
  }

  function focusField(name) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    const details = input.closest('details');
    if (details) details.open = true;
    const field = input.closest('.field') || input;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus({ preventScroll: true }), 350);
  }

  async function resetForm() {
    const keepSignature = $('#keepSignature').checked;
    const kept = keepSignature
      ? 'Se conservan los datos del establecimiento, la firma y el nombre del representante.'
      : 'Se conservan los datos del establecimiento. La firma y el nombre del representante también se borrarán.';
    const choice = await ask({
      title: '¿Comenzar un formulario nuevo?',
      html: () => `<p>${tr('Se borrarán los datos del alumno y del accidente.')} ${tr(kept)}</p><p class="dialog-note">${tr('Si aún no descargó el PDF actual, hágalo antes de continuar.')}</p>`,
      primary: 'Nuevo formulario',
      secondary: 'Cancelar',
    });
    if (choice !== 'primary') return;
    localDataCleared = false;
    const current = getData();
    const next = { firma: '' };
    Array.from(form.elements).forEach((el) => {
      if (el.name) next[el.name] = '';
    });
    (keepSignature ? KEEP_ON_RESET.concat(SIGNATURE_FIELDS) : KEEP_ON_RESET).forEach((k) => {
      next[k] = current[k];
    });
    next.fechaRegistro = todayISO();
    next.identificationType = 'run';
    setData(next);
    touched.clear();
    showAllErrors = false;
    lookupKey = '';
    lookupState = '';
    renderRunLookup();
    $('#asisDetails').open = false;
    renderCircMeter.flush();
    refresh();
    save.flush();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Formulario nuevo listo.');
  }

  async function clearLocalData() {
    const choice = await ask({
      title: '¿Borrar todos los datos locales?',
      html: () => `<p>${tr('Se eliminarán los borradores, la base de estudiantes, la información médica y las firmas guardadas en este navegador, además de las preferencias locales. El formulario actual se vaciará. Esta acción no se puede deshacer. Los archivos descargados no se eliminan.')}</p>`,
      primary: 'Borrar todos los datos locales', secondary: 'Cancelar',
    });
    if (choice !== 'primary') return;
    // Cancel pending autosave before erasing; do not recreate the draft on focusout.
    localDataCleared = true;
    save.cancel();
    let failed = false;
    for (const key of [STORAGE_KEY, PREFS_KEY, 'school-nursing-language']) {
      try { localStorage.removeItem(key); } catch (_) { failed = true; }
    }
    try { DAEStudents.clearLocalData(); } catch (_) { failed = true; }
    const empty = { firma: '' };
    Array.from(form.elements).forEach(el => { if (el.name) empty[el.name] = ''; });
    empty.identificationType = 'run';
    setData(empty);
    $('#keepSignature').checked = true;
    touched.clear();
    showAllErrors = false;
    lookupKey = '';
    lookupState = '';
    $('#asisDetails').open = false;
    renderDerived(getData());
    renderValidation(getData());
    renderCircMeter.flush();
    renderRunLookup();
    preview.clear();
    saveStatus.classList.remove('is-saving');
    saveMessage = failed ? 'Sin guardado local' : 'Datos locales eliminados.';
    saveTitle = '';
    renderSaveStatus();
    toast(failed ? 'No se pudieron eliminar todos los datos guardados. El navegador impide acceder al almacenamiento. No se puede confirmar la eliminación; revise los datos del sitio en la configuración del navegador.' : 'Datos locales eliminados.');
  }

  document.addEventListener('languagechange', () => {
    renderIdentification();
    renderRunLookup();
    preview.init();
    renderDerived(getData());
    renderValidation(getData());
    renderCircMeter.flush();
    renderSaveStatus();
    $('#appVersion').textContent = tr('Versión {version}', { version: '1.3.2' });
    if (dialog.open && dialogContent) renderDialog();
    if (!$('#toast').hidden) renderToast();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'download') download();
    else if (action === 'preview') openPreview();
    else if (action === 'reset') resetForm();
    else if (action === 'students') DAEStudents.open();
    else if (action === 'clear-local') clearLocalData();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      download();
    }
  });

  /* ---------- diálogo y avisos ---------- */

  const dialog = $('#dialog');
  let dialogContent = null;
  function renderDialog() {
    $('#dialogTitle').textContent = tr(dialogContent.title);
    $('#dialogBody').innerHTML = dialogContent.html();
    $('#dialogOk').textContent = tr(dialogContent.primary);
    $('#dialogCancel').textContent = tr(dialogContent.secondary);
  }

  function ask({ title, html, primary, secondary }) {
    dialogContent = { title, html, primary, secondary };
    renderDialog();
    dialog.returnValue = '';
    return new Promise((resolve) => {
      dialog.addEventListener(
        'close',
        () => resolve(dialog.returnValue === 'ok' ? 'primary' : dialog.returnValue === 'cancel' ? 'secondary' : 'dismiss'),
        { once: true }
      );
      dialog.showModal();
      $('#dialogOk').focus();
    });
  }

  let toastTimer;
  let toastMessage = '';
  let toastParams = {};
  function renderToast() { $('#toast').textContent = tr(toastMessage, toastParams); }
  function toast(msg, params = {}) {
    const el = $('#toast');
    toastMessage = msg;
    toastParams = params;
    renderToast();
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  /* ---------- preferencias ---------- */

  function initPrefs() {
    const box = $('#keepSignature');
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      if (typeof prefs.keepSignature === 'boolean') box.checked = prefs.keepSignature;
    } catch (e) {
      // sin preferencias guardadas: se usa el valor por defecto
    }
    box.addEventListener('change', () => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ keepSignature: box.checked }));
      } catch (e) {
        // el navegador no permite guardar: la opción vale solo para esta sesión
      }
    });
  }

  /* ---------- sección activa en la navegación ---------- */

  function initActiveSection() {
    const links = $$('.steps a');
    const sidebar = $('.sidebar');
    const setActive = (id) => {
      links.forEach((a) => {
        const on = a.dataset.step === id;
        a.classList.toggle('is-active', on);
        if (on) {
          a.setAttribute('aria-current', 'step');
          if (sidebar.scrollWidth > sidebar.clientWidth) {
            sidebar.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
          }
        } else {
          a.removeAttribute('aria-current');
        }
      });
    };
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setActive(en.target.id);
        });
      },
      { rootMargin: '-35% 0px -60% 0px' }
    );
    $$('.card').forEach((c) => io.observe(c));
    setActive('sec-a');

    links.forEach((a) => {
      a.addEventListener('click', () => {
        if (a.dataset.step === 'sec-d') $('#asisDetails').open = true;
      });
    });
  }

  /* ---------- inicio ---------- */

  function init() {
    const today = todayISO();
    $('#fechaAcc').max = today;
    $('#fechaNac').max = today;
    initPrefs();

    const saved = loadSaved();
    if (saved) {
      if (!saved.estNombre || saved.schema !== DRAFT_SCHEMA) saved.estNombre = DEFAULTS.estNombre;
      setData(saved);
      if (Object.keys(saved).some((k) => /^(asis|diag|parteCuerpo|hosp|diasHosp|incap|diasIncap|tipoIncap|causaCierre|fechaCierre)/.test(k) && saved[k])) {
        $('#asisDetails').open = true;
      }
      saveMessage = 'Borrador recuperado';
      renderSaveStatus();
    } else {
      setData(Object.assign({}, DEFAULTS, { fechaRegistro: today }));
    }

    $('#edad').value = computeAge($('#fechaNac').value, $('#fechaAcc').value);
    const data = getData();
    renderDerived(data);
    renderValidation(data);
    renderCircMeter.flush();
    // Un borrador recuperado no se sobrescribe con la base al salir del campo RUN
    lookupKey = validIdentification(data.identificationType, data.identificationValue) ? DAEStudents.identification.key(data.identificationType, data.identificationValue) : '';
    renderRunLookup();
    initActiveSection();
    preview.init();
    registerServiceWorker();
  }

  // Uso sin conexión e instalación como app (solo cuando se sirve por http/https)
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  init();
})();
