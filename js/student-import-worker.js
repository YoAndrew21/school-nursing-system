/* Ephemeral local parsing worker; terminated after parsing, cancellation or timeout. */
importScripts('../vendor/xlsx.full.min.js', './student-import.js');
self.onmessage = event => {
  try {
    const { buffer, filename } = event.data;
    self.postMessage({ parsed: StudentImport.parseWorkbook(XLSX, buffer, filename) });
  } catch (error) {
    self.postMessage({ error: error.userMessage || { key: 'Verifique que sea un Excel válido y que no esté protegido con contraseña.' } });
  }
};
