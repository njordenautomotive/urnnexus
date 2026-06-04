# URN Nexus Web

Web-basert portal for rive-anbud-appliance.

Mål:
- Innlogging
- OneDrive prosjektoversikt
- Filbrowser
- Dokumentvisning
- Analysekjøring
- Rapportvisning
- Status og logging

Backend:
- FastAPI

Frontend:
- Next.js

Analyse:
- Integrasjon mot eksisterende appliance

## Fase 1: Appliance Integration API

Målet i denne fasen er å lese eksisterende appliance-data uten å starte nye analyser.

API-et eksponerer:

- `GET /api/health`
- `GET /api/projects`
- `GET /api/projects/{project_name}`
- `GET /api/projects/{project_name}/reports`
- `GET /api/projects/{project_name}/files`

Start lokalt:

```bash
.venv/bin/uvicorn backend.main:app --reload
```
