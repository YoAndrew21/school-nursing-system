/*
 * Genera plantillas/Plantilla_Estudiantes.xlsx: tabla con formato, listas
 * desplegables y mensajes de ayuda para la carga masiva de estudiantes.
 *
 * Uso (requiere Node.js y la librería exceljs instalada fuera del proyecto,
 * para no publicar node_modules):
 *   npm install --prefix %TEMP%\exceljs exceljs@4
 *   set NODE_PATH=%TEMP%\exceljs\node_modules
 *   node tools/generar-plantilla.js
 *
 * Los encabezados deben coincidir con COLUMNS en js/estudiantes.js
 * (el «*» de las columnas obligatorias se ignora al leer).
 */
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = path.join(__dirname, '..', 'plantillas', 'Plantilla_Estudiantes.xlsx');

const NAVY = 'FF0B3B52';
const TEAL = 'FF0D5C78';
const SOFT = 'FFE2F0F5';
const MUTED = 'FF5D7080';

const FIRST_ROW = 5; // primera fila de datos (encabezado en la fila 4)
const TABLE_ROWS = 200; // filas vacías que muestra la tabla
const VALIDATION_ROWS = 3000; // filas con listas y validaciones

const LISTS = {
  Curso: ['Pre-Kínder', 'Kínder', '1° Básico', '2° Básico', '3° Básico', '4° Básico', '5° Básico', '6° Básico', '7° Básico', '8° Básico', 'I° Medio', 'II° Medio', 'III° Medio', 'IV° Medio'],
  Horario: ['Jornada mañana', 'Jornada tarde', 'Jornada completa'],
  Comuna: [
    'Puerto Montt', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos', 'Llanquihue', 'Maullín', 'Puerto Varas',
    'Castro', 'Ancud', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao',
    'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo',
    'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena',
  ],
  Provincia: ['Llanquihue', 'Chiloé', 'Osorno', 'Palena'],
};
const LIST_KEYS = Object.keys(LISTS);

// Rango dinámico de la hoja «Listas»: incluye lo que el colegio agregue al final
function listSource(key) {
  const col = String.fromCharCode(65 + LIST_KEYS.indexOf(key));
  return `OFFSET(Listas!$${col}$2,0,0,MAX(1,COUNTA(Listas!$${col}:$${col})-1),1)`;
}

const openList = (key, prompt) => ({
  type: 'list',
  formulae: [listSource(key)],
  errorStyle: 'information',
  error: 'El valor no está en la lista, pero se aceptará igual.',
  prompt,
});

