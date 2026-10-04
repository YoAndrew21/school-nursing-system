/*
 * Lógica de la interfaz: estado del formulario, validación, guardado local,
 * firma en pantalla, vista previa y descarga del PDF.
 */
(function () {
  'use strict';

  // Translation helper. Falls back to the original Spanish string if i18n is unavailable.
  const tr = (text) => window.I18N?.t?.(text) ?? text;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = 'dae-enfermeria:v1';
  const form = $('#daeForm');

  const DEFAULTS = {
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
    { name: 'run', label: 'R.U.N. del alumno (válido)', section: 'sec-b', check: validRun },
    { name: 'sexo', label: 'Sexo', section: 'sec-b' },
    { name: 'fechaAcc', label: 'Fecha del accidente', section: 'sec-c' },
    { name: 'horaAcc', label: 'Hora del accidente', section: 'sec-c' },
    { name: 'tipoAcc', label: 'Tipo de accidente', section: 'sec-c' },
    { name: 'circunstancia', label: 'Circunstancia del accidente', section: 'sec-e' },
  ];

  // Campos que se completan desde la base de estudiantes (carga masiva)
  const STUDENT_FIELDS = ['run', 'apPaterno', 'apMaterno', 'nombres', 'sexo', 'fechaNac', 'curso', 'horario', 'calle', 'numero', 'poblacion', 'resComuna', 'resProvincia', 'codifCom'];

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

  function computeAge(birth, ref) {
    const b = DAE.parseDate(birth);
    if (!b) return '';
    const r = DAE.parseDate(ref) || DAE.parseDate(todayISO());
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
    return data;
  }

  function setData(data) {
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

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  const save = debounce(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(getData(), { schema: DRAFT_SCHEMA })));
      const t = new Date();
      saveText.textContent = `Guardado ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      saveStatus.title = 'Borrador guardado en este navegador';
    } catch (e) {
      saveText.textContent = 'Sin guardado local';
      saveStatus.title = 'El navegador no permite guardar el borrador';
    }
    saveStatus.classList.remove('is-saving');
  }, 500);

  function markDirty() {
    saveStatus.classList.add('is-saving');
    saveText.textContent = 'Guardando…';
    save();
  }

  /* ---------- validación y progreso ---------- */

  function isFilled(req, data) {
    const v = String(data[req.name] || '').trim();
    if (!v) return false;
    return req.check ? req.check(v) : true;
  }

  function fieldEl(name) {
    const input = form.querySelector(`[name="${name}"]`);
    return input ? input.closest('.field') : null;
  }

  function renderValidation(data) {
    let done = 0;
    const perSection = {};

    REQUIRED.forEach((req) => {
      const ok = isFilled(req, data);
      if (ok) done++;
      perSection[req.section] = (perSection[req.section] !== false) && ok;
      const field = fieldEl(req.name);
      if (field) field.classList.toggle('is-invalid', !ok && (showAllErrors || touched.has(req.name)));
    });

    $('#progressText').textContent = `${done} de ${REQUIRED.length}`;
    $('#progressBar').style.width = `${(done / REQUIRED.length) * 100}%`;
    $('.progress-box').classList.toggle('is-complete', done === REQUIRED.length);

    $$('.steps a').forEach((a) => {
      const id = a.dataset.step;
      a.classList.toggle('is-done', id in perSection && perSection[id]);
    });

    return REQUIRED.filter((req) => !isFilled(req, data));
  }

  /* ---------- campos derivados ---------- */

  function renderDerived(data) {
    const wd = DAE.weekdayIndex(data.fechaAcc);
    $('#weekdayOut').textContent = wd ? `${DIAS[Number(wd) - 1]} · código ${wd}` : '—';

    const nac = DAE.parseDate(data.fechaNac);
    $('#anioNacHint').textContent = nac ? `Año de nacimiento en el PDF: ${nac.y}` : 'En el PDF se imprime solo el año.';

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
      badge.textContent = 'Cabe en tamaño normal';
    } else if (fit.mode === 'reducido') {
      badge.textContent = `Se imprimirá con letra reducida (${fit.size} pt)`;
      badge.classList.add('is-warn');
    } else {
      badge.textContent = 'Demasiado largo: se recortará en el PDF';
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
    const el = e.target;
    if (el.matches('[data-digits]')) {
      const clean = el.value.replace(/\D/g, '');
      if (clean !== el.value) el.value = clean;
    }
    if (el.matches('#run, [data-run]')) {
      const clean = el.value.replace(/[^0-9kK.\-]/g, '');
      if (clean !== el.value) el.value = clean;
    }
    if (el.name === 'fechaNac' || el.name === 'fechaAcc') {
      const age = computeAge($('#fechaNac').value, $('#fechaAcc').value);
      if (age) $('#edad').value = age;
    }
    if (el.name === 'circunstancia') renderCircMeter();
    if (el.type === 'radio') touched.add(el.name);
    // Con guion y dígito verificador el RUN está completo; sin guion se busca al salir del campo
    if (el.id === 'run') {
      if (/-\s*[0-9kK]$/.test(el.value) && lookupStudent()) return;
      renderRunLookup();
    }
    refresh();
  });

  form.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el.name) return;
    if (el.matches('#run, [data-run]') && el.value.trim()) el.value = formatRun(el.value);
    if (el.type !== 'radio') touched.add(el.name);
    if (el.id === 'run' && lookupStudent()) return;
    refresh();
  });

  $('#run').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupStudent();
  });

  /* ---------- base de estudiantes: autocompletado por RUN ---------- */

  let lookupRun = ''; // último RUN buscado, para no volver a sobrescribir datos editados
  let lookupState = '';

  function renderRunLookup() {
    const info = DAEStudents.info();
    const box = $('#runLookup');
    const current = cleanRun($('#run').value);
    const state = current && current === lookupRun ? lookupState : '';
    box.className = 'hint run-lookup' + (state ? ` is-${state}` : '');
    let msg;
    if (!info) msg = tr('Sin base de estudiantes: cargue un Excel para completar los datos con el RUN.');
    else if (state === 'found') msg = tr('✓ Datos completados desde la base de estudiantes.');
    else if (state === 'missing') msg = tr('RUN no encontrado en la base de estudiantes.');
    else msg = window.I18N?.language === 'en' ? `Database of ${info.count} students: enter a RUN to auto-fill their data.` : window.I18N?.language === 'ja' ? `${info.count}名の児童・生徒データ：RUNを入力すると情報を自動入力します。` : `Base de ${info.count} estudiantes: al ingresar el RUN se completan sus datos.`;
    $('#runLookupText').textContent = msg;
  }

  // Devuelve true si completó el formulario (ya actualizado)
  function lookupStudent() {
    const run = cleanRun($('#run').value);
    if (run !== lookupRun) {
      lookupRun = '';
      lookupState = '';
    }
    if (!DAEStudents.info() || !validRun(run) || run === lookupRun) {
      renderRunLookup();
      return false;
    }
    lookupRun = run;
    const student = DAEStudents.find(run);
    lookupState = student ? 'found' : 'missing';
    renderRunLookup();
    if (!student) return false;

    const next = {};
    STUDENT_FIELDS.forEach((k) => {
      next[k] = student[k] || '';
    });
    if (!next.horario) delete next.horario; // el horario se conserva entre formularios
    next.run = formatRun(run);
    next.edad = computeAge(next.fechaNac, $('#fechaAcc').value);
    setData(next);
    STUDENT_FIELDS.forEach((k) => touched.add(k));
    refresh();
    renderRunLookup();
    const name = [student.nombres, student.apPaterno].filter(Boolean).join(' ');
    toast(`Datos de ${name || next.run} cargados desde la base de estudiantes.`);
    return true;
  }

  DAEStudents.onChange(() => {
    lookupRun = '';
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
        toast(tr('Use una imagen PNG o JPG.'));
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
          if (!value) toast(tr('La imagen parece estar en blanco.'));
          paint();
          onChange(value);
        };
        img.onerror = () => toast(tr('No se pudo leer la imagen.'));
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

  signature.onChange(() => refresh());

  /* ---------- PDF: vista previa y descarga ---------- */

  function buildDoc(data) {
    try {
      return DAE.buildPdf(data || getData());
    } catch (e) {
      console.error(e);
      toast(tr('No se pudo generar el PDF. Recargue la página e intente de nuevo.'));
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
        empty.innerHTML = 'Este navegador no puede mostrar el PDF dentro de la página.<br>Use «Descargar PDF» para revisarlo.';
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
      schedule() {
        if (!canEmbed || !live.checked || !mq.matches) return;
        clearTimeout(timer);
        state.textContent = tr('Actualizando…');
        timer = setTimeout(render, 700);
      },
    };
  })();

  function openPreview() {
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
      const list = missing.map((m) => `<li>${m.label}</li>`).join('');
      const choice = await ask({
        title: tr('Faltan datos obligatorios'),
        html: `<p>Complete estos campos antes de generar la declaración:</p><ul>${list}</ul>`,
        primary: tr('Completar datos'),
        secondary: tr('Descargar de todos modos'),
      });
      if (choice !== 'secondary') {
        if (choice === 'primary') focusField(missing[0].name);
        return;
      }
    }
    const doc = buildDoc(data);
    if (!doc) return;
    doc.save(fileName(data));
    toast(tr('PDF generado y descargado.'));
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
      html: `<p>Se borrarán los datos del alumno y del accidente. ${kept}</p><p class="dialog-note">Si aún no descargó el PDF actual, hágalo antes de continuar.</p>`,
      primary: 'Nuevo formulario',
      secondary: 'Cancelar',
    });
    if (choice !== 'primary') return;
    const current = getData();
    const next = { firma: '' };
    Array.from(form.elements).forEach((el) => {
      if (el.name) next[el.name] = '';
    });
    (keepSignature ? KEEP_ON_RESET.concat(SIGNATURE_FIELDS) : KEEP_ON_RESET).forEach((k) => {
      next[k] = current[k];
    });
    next.fechaRegistro = todayISO();
    setData(next);
    touched.clear();
    showAllErrors = false;
    lookupRun = '';
    lookupState = '';
    renderRunLookup();
    $('#asisDetails').open = false;
    renderCircMeter.flush();
    refresh();
    save.flush();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(tr('Formulario nuevo listo.'));
  }

  document.addEventListener('languagechange', () => { renderRunLookup(); preview.init(); refresh(); });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'download') download();
    else if (action === 'preview') openPreview();
    else if (action === 'reset') resetForm();
    else if (action === 'students') DAEStudents.open();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      download();
    }
  });

  /* ---------- diálogo y avisos ---------- */

  const dialog = $('#dialog');

  function ask({ title, html, primary, secondary }) {
    $('#dialogTitle').textContent = title;
    $('#dialogBody').innerHTML = html;
    $('#dialogOk').textContent = primary;
    $('#dialogCancel').textContent = secondary;
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
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
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
      saveText.textContent = 'Borrador recuperado';
    } else {
      setData(Object.assign({}, DEFAULTS, { fechaRegistro: today }));
    }

    const data = getData();
    renderDerived(data);
    renderValidation(data);
    renderCircMeter.flush();
    // Un borrador recuperado no se sobrescribe con la base al salir del campo RUN
    lookupRun = validRun(data.run) ? cleanRun(data.run) : '';
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
