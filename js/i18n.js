(() => {
  const STORAGE_KEY = 'school-nursing-language';
  const dictionaries = {"en": {"Declaración de Accidente Escolar · Enfermería": "School Accident Declaration · Nursing", "Saltar al formulario": "Skip to form", "Enfermería · Colegio San Maximiliano Kolbe": "School Nursing · Chilean Accident Module", "Declaración": "School", "Individual": "Individual", "de Accidente Escolar": "Accident Declaration", "Borrador local": "Local draft", "Establecimiento": "School", "Accidentado": "Student", "Accidente": "Accident", "Circunstancia y firma": "Circumstances & signature", "Atención asistencial": "Medical care", "Campos obligatorios": "Required fields", "Descargar PDF": "Download PDF", "Vista previa": "Preview", "Carga masiva": "Bulk import", "Nuevo formulario": "New form", "Los datos se guardan solo en este navegador. Nada se envía a internet.": "Data is stored only in this browser. Nothing is sent over the internet.", "Individualización del establecimiento": "School information", "Datos del colegio y del registro. Vienen prellenados y se conservan entre formularios.": "School and record information. These values can be kept between forms.", "Tipo de establecimiento": "School type", "Fiscal o municipal": "Public or municipal", "Particular": "Private", "N° de declaración": "Declaration No.", "Nombre del establecimiento": "School name", "Provincia": "Province", "Comuna": "Municipality", "Fecha de registro de los datos": "Record date", "Curso": "Class / Grade", "Indique el curso del alumno.": "Enter the student’s class or grade.", "Horario": "Schedule", "Individualización del accidentado": "Student information", "Identificación y residencia habitual del alumno o alumna.": "Student identification and usual residence.", "Apellido paterno": "Paternal surname", "Ingrese el apellido paterno.": "Enter the paternal surname.", "Apellido materno": "Maternal surname", "Nombres": "Given names", "Ingrese los nombres.": "Enter the given names.", "R.U.N. del alumno": "Student RUN", "Ingrese un RUN válido (revise el dígito verificador).": "Enter a valid Chilean RUN (check digit included).", "Sexo": "Sex", "Masculino": "Male", "Femenino": "Female", "Seleccione el sexo.": "Select sex.", "Fecha de nacimiento": "Date of birth", "En el PDF se imprime solo el año.": "Only the year is printed in the official PDF.", "Edad": "Age", "Residencia habitual": "Usual residence", "Calle": "Street", "Número": "Number", "Población / Villa": "Neighborhood / Area", "Codif. comuna": "Municipality code", "Informe sobre el accidente": "Accident report", "Fecha, hora y tipo. El día de la semana se calcula automáticamente.": "Date, time and type. The weekday is calculated automatically.", "Fecha del accidente": "Accident date", "Indique la fecha.": "Enter the date.", "Hora": "Time", "Indique la hora.": "Enter the time.", "Día de la semana": "Day of week", "Tipo de accidente": "Accident type", "De trayecto": "Commuting", "En la escuela": "At school", "Seleccione el tipo de accidente.": "Select the accident type.", "Testigos": "Witnesses", "(en caso de trayecto)": "(for commuting accidents)", "a) Nombre y apellido": "a) Full name", "a) C. nac. de identidad": "a) National ID", "b) Nombre y apellido": "b) Full name", "b) C. nac. de identidad": "b) National ID", "Circunstancia del accidente y firma": "Accident circumstances and signature", "Describa cómo ocurrió y la causa. La firma del rector o representante es opcional: puede firmar en pantalla o hacerlo a mano después de imprimir.": "Describe what happened and its cause. The principal/representative signature is optional and can be added on screen or by hand after printing.", "Circunstancia del accidente (cómo ocurrió y causa)": "Accident circumstances (what happened and cause)", "Describa la circunstancia del accidente.": "Describe the accident circumstances.", "Firma y timbre · rector o representante": "Signature and stamp · principal or representative", "Firme aquí con el dedo, lápiz o mouse": "Sign here using a finger, stylus or mouse", "Subir imagen": "Upload image", "Borrar firma": "Clear signature", "Puede subir una imagen escaneada de la firma y el timbre (el fondo blanco se quita automáticamente).": "You can upload a scanned signature/stamp image (white background is removed automatically).", "Nombre del rector o representante": "Principal or representative name", "Mantener la firma y el nombre del representante al crear un nuevo formulario": "Keep the signature and representative name when starting a new form", "Desmarque si prefiere que esta sección quede en blanco en cada formulario nuevo.": "Uncheck to leave this section blank for each new form.", "Naturaleza y consecuencia del accidente": "Nature and outcome of the accident", "Solo para el establecimiento asistencial. Normalmente se deja en blanco.": "For the healthcare facility only. Normally left blank.", "Establecimiento asistencial": "Healthcare facility", "Código (S.S. – establec.)": "Facility code", "Diagnóstico médico": "Medical diagnosis", "Parte del cuerpo afectada": "Affected body part", "Hospitalización": "Hospitalization", "Sí": "Yes", "No": "No", "Total días hospitalización": "Total hospitalization days", "Incapacidad": "Disability / incapacity", "Total días incapacidad": "Total incapacity days", "Tipo de incapacidad": "Type of incapacity", "1 · Leve": "1 · Mild", "2 · Temporal": "2 · Temporary", "3 · Invalidez parcial": "3 · Partial disability", "4 · Invalidez total": "4 · Total disability", "5 · Gran invalidez": "5 · Severe disability", "6 · Muerte": "6 · Death", "Causa de cierre del caso": "Reason for case closure", "1 · Alta médica": "1 · Medical discharge", "2 · Invalidez": "2 · Disability", "3 · Abandono de tratamiento": "3 · Treatment abandoned", "4 · Muerte": "4 · Death", "Fecha de cierre del caso": "Case closure date", "Vista previa en vivo (solo monitores)": "Live preview (desktop monitors)", "Se actualiza mientras escribe": "Updates as you type", "En vivo": "Live", "La vista previa está pausada.": "Preview is paused.", "Use «Vista previa» o «Descargar PDF».": "Use “Preview” or “Download PDF”.", "Carga masiva de estudiantes": "Bulk student import", "Cargue un Excel con los datos de los alumnos. Después, al ingresar el RUN en el formulario, los datos del estudiante se completan solos.": "Import an Excel file with student data. Afterwards, entering a RUN can auto-fill the student information.", "Descargue la plantilla": "Download the template", "Tabla con listas desplegables para Sexo, Curso, Horario, Comuna y Provincia. La hoja «Instrucciones» explica cada columna.": "Spreadsheet template with dropdowns for sex, class, schedule, municipality and province. The “Instructions” sheet explains each column.", "Descargar plantilla": "Download template", "Cargue el Excel con los estudiantes": "Import the student spreadsheet", "Arrastre el archivo aquí": "Drag the file here", "o": "or", "Seleccionar archivo": "Choose file", "Formatos .xlsx, .xls o .csv · un archivo nuevo reemplaza la base actual": "Formats: .xlsx, .xls or .csv · a new file replaces the current local database", "Aún no hay estudiantes cargados. El autocompletado por RUN se activa al cargar un Excel.": "No students have been imported yet. RUN auto-fill is enabled after importing a spreadsheet.", "Base de estudiantes cargada": "Imported student database", "Eliminar base": "Delete database", "Estudiante": "Student", "La base queda guardada solo en este navegador y no se envía a internet.": "The database remains only in this browser and is not sent over the internet."}, "ja": {"Declaración de Accidente Escolar · Enfermería": "学校事故申告 · 保健室", "Saltar al formulario": "フォームへ移動", "Enfermería · Colegio San Maximiliano Kolbe": "学校保健室 · チリ学校事故モジュール", "Declaración": "学校", "Individual": "個別", "de Accidente Escolar": "事故申告書", "Borrador local": "ローカル下書き", "Establecimiento": "学校", "Accidentado": "児童・生徒", "Accidente": "事故", "Circunstancia y firma": "事故状況・署名", "Atención asistencial": "医療対応", "Campos obligatorios": "必須項目", "Descargar PDF": "PDFをダウンロード", "Vista previa": "プレビュー", "Carga masiva": "一括取込", "Nuevo formulario": "新規フォーム", "Los datos se guardan solo en este navegador. Nada se envía a internet.": "データはこのブラウザ内にのみ保存され、インターネットへ送信されません。", "Individualización del establecimiento": "学校情報", "Datos del colegio y del registro. Vienen prellenados y se conservan entre formularios.": "学校と記録に関する情報です。フォーム間で保持できます。", "Tipo de establecimiento": "学校種別", "Fiscal o municipal": "公立・自治体立", "Particular": "私立", "N° de declaración": "申告番号", "Nombre del establecimiento": "学校名", "Provincia": "県・州", "Comuna": "市区町村", "Fecha de registro de los datos": "記録日", "Curso": "学年・クラス", "Indique el curso del alumno.": "児童・生徒の学年またはクラスを入力してください。", "Horario": "時間帯", "Individualización del accidentado": "児童・生徒情報", "Identificación y residencia habitual del alumno o alumna.": "児童・生徒の本人情報と通常の居住地。", "Apellido paterno": "父方姓", "Ingrese el apellido paterno.": "父方姓を入力してください。", "Apellido materno": "母方姓", "Nombres": "名", "Ingrese los nombres.": "名を入力してください。", "R.U.N. del alumno": "児童・生徒のRUN", "Ingrese un RUN válido (revise el dígito verificador).": "有効なチリのRUNを入力してください（検査数字を含む）。", "Sexo": "性別", "Masculino": "男性", "Femenino": "女性", "Seleccione el sexo.": "性別を選択してください。", "Fecha de nacimiento": "生年月日", "En el PDF se imprime solo el año.": "公式PDFには年のみ印字されます。", "Edad": "年齢", "Residencia habitual": "通常の居住地", "Calle": "住所（通り）", "Número": "番地", "Población / Villa": "地区・地域", "Codif. comuna": "市区町村コード", "Informe sobre el accidente": "事故情報", "Fecha, hora y tipo. El día de la semana se calcula automáticamente.": "日付・時刻・事故種別。曜日は自動計算されます。", "Fecha del accidente": "事故発生日", "Indique la fecha.": "日付を入力してください。", "Hora": "時刻", "Indique la hora.": "時刻を入力してください。", "Día de la semana": "曜日", "Tipo de accidente": "事故種別", "De trayecto": "通学途中", "En la escuela": "学校内", "Seleccione el tipo de accidente.": "事故種別を選択してください。", "Testigos": "目撃者", "(en caso de trayecto)": "（通学途中の場合）", "a) Nombre y apellido": "a) 氏名", "a) C. nac. de identidad": "a) 身分証番号", "b) Nombre y apellido": "b) 氏名", "b) C. nac. de identidad": "b) 身分証番号", "Circunstancia del accidente y firma": "事故状況と署名", "Describa cómo ocurrió y la causa. La firma del rector o representante es opcional: puede firmar en pantalla o hacerlo a mano después de imprimir.": "事故の発生状況と原因を記入してください。校長または代表者の署名は任意で、画面上または印刷後に手書きできます。", "Circunstancia del accidente (cómo ocurrió y causa)": "事故状況（発生経緯・原因）", "Describa la circunstancia del accidente.": "事故の状況を記入してください。", "Firma y timbre · rector o representante": "署名・押印 · 校長または代表者", "Firme aquí con el dedo, lápiz o mouse": "指・スタイラス・マウスで署名してください", "Subir imagen": "画像をアップロード", "Borrar firma": "署名を消去", "Puede subir una imagen escaneada de la firma y el timbre (el fondo blanco se quita automáticamente).": "署名・印影のスキャン画像をアップロードできます（白背景は自動除去されます）。", "Nombre del rector o representante": "校長または代表者名", "Mantener la firma y el nombre del representante al crear un nuevo formulario": "新規フォーム作成時も署名と代表者名を保持する", "Desmarque si prefiere que esta sección quede en blanco en cada formulario nuevo.": "新規フォームごとに空欄にする場合はチェックを外してください。", "Naturaleza y consecuencia del accidente": "事故の内容と結果", "Solo para el establecimiento asistencial. Normalmente se deja en blanco.": "医療機関向けの項目です。通常は空欄のままです。", "Establecimiento asistencial": "医療機関", "Código (S.S. – establec.)": "医療機関コード", "Diagnóstico médico": "診断", "Parte del cuerpo afectada": "負傷部位", "Hospitalización": "入院", "Sí": "はい", "No": "いいえ", "Total días hospitalización": "入院日数", "Incapacidad": "就学・活動不能", "Total días incapacidad": "不能日数", "Tipo de incapacidad": "障害・不能の種類", "1 · Leve": "1 · 軽度", "2 · Temporal": "2 · 一時的", "3 · Invalidez parcial": "3 · 部分的障害", "4 · Invalidez total": "4 · 全面的障害", "5 · Gran invalidez": "5 · 重度障害", "6 · Muerte": "6 · 死亡", "Causa de cierre del caso": "ケース終了理由", "1 · Alta médica": "1 · 治療終了", "2 · Invalidez": "2 · 障害", "3 · Abandono de tratamiento": "3 · 治療中断", "4 · Muerte": "4 · 死亡", "Fecha de cierre del caso": "ケース終了日", "Vista previa en vivo (solo monitores)": "ライブプレビュー（デスクトップ）", "Se actualiza mientras escribe": "入力中に自動更新", "En vivo": "ライブ", "La vista previa está pausada.": "プレビューは一時停止中です。", "Use «Vista previa» o «Descargar PDF».": "「プレビュー」または「PDFをダウンロード」を使用してください。", "Carga masiva de estudiantes": "児童・生徒データ一括取込", "Cargue un Excel con los datos de los alumnos. Después, al ingresar el RUN en el formulario, los datos del estudiante se completan solos.": "児童・生徒データのExcelを取り込みます。その後RUNを入力すると情報を自動入力できます。", "Descargue la plantilla": "テンプレートをダウンロード", "Tabla con listas desplegables para Sexo, Curso, Horario, Comuna y Provincia. La hoja «Instrucciones» explica cada columna.": "性別・学年・時間帯・市区町村・県の選択肢を含む表です。「Instrucciones」シートに各列の説明があります。", "Descargar plantilla": "テンプレートをダウンロード", "Cargue el Excel con los estudiantes": "児童・生徒のExcelを取り込む", "Arrastre el archivo aquí": "ここにファイルをドラッグ", "o": "または", "Seleccionar archivo": "ファイルを選択", "Formatos .xlsx, .xls o .csv · un archivo nuevo reemplaza la base actual": "形式: .xlsx / .xls / .csv · 新しいファイルで現在のローカルデータを置き換えます", "Aún no hay estudiantes cargados. El autocompletado por RUN se activa al cargar un Excel.": "まだデータがありません。Excel取込後にRUNによる自動入力が有効になります。", "Base de estudiantes cargada": "取込済み児童・生徒データ", "Eliminar base": "データを削除", "Estudiante": "児童・生徒", "La base queda guardada solo en este navegador y no se envía a internet.": "データはこのブラウザ内にのみ保存され、インターネットへ送信されません。"}};
  Object.assign(dictionaries.en, {
    "Opcional":"Optional", "Ej: 5° Básico B":"e.g. Grade 5 B", "Ej: Jornada mañana":"e.g. Morning schedule",
    "Se calcula sola":"Calculated automatically", "Ej: Puerto Montt":"e.g. Puerto Montt", "Ej: Llanquihue":"e.g. Llanquihue",
    "3 dígitos":"3 digits", "Ej: Durante el recreo, el alumno corría en el patio y tropezó con un desnivel, cayendo sobre su brazo izquierdo…":"e.g. During recess, the student was running in the playground, tripped on an uneven surface and fell on their left arm…",
    "Ej: Hospital de Puerto Montt":"e.g. Puerto Montt Hospital", "Código servicio de salud":"Health service code", "Código establecimiento":"Facility code",
    "Buscar por RUN, nombre o curso":"Search by RUN, name or class", "Buscar estudiante":"Search student",
    "Actualizada":"Updated", "No disponible":"Unavailable", "En pausa":"Paused", "Actualizando…":"Updating…",
    "Sin base de estudiantes: cargue un Excel para completar los datos con el RUN.":"No student database: import a spreadsheet to auto-fill data using the RUN.",
    "✓ Datos completados desde la base de estudiantes.":"✓ Student data filled from the local database.", "RUN no encontrado en la base de estudiantes.":"RUN not found in the student database.",
    "Use una imagen PNG o JPG.":"Use a PNG or JPG image.", "La imagen parece estar en blanco.":"The image appears to be blank.", "No se pudo leer la imagen.":"The image could not be read.",
    "No se pudo generar el PDF. Recargue la página e intente de nuevo.":"The PDF could not be generated. Reload the page and try again.",
    "Faltan datos obligatorios":"Required information is missing", "Completar datos":"Complete information", "Descargar de todos modos":"Download anyway", "Cancelar":"Cancel",
    "PDF generado y descargado.":"PDF generated and downloaded.", "Formulario nuevo listo.":"New form ready.",
    "Formato no admitido":"Unsupported format", "No se pudo leer el archivo":"The file could not be read", "No se cargó ningún estudiante":"No students were imported",
    "No se pudo guardar la base":"The database could not be saved", "Base de estudiantes eliminada":"Student database deleted", "Sin resultados para la búsqueda.":"No search results."
  });
  Object.assign(dictionaries.ja, {
    "Opcional":"任意", "Ej: 5° Básico B":"例：5年B組", "Ej: Jornada mañana":"例：午前",
    "Se calcula sola":"自動計算", "Ej: Puerto Montt":"例：Puerto Montt", "Ej: Llanquihue":"例：Llanquihue", "3 dígitos":"3桁",
    "Ej: Durante el recreo, el alumno corría en el patio y tropezó con un desnivel, cayendo sobre su brazo izquierdo…":"例：休み時間に校庭を走っていた児童・生徒が段差につまずき、左腕をついて転倒した…",
    "Ej: Hospital de Puerto Montt":"例：Puerto Montt Hospital", "Código servicio de salud":"保健サービスコード", "Código establecimiento":"医療機関コード",
    "Buscar por RUN, nombre o curso":"RUN・氏名・学年で検索", "Buscar estudiante":"児童・生徒を検索",
    "Actualizada":"更新", "No disponible":"利用不可", "En pausa":"一時停止", "Actualizando…":"更新中…",
    "Sin base de estudiantes: cargue un Excel para completar los datos con el RUN.":"児童・生徒データがありません。Excelを取り込むとRUNから情報を自動入力できます。",
    "✓ Datos completados desde la base de estudiantes.":"✓ ローカルデータから児童・生徒情報を入力しました。", "RUN no encontrado en la base de estudiantes.":"児童・生徒データに該当するRUNが見つかりません。",
    "Use una imagen PNG o JPG.":"PNGまたはJPG画像を使用してください。", "La imagen parece estar en blanco.":"画像が空白のようです。", "No se pudo leer la imagen.":"画像を読み込めませんでした。",
    "No se pudo generar el PDF. Recargue la página e intente de nuevo.":"PDFを作成できませんでした。ページを再読み込みして、もう一度お試しください。",
    "Faltan datos obligatorios":"必須項目が未入力です", "Completar datos":"入力を続ける", "Descargar de todos modos":"このままダウンロード", "Cancelar":"キャンセル",
    "PDF generado y descargado.":"PDFを作成してダウンロードしました。", "Formulario nuevo listo.":"新しいフォームを作成しました。",
    "Formato no admitido":"未対応の形式です", "No se pudo leer el archivo":"ファイルを読み込めませんでした", "No se cargó ningún estudiante":"児童・生徒データを取り込めませんでした",
    "No se pudo guardar la base":"データを保存できませんでした", "Base de estudiantes eliminada":"児童・生徒データを削除しました", "Sin resultados para la búsqueda.":"検索結果がありません。"
  });
  // Spanish source keys are shared by marked HTML and explicit dynamic renderers.
  const messages = [
    ['Tipo de identificación', 'Identification type', '識別番号の種類'],
    ['RUN chileno', 'Chilean RUN', 'チリのRUN'],
    ["IPE","IPE — Provisional School Identifier","IPE（仮学校識別番号）"],
    ['Identificación', 'Identification', '識別番号'],
    ['Identificación del estudiante', 'Student identification', '児童・生徒の識別番号'],
    ["IPE — Identificador Provisorio Escolar","IPE — Provisional School Identifier","IPE（仮学校識別番号）"],
    ["Ejemplo ficticio: 123456789","Fictional example: 123456789","架空の例：123456789"],
    ["Ingrese entre 1 y 30 dígitos, sin puntos ni guion. El límite es técnico, no un formato oficial de IPE. No se verifica el dígito de RUN.","Enter 1–30 digits without dots or hyphens. The limit is technical, not an official IPE format. RUN check digits are not validated.","数字を1～30桁で入力してください。ピリオドやハイフンは不要です。この上限はアプリの制限であり、IPEの公式書式ではありません。RUNの検査数字は確認しません。"],
    ["IPE inválido: ingrese entre 1 y 30 dígitos, sin puntos ni guion.","Invalid IPE: enter 1–30 digits without dots or hyphens.","IPEが無効です。ピリオドやハイフンを使わず、数字を1～30桁で入力してください。"],
    ['El PDF conserva el campo oficial «R.U.N. ALUMNO» y muestra allí el valor provisional sin cambiar la etiqueta. El espacio es limitado y puede abreviarlo. Revise el PDF y confirme su uso con la institución receptora.', 'The PDF keeps the official “R.U.N. ALUMNO” field and places the IPE value there without changing its label. Space is limited and the value may be shortened. Review the PDF and confirm its use with the receiving institution.', 'PDFの公式欄「R.U.N. ALUMNO」の表記は変更せず、その欄に仮識別番号を記載します。スペースが限られるため、番号が省略される場合があります。PDFを確認し、受領機関に使用可否を確認してください。'],
    ['Sin base de estudiantes: cargue un archivo para completar los datos con su identificación.', 'No student database: import a file to auto-fill data using their identification.', '児童・生徒データがありません。ファイルを取り込むと、識別番号による自動入力を利用できます。'],
    ['Identificación no encontrada en la base de estudiantes para el tipo seleccionado.', 'Identification not found in the student database for the selected type.', '選択した種類の識別番号は児童・生徒データに見つかりませんでした。'],
    ['Base de {count} estudiantes: seleccione el tipo e ingrese la identificación para completar sus datos.', 'Database of {count} students: select the type and enter their identification to auto-fill data.', '{count}名の児童・生徒データがあります。種類を選択し、識別番号を入力すると情報を自動入力します。'],
    ['No se encontró una columna «RUN» o «Identificación». Use la plantilla.', 'No “RUN” or “Identificación” column was found. Use the template.', '「RUN」または「Identificación」列が見つかりません。テンプレートを使用してください。'],
    ["Tipo de identificación no reconocido; use RUN o IPE","Unrecognized identification type; use RUN or IPE","識別番号の種類を認識できません。RUNまたはIPEを指定してください"],
    ['las columnas RUN e Identificación contienen valores distintos', 'RUN and Identificación columns contain conflicting values', 'RUN列とIdentificación列の値が一致しません'],
    ["IPE inválido: ingrese entre 1 y 30 dígitos, sin puntos ni guion","Invalid IPE: enter 1–30 digits without dots or hyphens","IPEが無効です。ピリオドやハイフンを使わず、数字を1～30桁で入力してください"],
    ['{count} identificación(es) repetida(s) del mismo tipo: se usó la última fila.', '{count} duplicate identification(s) of the same type: the last row was used.', '同じ種類の識別番号の重複が{count}件あります。最後の行を使用しました。'],
    ['El autocompletado por identificación queda desactivado hasta cargar otro archivo.', 'Identification auto-fill is disabled until another file is imported.', '別のファイルを取り込むまで、識別番号による自動入力は無効になります。'],
    ['Cargue un archivo con los datos de los estudiantes. Seleccione el tipo e ingrese su RUN o identificación provisional para completar sus datos.', 'Import a file with student data. Select the type and enter their RUN or IPE to auto-fill their data.', '児童・生徒データのファイルを取り込んでください。種類を選択し、RUNまたは仮識別番号を入力すると情報を自動入力します。'],
    ['La plantilla incluye Identificación y Tipo de identificación (RUN o IPE). Las planillas antiguas con columna RUN siguen siendo compatibles. Un tipo vacío se interpreta como RUN; use texto para conservar ceros iniciales.', 'The template includes Identificación and Tipo de identificación (RUN or IPE). Legacy spreadsheets with a RUN column still work. A blank type means RUN; use text to preserve leading zeroes.', 'テンプレートにはIdentificación（識別番号）とTipo de identificación（種類：RUNまたはIPE）が含まれます。RUN列のみの旧形式にも対応します。種類が空欄の場合はRUNとして扱います。先頭のゼロを保持するため、文字列形式を使用してください。'],
    ['Aún no hay estudiantes cargados. El autocompletado por identificación se activa al cargar un archivo.', 'No students have been imported yet. Identification auto-fill is enabled after importing a file.', 'まだ児童・生徒データがありません。ファイル取込後に識別番号による自動入力が有効になります。'],
    ['Buscar por identificación, nombre o curso', 'Search by identification, name or class', '識別番号・氏名・学年で検索'],
    ['Guardado {time}', 'Saved {time}', '保存済み {time}'],
    ['Borrador guardado en este navegador', 'Draft saved in this browser', 'このブラウザに下書きを保存しました'],
    ['Sin guardado local', 'Local saving unavailable', 'ローカル保存を利用できません'],
    ['El navegador no permite guardar el borrador', 'The browser cannot save the draft', 'このブラウザでは下書きを保存できません'],
    ['Guardando…', 'Saving…', '保存中…'],
    ['Borrador recuperado', 'Draft restored', '下書きを復元しました'],
    ['{done} de {total}', '{done} of {total}', '{total}項目中{done}項目'],
    ['{day} · código {code}', '{day} · code {code}', '{day} · コード {code}'],
    ['Lunes', 'Monday', '月曜日'], ['Martes', 'Tuesday', '火曜日'],
    ['Miércoles', 'Wednesday', '水曜日'], ['Jueves', 'Thursday', '木曜日'],
    ['Viernes', 'Friday', '金曜日'], ['Sábado', 'Saturday', '土曜日'], ['Domingo', 'Sunday', '日曜日'],
    ['Año de nacimiento en el PDF: {year}', 'Birth year in the PDF: {year}', 'PDFに記載する出生年：{year}'],
    ['Cabe en tamaño normal', 'Fits at normal size', '通常の文字サイズで収まります'],
    ['Se imprimirá con letra reducida ({size} pt)', 'Will print at reduced size ({size} pt)', '縮小した文字サイズ（{size} pt）で印字されます'],
    ['Demasiado largo: se recortará en el PDF', 'Too long: will be truncated in the PDF', '長すぎるため、PDFでは一部が省略されます'],
    ['Base de {count} estudiantes: al ingresar el RUN se completan sus datos.', 'Database of {count} students: enter a RUN to auto-fill their data.', '{count}名の児童・生徒データがあります。RUNを入力すると情報を自動入力します。'],
    ['Datos de {name} cargados desde la base de estudiantes.', 'Data for {name} loaded from the student database.', '{name}の情報を児童・生徒データから読み込みました。'],
    ['Este navegador no puede mostrar el PDF dentro de la página. Use «Descargar PDF» para revisarlo.', 'This browser cannot display the PDF on this page. Use “Download PDF” to review it.', 'このブラウザではページ内にPDFを表示できません。「PDFをダウンロード」で確認してください。'],
    ['El navegador bloqueó la ventana emergente. Use «Descargar PDF».', 'The browser blocked the pop-up. Use “Download PDF”.', 'ポップアップがブロックされました。「PDFをダウンロード」を使用してください。'],
    ['Complete estos campos antes de generar la declaración:', 'Complete these fields before generating the declaration:', '申告書を作成する前に、次の項目を入力・修正してください：'],
    ['R.U.N. del alumno (válido)', 'Student RUN (valid)', '児童・生徒のRUN（有効な番号）'],
    ['Hora del accidente', 'Accident time', '事故発生時刻'],
    ['Circunstancia del accidente', 'Accident circumstances', '事故の状況'],
    ['¿Comenzar un formulario nuevo?', 'Start a new form?', '新規フォームを作成しますか？'],
    ['Se borrarán los datos del alumno y del accidente.', 'Student and accident information will be cleared.', '児童・生徒情報と事故情報を消去します。'],
    ['Se conservan los datos del establecimiento, la firma y el nombre del representante.', 'School information, signature and representative name will be kept.', '学校情報、署名、代表者名は保持されます。'],
    ['Se conservan los datos del establecimiento. La firma y el nombre del representante también se borrarán.', 'School information will be kept. The signature and representative name will also be cleared.', '学校情報は保持されます。署名と代表者名は消去します。'],
    ['Si aún no descargó el PDF actual, hágalo antes de continuar.', 'Download the current PDF before continuing if you have not already.', '現在のPDFをまだダウンロードしていない場合は、先にダウンロードしてください。'],
    ['Ingrese una fecha válida.', 'Enter a valid calendar date.', '実在する日付を入力してください。'],
    ['La fecha del accidente no puede ser futura.', 'The accident date cannot be in the future.', '事故発生日に未来の日付は指定できません。'],
    ['La fecha de nacimiento no puede ser futura.', 'The birth date cannot be in the future.', '生年月日に未来の日付は指定できません。'],
    ['La fecha de nacimiento no puede ser posterior al accidente.', 'The birth date cannot be after the accident date.', '生年月日は事故発生日以前の日付にしてください。'],
    ['Corregir fechas', 'Correct dates', '日付を修正'],
    ['Hay fechas inválidas', 'Invalid dates', '日付に誤りがあります'],
    ['Borrar todos los datos locales', 'Clear all local data', 'すべてのローカルデータを消去'],
    ['¿Borrar todos los datos locales?', 'Clear all local data?', 'すべてのローカルデータを消去しますか？'],
    ['Se eliminarán los borradores, la base de estudiantes, la información médica y las firmas guardadas en este navegador, además de las preferencias locales. El formulario actual se vaciará. Esta acción no se puede deshacer. Los archivos descargados no se eliminan.', 'Drafts, the student database, medical information, signatures stored in this browser and local preferences will be removed. The current form will be cleared. This cannot be undone. Downloaded files will not be deleted.', 'このブラウザに保存された下書き、児童・生徒データ、医療情報、署名、ローカル設定を削除し、現在のフォームを空にします。この操作は取り消せません。ダウンロード済みのファイルは削除されません。'],
    ['Datos locales eliminados.', 'Local data cleared.', 'ローカルデータを消去しました。'],
    ['No se pudieron eliminar todos los datos guardados. El navegador impide acceder al almacenamiento. No se puede confirmar la eliminación; revise los datos del sitio en la configuración del navegador.', 'Some stored data could not be removed because the browser blocks storage access. Deletion cannot be confirmed; check site data in browser settings.', 'ブラウザがストレージへのアクセスを制限しているため、保存データをすべて削除できませんでした。削除を確認できないため、ブラウザ設定のサイトデータを確認してください。'],
    ['{count} estudiantes · «{file}» · cargado el {time}', '{count} students · “{file}” · imported {time}', '{count}名 · 「{file}」 · 取込日時：{time}'],
    ['Mostrando {limit} de {count}. Use la búsqueda para encontrar a un estudiante.', 'Showing {limit} of {count}. Use search to find a student.', '{count}名中{limit}名を表示しています。検索で児童・生徒を探してください。'],
    ['Use un archivo .xlsx, .xls o .csv (puede partir de la plantilla).', 'Use an .xlsx, .xls or .csv file (you can use the template).', '.xlsx、.xls、.csvのいずれかを使用してください（テンプレートも利用できます）。'],
    ['Leyendo «{file}»…', 'Reading “{file}”…', '「{file}」を読み込み中…'],
    ['Verifique que sea un Excel válido y que no esté protegido con contraseña.', 'Check that the spreadsheet is valid and not password protected.', '有効な表計算ファイルで、パスワード保護されていないことを確認してください。'],
    ['{count} RUN repetido(s): se usó la última fila.', '{count} duplicate RUN(s): the last row was used.', 'RUNの重複が{count}件あります。最後の行を使用しました。'],
    ['Fila {row}: {message}.', 'Row {row}: {message}.', '{row}行目：{message}。'],
    ['… y {count} fila(s) más con errores.', '… and {count} more row(s) with errors.', 'ほかに{count}行のエラーがあります。'],
    ['La hoja no tiene filas con datos bajo los encabezados.', 'The sheet has no data rows below the headers.', '見出しの下にデータ行がありません。'],
    ['{count} estudiantes cargados', '{count} students imported', '{count}名のデータを取り込みました'],
    [' · {count} fila(s) omitida(s)', ' · {count} row(s) skipped', ' · {count}行をスキップしました'],
    ['¿Eliminar? Confirmar', 'Delete? Confirm', '削除を確定'],
    ['El autocompletado por RUN queda desactivado hasta cargar otro Excel.', 'RUN auto-fill is disabled until another spreadsheet is imported.', '別の表計算ファイルを取り込むまで、RUNによる自動入力は無効になります。'],
    ['El navegador no tiene espacio suficiente o no permite guardar datos. Pruebe con un archivo más pequeño.', 'The browser has insufficient space or cannot save data. Try a smaller file.', 'ブラウザの保存容量が不足しているか、保存が許可されていません。小さいファイルでお試しください。'],
    ['No se pudo cargar el lector de Excel. Recargue la página e intente de nuevo.', 'The spreadsheet reader could not load. Reload the page and try again.', '表計算ファイルの読込機能を起動できませんでした。ページを再読み込みしてお試しください。'],
    ['El archivo no tiene datos.', 'The file has no data.', 'ファイルにデータがありません。'],
    ['No se encontró la columna «RUN». Use la plantilla y no cambie los nombres de las columnas.', 'The “RUN” column was not found. Use the template without changing column names.', '「RUN」列が見つかりません。テンプレートの列名を変更せずに使用してください。'],
    ['falta el RUN', 'RUN is missing', 'RUNが未入力です'],
    ['RUN inválido («{run}»)', 'Invalid RUN (“{run}”)', 'RUNが無効です（「{run}」）'],
    ['faltan el apellido y los nombres', 'surname and given names are missing', '姓と名が未入力です'],
    ['Secciones y acciones', 'Sections and actions', 'セクションと操作'],
    ['Secciones del formulario', 'Form sections', 'フォームのセクション'],
    ['Vista previa del PDF', 'PDF preview', 'PDFプレビュー'],
    ['Vista previa del PDF (A)', 'PDF preview (A)', 'PDFプレビュー（A）'],
    ['Vista previa del PDF (B)', 'PDF preview (B)', 'PDFプレビュー（B）'],
    ['Acciones', 'Actions', '操作'], ['Cerrar', 'Close', '閉じる'],
    ['Versión {version}', 'Version {version}', 'バージョン {version}'],
  ];
  messages.forEach(([es, en, ja]) => { dictionaries.en[es] = en; dictionaries.ja[es] = ja; });
  let current = 'es';
  try { current = localStorage.getItem(STORAGE_KEY) || 'es'; } catch (_) { /* Use in-memory language. */ }
  if (!['es', 'en', 'ja'].includes(current)) current = 'es';

  function t(key, params = {}) {
    const template = current === 'es' ? key : (dictionaries[current][key] || key);
    return template.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
  }

  function render(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    ['placeholder', 'aria-label', 'title'].forEach(attr => {
      root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => {
        el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
      });
    });
  }

  function apply(lang = current) {
    if (!['es', 'en', 'ja'].includes(lang)) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, current); } catch (_) { /* Keep selection in memory. */ }
    document.documentElement.lang = current === 'es' ? 'es-CL' : current;
    document.querySelectorAll('[data-lang]').forEach(button => {
      const selected = button.dataset.lang === current;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    render();
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: current } }));
  }
  window.I18N = { t, apply, render, get language() { return current; } };
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => apply(button.dataset.lang)));
    apply(current);
  });
})();