const COLUMNS = [
  {
    header: 'Identificación *', width: 24, numFmt: '@',
    help: ['Obligatorio', 'RUN con dígito verificador o IPE numérico. Use texto para conservar ceros iniciales. Ejemplos ficticios, no identificadores emitidos.', '12.345.678-5 / 123456789 (ficticio; no emitido oficialmente)'],
    validation: { type: 'textLength', operator: 'between', formulae: [1, 30], errorStyle: 'warning', error: 'Ingrese entre 1 y 30 caracteres. RUN requiere dígito verificador; IPE usa solo dígitos sin validar dígito RUN.', prompt: 'RUN o IPE; seleccione el tipo explícitamente.' },
  },
  { header: 'Apellido paterno *', width: 20, help: ['Obligatorio', 'Texto.', 'González'] },
  { header: 'Apellido materno', width: 20, help: ['Opcional', 'Texto.', 'Pérez'] },
  { header: 'Nombres *', width: 24, help: ['Obligatorio', 'Texto.', 'Martina Sofía'] },
  {
    header: 'Sexo', width: 13,
    help: ['Opcional', 'Elija de la lista: Masculino o Femenino.', 'Femenino'],
    validation: { type: 'list', formulae: ['"Masculino,Femenino"'], errorStyle: 'stop', error: 'Elija Masculino o Femenino de la lista.', prompt: 'Elija de la lista' },
  },
  {
    header: 'Fecha de nacimiento', width: 20, numFmt: 'dd-mm-yyyy', date: true,
    help: ['Opcional', 'Fecha en formato dd-mm-aaaa.', '05-03-2015'],
    validation: { type: 'date', operator: 'between', formulae: [new Date(Date.UTC(1990, 0, 1)), new Date(Date.UTC(2100, 0, 1))], errorStyle: 'stop', error: 'Ingrese una fecha válida en formato dd-mm-aaaa, ej: 05-03-2015.', prompt: 'Formato dd-mm-aaaa, ej: 05-03-2015' },
  },
  { header: 'Curso', width: 16, help: ['Opcional', 'Elija de la lista o escriba el curso con su letra.', '5° Básico B'], validation: openList('Curso', 'Elija de la lista o escriba el curso con su letra, ej: 5° Básico B') },
  { header: 'Horario', width: 18, help: ['Opcional', 'Elija de la lista.', 'Jornada mañana'], validation: openList('Horario', 'Elija de la lista') },
  { header: 'Calle', width: 26, help: ['Opcional', 'Texto.', 'Av. Presidente Ibáñez'] },
  { header: 'Número', width: 10, numFmt: '@', help: ['Opcional', 'Texto (puede incluir depto. o letra).', '1234'] },
  { header: 'Población / Villa', width: 22, help: ['Opcional', 'Texto.', 'Villa Los Aromos'] },
  { header: 'Comuna', width: 18, help: ['Opcional', 'Elija de la lista o escriba otra comuna.', 'Puerto Montt'], validation: openList('Comuna', 'Elija de la lista o escriba otra comuna') },
  { header: 'Provincia', width: 16, help: ['Opcional', 'Elija de la lista o escriba otra provincia.', 'Llanquihue'], validation: openList('Provincia', 'Elija de la lista o escriba otra provincia') },
  {
    header: 'Codif. comuna', width: 15, numFmt: '0',
    help: ['Opcional', 'Número de hasta 3 dígitos.', '101'],
    validation: { type: 'whole', operator: 'between', formulae: [0, 999], errorStyle: 'stop', error: 'Ingrese un número de hasta 3 dígitos.', prompt: 'Hasta 3 dígitos' },
  },
  {
    header: 'Tipo de identificación', width: 24,
    help: ['Opcional', 'RUN o IPE. Vacío se interpreta como RUN. IPE: 1–30 dígitos, límite técnico, sin regla oficial de longitud o dígito verificador.', 'IPE'],
    validation: { type: 'list', formulae: ['"RUN,IPE"'], errorStyle: 'stop', error: 'Seleccione RUN o IPE.', prompt: 'Vacío = RUN. Seleccione IPE para otro identificador.' },
  },
];

const colLetter = (i) => String.fromCharCode(65 + i);
const lastCol = colLetter(COLUMNS.length - 1);

