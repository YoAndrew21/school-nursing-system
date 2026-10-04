/*
 * Generador del PDF "Declaración Individual de Accidente Escolar".
 * Dibuja el formulario oficial en vectores (tamaño carta) y escribe encima
 * los datos ingresados. Las coordenadas del diseño están expresadas en una
 * grilla de 850 px de ancho (la del formulario original) y se convierten a
 * puntos PDF con X(), Y() y L().
 */
(function (global) {
  'use strict';

  const S = 0.7;
  const OX = 8.5;
  const OY = -6.5;
  const X = (x) => x * S + OX;
  const Y = (y) => y * S + OY;
  const L = (v) => v * S;

  const INK = [0, 0, 0];
  const DATA = [16, 42, 120];

  const DIAS = ['LUNES = 1', 'MARTES = 2', 'MIERCOLES = 3', 'JUEVES = 4', 'VIERNES = 5', 'SABADO = 6', 'DOMINGO = 7'];

  /* ---------- utilidades de datos ---------- */

  // Las fuentes estándar del PDF solo cubren Latin-1: se normaliza el resto.
  function clean(value) {
    if (value === undefined || value === null) return '';
    let s = String(value)
      .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
      .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ');
    let out = '';
    for (const ch of s) {
      if (ch === '\n' || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 255)) {
        out += ch;
      } else {
        const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (base && base.charCodeAt(0) <= 255) out += base;
      }
    }
    return out.trim();
  }

  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y: m[1], m: m[2], d: m[3] } : null;
  }

  // Lunes = 1 ... Domingo = 7 (codificación del formulario)
  function weekdayIndex(s) {
    const p = parseDate(s);
    if (!p) return '';
    const day = new Date(Number(p.y), Number(p.m) - 1, Number(p.d)).getDay();
    return String(((day + 6) % 7) + 1);
  }

  function normalize(raw) {
    const d = {};
    Object.keys(raw || {}).forEach((k) => {
      d[k] = k === 'firma' ? raw[k] : clean(raw[k]);
    });
    // Use the existing identification field without changing its official RUN label.
    // Legacy callers still supply only raw.run. Provisional values get no invented prefix.
    if (raw.identificationType === 'run' || raw.identificationType === 'ipe') {
      d.run = clean(raw.identificationValue ?? raw.run);
    }
    const reg = parseDate(raw.fechaRegistro) || {};
    const acc = parseDate(raw.fechaAcc) || {};
    const nac = parseDate(raw.fechaNac) || {};
    const cierre = parseDate(raw.fechaCierre) || {};
    const hora = /^(\d{1,2}):(\d{2})/.exec(raw.horaAcc || '') || [];

    d.reg = reg;
    d.acc = acc;
    d.cierre = cierre;
    d.anioNac = nac.y || '';
    d.hh = hora[1] ? hora[1].padStart(2, '0') : '';
    d.mm = hora[2] || '';
    d.diaSemana = weekdayIndex(raw.fechaAcc);

    const calle = [d.calle, d.numero].filter(Boolean).join(' ');
    d.direccion = [calle, d.poblacion].filter(Boolean).join(', ');
    return d;
  }

  /* ---------- primitivas de dibujo ---------- */

  function painter(doc) {
    function font(size, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
    }

    function text(str, x, y, o = {}) {
      font(o.size || 6.5, o.bold);
      doc.setTextColor(...INK);
      doc.text(str, X(x), Y(y), { align: o.align || 'left' });
    }

    function line(x1, y1, x2, y2, w = 0.5) {
      doc.setLineWidth(w);
      doc.setDrawColor(...INK);
      doc.line(X(x1), Y(y1), X(x2), Y(y2));
    }

    function rect(x, y, w, h, lw = 0.6) {
      doc.setLineWidth(lw);
      doc.setDrawColor(...INK);
      doc.rect(X(x), Y(y), L(w), L(h), 'S');
    }

    function cells(x, y, w, h, n) {
      rect(x, y, w, h);
      for (let i = 1; i < n; i++) line(x + (w * i) / n, y, x + (w * i) / n, y + h, 0.6);
    }

    // Texto de datos: se reduce el tamaño hasta caber en maxW (px de diseño).
    function value(str, x, y, o = {}) {
      let s = clean(str).replace(/\n+/g, ' ');
      if (!s) return;
      let size = o.size || 9;
      const min = o.min || 5.5;
      font(size, o.bold);
      if (o.maxW) {
        const max = L(o.maxW);
        while (size > min && doc.getTextWidth(s) > max) {
          size -= 0.25;
          doc.setFontSize(size);
        }
        if (doc.getTextWidth(s) > max) {
          while (s.length > 1 && doc.getTextWidth(s + '...') > max) s = s.slice(0, -1);
          s = s.trimEnd() + '...';
        }
      }
      doc.setTextColor(...DATA);
      doc.text(s, X(x), Y(y), { align: o.align || 'left' });
    }

    // Valor centrado dentro de una caja
    function inBox(str, x, y, w, h, size = 10) {
      const s = clean(str);
      if (!s) return;
      font(size, false);
      let fs = size;
      while (fs > 6 && doc.getTextWidth(s) > L(w) - 3) {
        fs -= 0.5;
        doc.setFontSize(fs);
      }
      doc.setTextColor(...DATA);
      doc.text(s, X(x + w / 2), Y(y + h / 2) + fs * 0.35, { align: 'center' });
    }

    // Un carácter por celda (alineado a la derecha o izquierda)
    function perCell(str, x, y, w, h, n, align = 'right', size = 10) {
      const chars = clean(str).replace(/\s+/g, '').slice(0, n).split('');
      if (!chars.length) return;
      const start = align === 'right' ? n - chars.length : 0;
      const cw = w / n;
      chars.forEach((c, i) => inBox(c, x + cw * (start + i), y, cw, h, size));
    }

    /*
     * Párrafo con ajuste automático: primero intenta escribir sobre las líneas
     * guía; si no cabe, reduce la letra y usa todo el alto disponible.
     * Devuelve { mode: 'normal' | 'reducido' | 'recortado', size }.
     */
    function paragraph(str, o, dryRun) {
      const s = clean(str);
      if (!s) return { mode: 'vacio', size: 0 };
      const width = L(o.x2 - o.x1);
      const draw = (lines, baselines, size, dense) => {
        if (dryRun) return;
        if (dense) {
          // En modo compacto se borran las líneas guía (salvo la última) para que no tachen el texto
          doc.setFillColor(255, 255, 255);
          doc.rect(X(o.x1) - 1, Y(o.top), width + 2, Y(o.rules[o.rules.length - 1]) - 0.7 - Y(o.top), 'F');
        }
        font(size, false);
        doc.setTextColor(...DATA);
        lines.forEach((ln, i) => doc.text(ln, X(o.x1), baselines[i]));
      };

      for (let size = o.size || 9; size >= (o.ruledMin || 7.5); size -= 0.5) {
        font(size, false);
        const lines = doc.splitTextToSize(s, width);
        if (lines.length <= o.rules.length) {
          draw(lines, o.rules.map((r) => Y(r) - 2.2), size);
          return { mode: 'normal', size };
        }
      }

      const top = Y(o.top);
      const bottom = Y(o.rules[o.rules.length - 1]) - 1.5;
      let lines = [];
      let size = o.ruledMin || 7.5;
      for (size = (o.ruledMin || 7.5) - 0.25; size >= 5; size -= 0.25) {
        font(size, false);
        lines = doc.splitTextToSize(s, width);
        const lh = size * 1.18;
        const maxLines = Math.floor((bottom - top - size) / lh) + 1;
        if (lines.length <= maxLines) {
          draw(lines, lines.map((_, i) => top + size + i * lh), size, true);
          return { mode: 'reducido', size };
        }
      }

      size = 5;
      font(size, false);
      const lh = size * 1.18;
      const maxLines = Math.floor((bottom - top - size) / lh) + 1;
      lines = doc.splitTextToSize(s, width).slice(0, maxLines);
      let last = lines[maxLines - 1] || '';
      while (last.length > 1 && doc.getTextWidth(last + '...') > width) last = last.slice(0, -1);
      lines[maxLines - 1] = last.trimEnd() + '...';
      draw(lines, lines.map((_, i) => top + size + i * lh), size, true);
      return { mode: 'recortado', size };
    }

    return { doc, text, line, rect, cells, value, inBox, perCell, paragraph };
  }

  const CIRC = { x1: 90, x2: 452, rules: [752, 773, 794], top: 726, size: 9 };
  const DIAG = { x1: 100, x2: 518, rules: [927], top: 899, size: 9, ruledMin: 7 };

  /* ---------- plantilla del formulario ---------- */

  function drawTemplate(g) {
    const H = { size: 7.2 };
    const C = { size: 6.5, align: 'center' };
    const small = { size: 6 };

    g.rect(40, 40, 770, 1070, 0.8);

    // Encabezado
    g.text('DECLARACION INDIVIDUAL DE ACCIDENTE ESCOLAR', 425, 140, { size: 11, align: 'center' });
    g.text('N°', 698, 137, { size: 7.5 });
    g.text('Antes de registrar los datos lea las instrucciones a continuación.', 65, 157, small);
    g.text('FISCAL O', 642, 170, small);
    g.text('MUNICIPAL = 1', 642, 179, small);
    g.text('PARTICULAR = 2', 642, 208, small);
    g.rect(748, 160, 26, 46);

    // A. Establecimiento
    g.text('A. INDIVIDUALIZACION DEL ESTABLECIMIENTO', 65, 198, H);
    g.line(80, 240, 285, 240);
    g.text('NOMBRE DEL ESTABLECIMIENTO', 182, 253, C);
    g.line(318, 240, 442, 240);
    g.text('PROVINCIA', 380, 253, C);
    g.line(480, 240, 620, 240);
    g.text('COMUNA', 550, 253, C);
    g.text('FECHA REGISTRO de los DATOS', 512, 268, { size: 6, align: 'center' });

    g.line(83, 292, 213, 292);
    g.text('CURSO', 148, 306, C);
    g.line(255, 292, 385, 292);
    g.text('HORARIO', 320, 306, C);
    g.rect(432, 276, 160, 26);
    g.line(475, 276, 475, 302, 0.6);
    g.line(518, 276, 518, 302, 0.6);
    g.text('DIA', 453, 318, C);
    g.text('MES', 496, 318, C);
    g.text('AÑO', 555, 318, C);

    // B. Accidentado
    g.text('B. INDIVIDUALIZACION DEL ACCIDENTADO', 65, 340, H);
    g.text('SEXO', 534, 362, C);
    g.text('AÑO NACIMIENTO', 630, 362, C);
    g.text('EDAD', 741, 362, C);

    g.line(73, 385, 148, 385);
    g.text('AP. PATERNO', 110, 398, C);
    g.line(160, 385, 235, 385);
    g.text('AP. MATERNO', 197, 398, C);
    g.line(250, 385, 365, 385);
    g.text('NOMBRES', 307, 398, C);
    g.line(378, 385, 468, 385);
    g.text('R.U.N. ALUMNO', 423, 398, C);

    g.text('M = 1', 498, 388, small);
    g.text('F = 2', 498, 397, small);
    g.rect(523, 372, 22, 38);
    g.rect(587, 372, 86, 38);
    g.rect(717, 375, 48, 35);

    g.text('RESIDENCIA HABITUAL:', 65, 430, H);
    g.line(78, 483, 428, 483);
    g.text('CALLE', 117, 497, C);
    g.text('NUMERO', 205, 497, C);
    g.text('POBLACION / VILLA', 335, 497, C);
    g.line(443, 483, 540, 483);
    g.text('COMUNA', 491, 497, C);
    g.line(548, 483, 645, 483);
    g.text('PROVINCIA', 596, 497, C);
    g.cells(670, 462, 99, 36, 3);
    g.text('CODIF. COM.', 719, 509, { size: 6, align: 'center' });

    // C. Accidente
    g.text('C. INFORME SOBRE EL ACCIDENTE (FECHA, HORA Y DIA DE LA SEMANA EN QUE ACCIDENTO)', 65, 526, H);
    g.text('HORA : MIN.', 116, 543, C);
    g.text('AÑO', 215, 543, C);
    g.text('MES', 314, 543, C);
    g.text('DIA', 403, 543, C);
    g.cells(92, 553, 48, 27, 2);
    g.rect(182, 553, 66, 27);
    g.cells(290, 553, 48, 27, 2);
    g.cells(378, 553, 50, 27, 2);

    // Recuadro "testigos" con sombra
    const doc = g.doc;
    doc.setFillColor(40, 40, 40);
    doc.rect(X(470), Y(569), L(283), L(24), 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(X(467), Y(566), L(283), L(24), 'FD');
    g.text('TESTIGOS: (EN CASO DE TRAYECTO)', 608, 581, { size: 6.5, bold: true, align: 'center' });

    g.text('DIA ACCIDENTE', 92, 607, small);
    DIAS.forEach((d, i) => g.text(d, 82, 626 + i * 9.5, small));
    g.rect(188, 630, 20, 36);

    g.text('ACCIDENTE', 307, 607, { size: 6, align: 'center' });
    g.text('DE TRAYECTO = 1', 250, 649, small);
    g.text('EN LA ESCUELA = 2', 250, 674, small);
    g.rect(336, 645, 20, 35);

    g.text('a)', 406, 622, { size: 7, bold: true });
    g.line(420, 624, 772, 624);
    g.text('NOMBRE - APELLIDO', 520, 640, { size: 6.5, bold: true, align: 'center' });
    g.text('C. NAC. DE ID.', 712, 640, { size: 6.5, bold: true, align: 'center' });
    g.text('b)', 406, 672, { size: 7, bold: true });
    g.line(420, 674, 772, 674);
    g.text('NOMBRE - APELLIDO', 520, 690, { size: 6.5, bold: true, align: 'center' });
    g.text('C. NAC. DE ID.', 712, 690, { size: 6.5, bold: true, align: 'center' });

    g.text('CIRCUNSTANCIA DEL ACCIDENTE (DESCRIBA COMO OCURRIO - CAUSAL)', 65, 716, H);
    CIRC.rules.forEach((r) => g.line(CIRC.x1, r, CIRC.x2, r, 0.4));

    g.text('FIRMA Y TIMBRE', 637, 762, { size: 7, bold: true, align: 'center' });
    g.line(555, 768, 720, 768);
    g.text('RECTOR O REPRESENTANTE', 637, 783, C);

    // D. Naturaleza y consecuencia
    g.text('D. NATURALEZA Y CONSECUENCIA DEL ACCIDENTE', 65, 830, H);
    g.rect(66, 845, 716, 253, 0.8);
    g.line(80, 845, 80, 1098, 0.6);
    const vertical = 'SOLO ESTABLEC. ASISTENCIAL'.replace(/ /g, '').split('');
    const withGaps = [];
    vertical.forEach((c, i) => {
      withGaps.push(c);
      if (i === 3 || i === 12) withGaps.push(' ');
    });
    let vy = 874;
    withGaps.forEach((c) => {
      if (c !== ' ') g.text(c, 73, vy, { size: 4.6, align: 'center' });
      vy += c === ' ' ? 5 : 7.6;
    });

    g.line(95, 880, 520, 880);
    g.text('ESTABLECIMIENTO ASISTENCIAL', 307, 893, C);
    g.text('S S', 654, 877, C);
    g.text('ESTABLEC.', 738, 877, C);
    g.text('CODIGO', 572, 910, C);
    g.cells(634, 885, 40, 40, 2);
    g.text('-', 690, 909, { size: 8, align: 'center' });
    g.cells(707, 885, 61, 40, 3);

    g.line(95, 932, 520, 932);
    g.text('DIAGNOSTICO MEDICO', 307, 945, C);

    g.line(100, 982, 248, 982);
    g.text('PARTE DEL CUERPO AFECTADA', 174, 995, C);

    g.text('HOSPITALIZACION', 312, 966, C);
    g.text('SI = 1', 279, 992, small);
    g.text('NO = 2', 279, 1001, small);
    g.rect(309, 978, 20, 37);
    g.text('TOTAL DIAS HOSP.', 416, 972, C);
    g.cells(372, 983, 88, 25, 3);

    g.text('INCAPACIDAD', 552, 966, C);
    g.text('SI = 1', 527, 992, small);
    g.text('NO = 2', 527, 1001, small);
    g.rect(557, 978, 20, 37);
    g.text('TOTAL DIAS INCAPACIDAD', 705, 972, C);
    g.cells(660, 983, 90, 25, 3);

    g.text('TIPO DE INCAPACIDAD', 150, 1031, C);
    ['LEVE = 1', 'TEMPORAL = 2', 'INVALIDEZ PARCIAL = 3', 'INVALIDEZ TOTAL = 4', 'GRAN INVALIDEZ = 5', 'MUERTE = 6']
      .forEach((t, i) => g.text(t, 103, 1047 + i * 9, small));
    g.rect(220, 1042, 22, 36);

    g.text('CAUSA DE CIERRE DEL CASO', 340, 1031, C);
    ['ALTA MEDICA = 1', 'INVALIDEZ = 2', 'ABANDONO DE', 'TRATAMIENTO = 3', 'MUERTE = 4']
      .forEach((t, i) => g.text(t, 272, 1047 + i * 9, small));
    g.rect(383, 1042, 20, 36);

    g.text('FECHA CIERRE DEL CASO', 518, 1043, C);
    g.rect(445, 1052, 147, 26);
    g.line(520, 1052, 520, 1078, 0.6);
    g.line(556, 1052, 556, 1078, 0.6);
    g.text('AÑO', 483, 1091, C);
    g.text('MES', 538, 1091, C);
    g.text('DIA', 574, 1091, C);

    g.line(615, 1064, 772, 1064);
    g.text('FIRMA DEL ESTADISTICO', 694, 1078, C);
  }

  /* ---------- datos ---------- */

  function drawData(g, d) {
    const v = g.value;
    const center = (maxW) => ({ align: 'center', maxW });

    // Encabezado y A
    v(d.folio, 716, 137, { maxW: 88 });
    g.inBox(d.tipoEst, 748, 160, 26, 46, 11);
    v(d.estNombre, 182, 234, center(205));
    v(d.estProvincia, 380, 234, center(124));
    v(d.estComuna, 550, 234, center(140));
    v(d.curso, 148, 286, center(130));
    v(d.horario, 320, 286, center(130));
    g.inBox(d.reg.d, 432, 276, 43, 26);
    g.inBox(d.reg.m, 475, 276, 43, 26);
    g.inBox(d.reg.y, 518, 276, 74, 26);

    // B
    v(d.apPaterno, 110, 379, center(76));
    v(d.apMaterno, 197, 379, center(76));
    v(d.nombres, 307, 379, center(116));
    v(d.run, 423, 379, center(92));
    g.inBox(d.sexo, 523, 372, 22, 38, 11);
    g.inBox(d.anioNac, 587, 372, 86, 38, 11);
    g.inBox(d.edad, 717, 375, 48, 35, 11);
    v(d.direccion, 80, 477, { maxW: 346 });
    v(d.resComuna, 491, 477, center(96));
    v(d.resProvincia, 596, 477, center(96));
    g.perCell(d.codifCom, 670, 462, 99, 36, 3, 'left', 11);

    // C
    g.inBox(d.hh, 92, 553, 24, 27);
    g.inBox(d.mm, 116, 553, 24, 27);
    g.inBox(d.acc.y, 182, 553, 66, 27);
    g.perCell(d.acc.m, 290, 553, 48, 27, 2);
    g.perCell(d.acc.d, 378, 553, 50, 27, 2);
    g.inBox(d.diaSemana, 188, 630, 20, 36, 11);
    g.inBox(d.tipoAcc, 336, 645, 20, 35, 11);
    v(d.t1Nombre, 426, 619, { maxW: 205 });
    v(d.t1Ci, 712, 619, center(118));
    v(d.t2Nombre, 426, 669, { maxW: 205 });
    v(d.t2Ci, 712, 669, center(118));
    g.paragraph(d.circunstancia, CIRC);

    if (d.firma && /^data:image\/(png|jpe?g);base64,/.test(d.firma)) {
      try {
        const props = g.doc.getImageProperties(d.firma);
        const boxW = L(150);
        const boxH = L(54);
        const k = Math.min(boxW / props.width, boxH / props.height);
        const w = props.width * k;
        const h = props.height * k;
        const x = X(637) - w / 2;
        const y = Y(753) - h;
        g.doc.addImage(d.firma, props.fileType || 'PNG', x, y, w, h);
      } catch (e) {
        /* imagen de firma inválida: se omite */
      }
    }
    v(d.rectorNombre, 637, 797, { align: 'center', maxW: 200, size: 7.5 });

    // D
    v(d.asisNombre, 100, 875, { maxW: 418 });
    g.perCell(d.asisSS, 634, 885, 40, 40, 2, 'left', 11);
    g.perCell(d.asisEst, 707, 885, 61, 40, 3, 'left', 11);
    g.paragraph(d.diagnostico, DIAG);
    v(d.parteCuerpo, 174, 977, center(146));
    g.inBox(d.hosp, 309, 978, 20, 37, 11);
    g.perCell(d.diasHosp, 372, 983, 88, 25, 3);
    g.inBox(d.incap, 557, 978, 20, 37, 11);
    g.perCell(d.diasIncap, 660, 983, 90, 25, 3);
    g.inBox(d.tipoIncap, 220, 1042, 22, 36, 11);
    g.inBox(d.causaCierre, 383, 1042, 20, 36, 11);
    g.inBox(d.cierre.y, 445, 1052, 75, 26);
    g.inBox(d.cierre.m, 520, 1052, 36, 26);
    g.inBox(d.cierre.d, 556, 1052, 36, 26);
  }

  /* ---------- API pública ---------- */

  function newDoc() {
    const lib = global.jspdf;
    if (!lib || !lib.jsPDF) throw new Error('No se pudo cargar la librería jsPDF.');
    return new lib.jsPDF({ unit: 'pt', format: 'letter', compress: true });
  }

  function buildPdf(data) {
    const doc = newDoc();
    doc.setProperties({
      title: 'Declaración Individual de Accidente Escolar',
      subject: 'Seguro Escolar - Declaración de accidente',
      creator: 'Enfermería - Declaración de Accidente Escolar',
    });
    const g = painter(doc);
    drawTemplate(g);
    drawData(g, normalize(data));
    return doc;
  }

  let measureDoc = null;
  // Indica cómo se imprimirá la circunstancia (normal, letra reducida o recortada)
  function fitCircunstancia(text) {
    if (!measureDoc) measureDoc = newDoc();
    return painter(measureDoc).paragraph(text, CIRC, true);
  }

  global.DAE = { buildPdf, fitCircunstancia, weekdayIndex, parseDate };
})(typeof window !== 'undefined' ? window : globalThis);
