# NexAI — Examination Management System

A fully digitized, AI-augmented examination management ecosystem built for universities and engineering colleges.

## Monorepo Structure

| Directory | Stack | Purpose |
|---|---|---|
| `BackEnd/` | Django 5 + DRF + Channels | REST API, WebSocket, AI task workers |
| `FrontEnd/` | React 18 + Vite + TypeScript | 5 role-isolated web dashboards |
| `Apps/` | Flutter 3 + Dart | Invigilator Scanner + Student Sandbox |

## Dashboards

1. **CoE Command Center** (Web) — Master admin control plane
2. **HOD Dashboard** (Web) — Eligibility gateway & hall-ticket issuance
3. **Setter Workspace** (Web) — Secure question paper authoring
4. **Invigilator Scanner** (Mobile) — Geofenced booklet scanning app
5. **Evaluator Dashboard** (Web) — AI-assisted grading canvas
6. **Proctor Console** (Web) — Live multi-modal proctoring feed
7. **Student Portal** (Mobile + Web) — Exam sandbox & result hub

## Quick Start

```bash
# Start all services (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Backend
cd BackEnd

# Create a virtual environment (Note: Python 3.11 is required)
py -3.11 -m venv venv

# Activate the virtual environment (PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Setup Database
python manage.py makemigrations
python manage.py migrate

# Start Server
python manage.py runserver

# Frontend
cd FrontEnd
pnpm install
pnpm run dev

# Mobile (Flutter)
cd Apps
flutter pub get
flutter run
```

## Tech Stack

- **Backend**: Django 5, Django REST Framework, Django Channels, Celery, Redis
- **Databases**: PostgreSQL 16, Redis 7
- **Storage**: MinIO (S3-compatible)
- **AI/ML**: HuggingFace BERT, YOLOv8, FaceNet, DEAP (Genetic Algorithm)
- **Web**: React 18, Vite, TypeScript, Zustand, Axios
- **Mobile**: Flutter 3, Dart, Riverpod
- **DevOps**: Docker, Docker Compose, Nginx