function banner(ws, title, subtitle, span) {
  ws.mergeCells(`A1:${span}1`);
  ws.mergeCells(`A2:${span}2`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 32;
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = { name: 'Calibri', size: 11, italic: true, color: { argb: MUTED } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
  s.alignment = { vertical: 'middle', indent: 1, wrapText: true };
  ws.getRow(2).height = 34;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enfermería · Colegio San Maximiliano Kolbe';
  wb.created = new Date();

  /* ---------- Estudiantes ---------- */
  const ws = wb.addWorksheet('Estudiantes', {
    properties: { tabColor: { argb: TEAL } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: FIRST_ROW - 1, showGridLines: false }],
  });
  banner(
    ws,
    'Base de estudiantes · Carga masiva',
    'Un estudiante por fila. Seleccione RUN o IPE en Tipo de identificación (vacío = RUN). Escriba la identificación como texto. Las columnas con * son obligatorias.',
    lastCol
  );
  ws.getRow(3).height = 8;

  COLUMNS.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width;
  });

  ws.addTable({
    name: 'Estudiantes',
    ref: `A${FIRST_ROW - 1}`,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: COLUMNS.map((c) => ({ name: c.header, filterButton: true })),
    rows: Array.from({ length: TABLE_ROWS }, () => COLUMNS.map(() => null)),
  });

  const header = ws.getRow(FIRST_ROW - 1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });

  for (let r = FIRST_ROW; r < FIRST_ROW + VALIDATION_ROWS; r++) {
    const row = ws.getRow(r);
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.numFmt) cell.numFmt = c.numFmt;
      if (c.validation) {
        cell.dataValidation = Object.assign(
          { allowBlank: true, showInputMessage: true, showErrorMessage: true, promptTitle: c.header.replace(' *', ''), errorTitle: c.header.replace(' *', '') },
          c.validation
        );
      }
    });
  }

  /* ---------- Instrucciones ---------- */
  const info = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: 'FF17784A' } }, views: [{ showGridLines: false }] });
  banner(info, 'Cómo completar la plantilla', 'Luego de completar la hoja «Estudiantes», guarde el archivo y cárguelo en la aplicación con «Carga masiva».', 'D');
  info.getRow(3).height = 8;
  info.columns = [{ width: 22 }, { width: 13 }, { width: 50 }, { width: 24 }];
  info.addTable({
    name: 'Columnas',
    ref: 'A4',
    headerRow: true,
    style: { theme: 'TableStyleLight9', showRowStripes: true },
    columns: [{ name: 'Columna' }, { name: 'Obligatoria' }, { name: 'Cómo completarla' }, { name: 'Ejemplo' }],
    rows: COLUMNS.map((c) => [c.header.replace(' *', ''), c.help[0], c.help[1], c.help[2]]),
  });
  info.getCell('C5').alignment = { wrapText: true };
  info.getCell('D5').alignment = { wrapText: true };
  info.getRow(5).height = 66;
  info.getCell('C19').alignment = { wrapText: true };
  info.getRow(19).height = 66;
  const notesStart = 4 + COLUMNS.length + 2;
  [
    'Notas',
    '• Un estudiante por fila. Puede pegar datos copiados desde otra planilla (use «Pegar valores»).',
    '• No cambie los nombres de las columnas ni el nombre de la hoja «Estudiantes».',
    '• Identificación repetida del mismo tipo: se usa la última fila. Los RUN inválidos y los identificadores provisionales que no cumplen la regla técnica se omiten y se informan.',
    '• Al cargar un archivo nuevo en la aplicación se reemplaza la base anterior.',
    '• Las planillas antiguas con columna RUN siguen siendo compatibles. Identificación acepta RUN o IPE según el tipo seleccionado; no se infiere el tipo por el valor.',
    '• El PDF conserva la etiqueta oficial R.U.N. ALUMNO. Revise que el valor provisional se vea completo y confirme su uso con la institución receptora.',
  ].forEach((text, k) => {
    const cell = info.getCell(`A${notesStart + k}`);
    cell.value = text;
    cell.font = k === 0 ? { bold: true, size: 12, color: { argb: NAVY } } : { color: { argb: 'FF33475A' } };
  });

  /* ---------- Listas ---------- */
  const lists = wb.addWorksheet('Listas', { properties: { tabColor: { argb: 'FF9A5B00' } }, views: [{ state: 'frozen', ySplit: 1 }] });
  LIST_KEYS.forEach((key, i) => {
    const col = lists.getColumn(i + 1);
    col.width = 24;
    const head = lists.getCell(1, i + 1);
    head.value = key;
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    LISTS[key].forEach((v, k) => {
      lists.getCell(k + 2, i + 1).value = v;
    });
  });
  const note = lists.getCell(1, LIST_KEYS.length + 2);
  note.value = 'Agregue valores al final de cada columna (sin dejar filas vacías) y aparecerán en las listas desplegables.';
  note.font = { italic: true, color: { argb: MUTED } };

  await wb.xlsx.writeFile(OUT);
  console.log('Plantilla generada:', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
