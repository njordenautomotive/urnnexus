# URN Nexus Web

URN Nexus Web er hovedproduktet. Denne repoen inneholder en FastAPI-backend som leser data fra den eksisterende rive-anbud-appliance, og et Vite React-frontend som viser ekte API-data uten mocker.

Frontend er bevisst holdt enkel og OneDrive-lignende:

- smal venstremeny
- liste/tabellvisning for prosjekter
- filtre for filtyper og filstruktur
- rapporter fra `Kommentarer`-mappen
- ingen analyseknapp og ingen IFC-viewer ennå
- data leses fra lokal appliance-cache, ikke direkte fra OneDrive

## Arkitektur

- `backend/` - FastAPI, Pydantic-modeller, logging og lesende appliance-integrasjon
- `frontend/` - Vite React MVP med dashboard, prosjektliste, prosjektdetaljer, filer, rapporter og health-visning
- `tests/` - Python-tester for backend/API-laget

## API

Backend eksponerer disse lesende endepunktene:

- `GET /api/health`
- `GET /api/projects`
- `GET /api/projects/{project_name}`
- `GET /api/projects/{project_name}/reports`
- `GET /api/projects/{project_name}/files`
- `GET /api/projects/{project_name}/debug-paths`

## Starte lokalt

### 1. Start backend

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload
```

Backend kjører normalt på `http://127.0.0.1:8000`.

Hvis du oppretter en ny venv eller oppdaterer OneDrive-/Graph-avhengigheter, installer appliance-pakkene også:

```bash
python -m pip install -r /home/anbudklient/appliance/requirements.txt
```

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend kjører normalt på `http://127.0.0.1:5173` og proxyer `/api` til backend.

Standardvisningen skjuler sample-prosjekter. Hvis du vil se dem i frontend under utvikling, sett:

```bash
export VITE_SHOW_SAMPLE_PROJECTS=true
```

Hvis backend ligger på en annen adresse, kan du sette:

```bash
export VITE_BACKEND_URL=http://127.0.0.1:8000
```

## Bygg og tester

```bash
python -m pytest
cd frontend
npm test
npm run build
```

## Status

- Ingen innlogging ennå
- Ingen analyseknapp ennå
- Ingen IFC-viewer ennå
- Frontend bruker ekte API-data hele veien
