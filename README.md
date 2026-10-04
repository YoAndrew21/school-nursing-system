# School Nursing System 🩹

[English](README.md) · [Español](README_ES.md) · [日本語](README_JA.md)

A privacy-first, offline-capable web application created from a real school nursing workflow in Chile. It helps staff prepare the Chilean Individual School Accident Declaration, manage a local student list and generate the official-form PDF directly in the browser.

> **Portfolio edition:** the interface supports Spanish, English and Japanese. The generated Chilean official document remains in Spanish because translating it would not make the translated document legally equivalent in another country.

## Why this project exists
The original workflow relied heavily on paper and had no dedicated backend/database budget. The application was therefore designed as a client-side solution: student data and drafts remain in the browser, PDF generation happens locally, and the PWA can continue working offline.

## Features
- Spanish / English / Japanese interface with remembered language preference
- Chilean RUN validation and formatting
- Browser-side PDF generation
- Signature by touch, stylus or mouse, plus image upload
- Excel / XLS / CSV bulk student import and RUN-based auto-fill
- Local-only persistence using `localStorage`
- Responsive interface and installable PWA
- Offline support through a service worker
- Content Security Policy and Netlify security headers

## Architecture
This project intentionally uses a lightweight static architecture: HTML, CSS and vanilla JavaScript. There is no application backend. jsPDF is bundled locally for PDF generation and SheetJS is bundled locally for spreadsheet import.

## Internationalization
`js/i18n.js` provides a framework-independent i18n layer. Spanish remains the default because the original workflow is Chilean; English and Japanese are portfolio/international UI options. The selected language is stored locally.

## Privacy
The application does not require a remote database. Imported student data and form drafts are stored in the browser. **Do not commit real student spreadsheets, signatures, generated declarations, credentials or private school records to this repository.**

## Project structure
```text
index.html
css/styles.css
js/i18n.js
js/app.js
js/estudiantes.js
js/pdf.js
plantillas/Plantilla_Estudiantes.xlsx
tools/generar-plantilla.js
vendor/
sw.js
manifest.webmanifest
```

## Local use
For full PWA/service-worker behavior, serve the directory with a local HTTP server instead of opening `index.html` directly. For example, with VS Code Live Server or any static server.

## Important scope note
The accident declaration module models a **Chilean** school process. English and Japanese translations improve accessibility and demonstrate internationalization; they do not convert the Chilean document into a legally valid form for other jurisdictions.

## License / data
Source code can be reviewed as a portfolio project. Real student or patient data is not included. Before choosing an open-source license, verify that all bundled third-party assets and any official-form reproduction are compatible with the intended distribution.
