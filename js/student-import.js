/* Local import validation shared by the UI and its dedicated worker. */
(function () {
  'use strict';
  const COLUMNS = [
    { name: 'run', header: 'RUN', aliases: ['rut', 'run alumno', 'rut alumno', 'run estudiante', 'rut estudiante'] },
    { name: 'identificationType', header: 'Tipo de identificación', aliases: ['tipo identificacion', 'identification type', 'identificationType'] },
    { name: 'identificationValue', header: 'Identificación', aliases: ['identificador', 'identification', 'identification value', 'identificationValue'] },
    { name: 'apPaterno', header: 'Apellido paterno', aliases: ['paterno', 'primer apellido'], max: 30 },
    { name: 'apMaterno', header: 'Apellido materno', aliases: ['materno', 'segundo apellido'], max: 30 },
    { name: 'nombres', header: 'Nombres', aliases: ['nombre', 'nombres alumno'], max: 40 },
    { name: 'sexo', header: 'Sexo', aliases: ['genero'], parse: parseSexo },
    { name: 'fechaNac', header: 'Fecha de nacimiento', aliases: ['fecha nacimiento', 'nacimiento', 'fecha nac'], date: true },
    { name: 'curso', header: 'Curso', aliases: ['nivel', 'curso alumno'], max: 30 },
    { name: 'horario', header: 'Horario', aliases: ['jornada'], max: 30 },
    { name: 'calle', header: 'Calle', aliases: ['direccion', 'domicilio'], max: 50 },
    { name: 'numero', header: 'Número', aliases: ['nro', 'n°', 'num', 'numero casa'], max: 10 },
    { name: 'poblacion', header: 'Población / Villa', aliases: ['poblacion', 'villa', 'sector'], max: 40 },
    { name: 'resComuna', header: 'Comuna', aliases: ['comuna residencia'], max: 30 },
    { name: 'resProvincia', header: 'Provincia', aliases: ['provincia residencia'], max: 30 },
    { name: 'codifCom', header: 'Codif. comuna', aliases: ['codigo comuna', 'cod comuna', 'codificacion comuna'], digits: true },
  ];
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

  function parseSexo(v) {
    const n = norm(v);
    if (['1', 'm', 'masculino', 'hombre', 'h', 'varon'].includes(n)) return '1';
    if (['2', 'f', 'femenino', 'mujer'].includes(n)) return '2';
    return '';
  }


  const limits = Object.freeze({
    MAX_FILE_BYTES: 5 * 1024 * 1024,
    MAX_STUDENT_ROWS: 5000,
    MAX_WORKSHEET_ROWS: 10000,
    MAX_WORKSHEET_COLUMNS: 64,
    MAX_CELL_CHARS: 1024,
    MAX_PARSE_MS: 30000,
  });

  function failure(key, params = {}) {
    const error = new Error(key);
    error.userMessage = { key, params };
    return error;
  }

  function calendarDate(year, month, day) {
    if (year < 1 || year > 9999) return '';
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseDate(value, X, date1904) {
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) return ''; // Do not discard a time component.
      const date = X.SSF.parse_date_code(value, { date1904 });
      return date ? calendarDate(date.y, date.m, date.d) : '';
    }
    const valueText = text(value);
    let match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(valueText);
    if (match) return calendarDate(Number(match[3]), Number(match[2]), Number(match[1]));
    match = /^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/.exec(valueText);
    return match ? calendarDate(Number(match[1]), Number(match[2]), Number(match[3])) : '';
  }

  function parseWorkbook(X, buffer, filename) {
    if (buffer.byteLength > limits.MAX_FILE_BYTES) throw failure('El archivo supera el límite de {mb} MiB.', { mb: 5 });
    const options = { type: 'array', raw: true, sheetRows: limits.MAX_WORKSHEET_ROWS + 1 };
    if (/\.csv$/i.test(filename)) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer));
        options.codepage = 65001;
      } catch (_) { /* Preserve the existing Windows-1252 CSV fallback. */ }
    }
    const workbook = X.read(buffer, options);
    const sheetName = workbook.SheetNames.find(name => norm(name) === 'estudiantes') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) throw failure('El archivo no tiene datos.');
    const range = X.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
    if (range.e.r >= limits.MAX_WORKSHEET_ROWS || range.e.c >= limits.MAX_WORKSHEET_COLUMNS) {
      throw failure('La hoja supera el límite de {rows} filas o {cols} columnas.', { rows: limits.MAX_WORKSHEET_ROWS, cols: limits.MAX_WORKSHEET_COLUMNS });
    }
    const rows = X.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: true });
    const columnFor = header => COLUMNS.find(col => norm(header) && (norm(col.header) === norm(header) || col.aliases.some(alias => norm(alias) === norm(header))));
    const headerIndex = rows.slice(0, 20).findIndex(row => row.some(cell => ['run', 'identificationValue'].includes(columnFor(cell)?.name)));
    if (headerIndex < 0) throw failure('No se encontró una columna «RUN» o «Identificación». Use la plantilla.');
    const map = [];
    const ignoredColumns = [];
    rows[headerIndex].forEach((header, index) => {
      if (String(header).length > limits.MAX_CELL_CHARS) throw failure('Un encabezado supera {max} caracteres.', { max: limits.MAX_CELL_CHARS });
      const col = columnFor(header);
      if (!col) { ignoredColumns.push({ index, header: String(header || X.utils.encode_col(range.s.c + index)) }); return; }
      if (map.some(entry => entry.col === col)) throw failure('Hay encabezados repetidos o equivalentes. Corrija el archivo.');
      map.push({ col, index });
    });
    const students = {};
    const errors = [], warnings = [], warningRows = new Set();
    let totalRows = 0, validRows = 0, duplicates = 0;
    const date1904 = !!workbook.Workbook?.WBProps?.date1904;
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (!row.some(cell => text(cell))) return;
      if (++totalRows > limits.MAX_STUDENT_ROWS) throw failure('El archivo supera el límite de {count} estudiantes.', { count: limits.MAX_STUDENT_ROWS });
      const rowNumber = range.s.r + headerIndex + offset + 2;
      const record = {}, rowErrors = [], rowWarnings = [];
      const report = (target, key, params = {}) => target.push({ row: rowNumber, msg: key, params });
      ignoredColumns.forEach(({ index, header }) => {
        if (text(row[index])) report(rowWarnings, 'Se omitirá la columna no reconocida {column}.', { column: header });
      });
      map.forEach(({ col, index }) => {
        const cell = sheet[X.utils.encode_cell({ r: rowNumber - 1, c: range.s.c + index })];
        let value = row[index];
        if (cell?.f || cell?.t === 'e') {
          report(rowErrors, 'El campo {field} contiene una fórmula o un error de Excel.', { field: col.header });
          return;
        }
        if (['run', 'identificationValue'].includes(col.name) && typeof value === 'number') {
          if (!Number.isSafeInteger(value) || value < 0) report(rowErrors, 'La identificación numérica no es segura; guárdela como texto.');
          else {
            if (/^0[0-9]+$/.test(cell?.w || '')) value = cell.w;
            report(rowWarnings, 'Identificación almacenada como número: revise los ceros iniciales; use texto.');
          }
        }
        if (col.digits && typeof value === 'number' && Number.isSafeInteger(value) && /^0[0-9]+$/.test(cell?.w || '')) value = cell.w;
        const raw = String(value ?? '');
        if (raw.length > limits.MAX_CELL_CHARS) {
          report(rowErrors, 'El campo {field} supera {max} caracteres; no se recortó.', { field: col.header, max: limits.MAX_CELL_CHARS });
          return;
        }
        if (col.digits && typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
          report(rowErrors, 'El campo {field} debe contener dígitos y conservarse sin pérdida de precisión.', { field: col.header });
        }
        if (typeof value === 'number' && !col.date && !col.parse && !col.digits && col.name !== 'numero' && !['run', 'identificationValue'].includes(col.name)) {
          report(rowWarnings, 'Se convirtió el formato de {field}.', { field: col.header });
        }
        let result = ['run', 'identificationValue'].includes(col.name) ? raw.trim() : text(value);
        if (raw !== result) report(rowWarnings, 'Se normalizaron espacios en {field}.', { field: col.header });
        if (col.max && result.length > col.max) report(rowErrors, 'El campo {field} supera {max} caracteres; no se recortó.', { field: col.header, max: col.max });
        if (col.digits && result && !/^[0-9]+$/.test(result)) report(rowErrors, 'El campo {field} debe contener dígitos y conservarse sin pérdida de precisión.', { field: col.header });
        if (col.parse && result) {
          result = col.parse(value);
          if (!result) report(rowErrors, 'El campo {field} no tiene un valor reconocido.', { field: col.header });
        }
        if (col.date && result) {
          result = parseDate(value, X, date1904);
          if (!result) report(rowErrors, 'Fecha de nacimiento inválida o imposible; la fila no se importará.');
        }
        record[col.name] = result;
      });
      const type = parseIdentificationType(record.identificationType);
      const rawId = record.identificationValue || record.run || '';
      if (!type) report(rowErrors, 'Tipo de identificación no reconocido; use RUN o IPE');
      else if (record.identificationValue && record.run && (type === 'run' ? cleanRun(record.identificationValue) !== cleanRun(record.run) : record.identificationValue !== record.run)) report(rowErrors, 'las columnas RUN e Identificación contienen valores distintos');
      else if (type === 'run') {
        const run = cleanRun(rawId);
        if (!run) report(rowErrors, 'falta el RUN');
        else if (!validRun(run)) report(rowErrors, 'RUN inválido («{run}»)', { run: rawId });
        record.identificationValue = formatRun(run);
        if (rawId && rawId !== record.identificationValue) report(rowWarnings, 'Se convirtió el formato de {field}.', { field: 'RUN' });
      } else {
        if (!validIpe(rawId)) report(rowErrors, 'IPE inválido: ingrese entre 1 y 30 dígitos, sin puntos ni guion');
        record.identificationValue = rawId.trim();
      }
      if (!record.apPaterno && !record.nombres) report(rowErrors, 'faltan el apellido y los nombres');
      if (rowErrors.length) {
        errors.push(...rowErrors);
        if (rowWarnings.length) warningRows.add(rowNumber);
        warnings.push(...rowWarnings);
        return;
      }
      validRows++;
      record.identificationType = type;
      record.run = type === 'run' ? record.identificationValue : '';
      const key = identificationKey(type, record.identificationValue);
      if (students[key]) {
        duplicates++;
        report(rowWarnings, 'Identificación repetida del mismo tipo: se conservará la última fila válida.');
      }
      students[key] = record;
      if (rowWarnings.length) warningRows.add(rowNumber);
      warnings.push(...rowWarnings);
    });
    const values = Object.values(students);
    return { students, errors, warnings, duplicates, totalRows, validRows,
      errorRows: new Set(errors.map(error => error.row)).size, warningRows: warningRows.size,
      count: values.length, runCount: values.filter(record => record.identificationType === 'run').length,
      ipeCount: values.filter(record => record.identificationType === 'ipe').length };
  }

  globalThis.StudentImport = { limits, parseWorkbook, norm, cleanRun, validRun, formatRun,
    validIpe, identificationKey, parseIdentificationType, IPE_MAX_LENGTH };
})();
