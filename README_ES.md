# Sistema de Enfermería Escolar 🩹

[English](README.md) · [Español](README_ES.md) · [日本語](README_JA.md)

Aplicación web centrada en privacidad y funcionamiento offline, nacida de un flujo real de enfermería escolar en Chile. Permite preparar la Declaración Individual de Accidente Escolar, mantener una base local de estudiantes y generar el PDF directamente en el navegador.

> **Edición de portafolio:** la interfaz está disponible en español, inglés y japonés. El documento oficial chileno generado se mantiene en español, ya que una traducción no lo convertiría en un documento legal equivalente para otro país.

## Decisión técnica
La institución no contaba con infraestructura ni presupuesto para mantener un backend o base de datos dedicada. Por eso se diseñó una solución client-side: los datos y borradores permanecen en el navegador, el PDF se genera localmente y la PWA puede seguir funcionando sin conexión.

## Funcionalidades
- Interfaz ES / EN / JA con preferencia de idioma persistente
- Validación y formato de RUN chileno
- Generación de PDF en el navegador
- Firma con dedo, lápiz o mouse y carga de imagen
- Importación masiva Excel / XLS / CSV y autocompletado por RUN
- Persistencia local mediante `localStorage`
- Diseño responsive y PWA instalable
- Funcionamiento offline mediante Service Worker
- Content Security Policy y cabeceras de seguridad

## Internacionalización
`js/i18n.js` implementa una capa i18n independiente de frameworks. Español continúa como idioma predeterminado por el contexto chileno original; inglés y japonés permiten presentar la interfaz internacionalmente.

## Privacidad
No se necesita una base de datos remota. Los datos importados y borradores permanecen en el navegador. **Nunca deben subirse al repositorio planillas reales de estudiantes, firmas, declaraciones generadas, credenciales ni documentos privados del colegio.**

## Alcance
El módulo de accidentes representa un proceso **chileno**. Las traducciones de la interfaz no convierten el formulario oficial en un documento válido para otras jurisdicciones.
