# AGENTS.md

## Project Overview

School Nursing System is an international HealthTech/EdTech portfolio project originally created to solve a real workflow problem in a Chilean school nursing office.

The application is a client-side PWA designed to work locally and offline without requiring a backend.

## Core Rules

- Preserve support for Spanish (ES), English (EN), and Japanese (JA).
- Spanish is the default application language.
- New technical documentation, code identifiers, comments, and commit messages should preferably be written in English.
- Do not remove or degrade any of the three supported languages.
- After UI changes, verify ES, EN, and JA layouts.

## Chilean Accident Declaration

- The generated Chilean School Accident Declaration PDF must remain in Spanish.
- Do not translate or modify official/legal terminology merely to internationalize the application.
- The internationalized UI and the Chilean official document are separate concerns.
- Preserve the existing PDF generation behavior unless the task explicitly requires changes.

## Privacy and Sensitive Data

Never commit or introduce real:

- Student names.
- RUN/RUT numbers.
- Addresses.
- Medical information.
- Signatures.
- School records containing personal information.
- Real Excel/CSV student databases.
- Credentials, API keys, tokens, or secrets.

Use fictional data for development, tests, screenshots, and documentation.

## Architecture

Preserve the current lightweight architecture unless explicitly instructed otherwise.

Do not:

- Migrate the project to React, Angular, Vue, or another framework without explicit authorization.
- Add a backend without explicit authorization.
- Add external cloud services or databases without explicit authorization.
- Introduce unnecessary dependencies.

The application should continue to support:

- Local/offline operation.
- PWA functionality.
- Local browser storage.
- Excel/CSV student import.
- RUN validation.
- Student auto-fill.
- Signature handling.
- PDF generation.

## Development Guidelines

- Prefer small, focused, reversible changes.
- Do not modify unrelated functionality.
- Reuse existing project patterns before introducing new abstractions.
- Keep accessibility and responsive behavior intact.
- Avoid unnecessary complexity.
- Preserve compatibility with static hosting.

## Internationalization

All user-facing application strings should use the existing i18n system.

When adding or changing a user-facing string:

1. Add/update the Spanish translation.
2. Add/update the English translation.
3. Add/update the Japanese translation.
4. Verify placeholders, validation messages, dialogs, status messages, and dynamic JavaScript content.
5. Ensure Japanese text is natural and appropriate for a professional application.

Do not hardcode new user-facing strings in only one language.

## Verification

Before considering a task complete:

- Check for JavaScript syntax/runtime errors.
- Verify that PDF preview still works.
- Verify PDF download when relevant.
- Verify ES / EN / JA when UI text was affected.
- Verify Excel/CSV import when student-data functionality was affected.
- Verify offline/PWA behavior when service worker or caching code was affected.
- Check that no sensitive or local-only files were introduced.

If full verification cannot be performed, clearly state what was not tested.

## Scope Control

Do not perform broad refactors unless explicitly requested.

When asked to review or analyze the project, do not modify files unless modification is explicitly requested.

If a requested change could affect privacy, official document behavior, stored student data, or major architecture, explain the impact before implementing it.