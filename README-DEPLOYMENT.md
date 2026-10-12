# Shobha Education Trust — Production Containerization & Deployment Guide

This guide details the Docker containerization setup and deployment procedures for the **Shobha Education Trust** institutional portal and administration desk.

---

## Architecture Overview

The application is containerized using two production patterns:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE ARCHITECTURE                     │
│                                                                        │
│   Incoming Traffic (:80)                                               │
│             │                                                          │
│             ▼                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Frontend Container (nginx:1.27-alpine)                       │   │
│   │  - Serves compiled static assets (HTML/CSS/JS/Images)          │   │
│   │  - Gzip compression & 30-day static asset cache headers        │   │
│   │  - Reverse-proxies /api/ and /uploads/ to backend:5001         │   │
│   └───────────────────────────┬────────────────────────────────────┘   │
│                               │                                        │
│                               ▼                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Backend Container (node:22-alpine)                            │   │
│   │  - Express 5 REST API & JWT Admin Authentication               │   │
│   │  - Razorpay, Resend Email, and Student Payments Engine        │   │
│   │  - Persistent Volume: uploads_data (/app/data/uploads)         │   │
│   └───────────────────────────┬────────────────────────────────────┘   │
│                               │                                        │
│                               ▼                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Database Container (mongo:7.0)                                │   │
│   │  - MongoDB 7.0 database engine                                 │   │
│   │  - Persistent Volume: mongo_data (/data/db)                    │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Multi-Container Stack (`docker-compose.yml`)**:
   - `frontend`: High-performance Nginx web server handling static assets, browser caching, and reverse-proxying API calls.
   - `backend`: Node.js 22 LTS container running the Express API with rate limiting and security headers.
   - `mongo`: Official MongoDB 7.0 container with persistent volume storage.

2. **All-in-One Single Container (`Dockerfile`)**:
   - Multi-stage Dockerfile that builds the Vite frontend and runs the Node.js backend.
   - Suitable for PaaS hosting services (e.g., Render Web Services, Railway, Fly.io, AWS App Runner, DigitalOcean App Platform).

---

## File Structure

| File | Purpose |
| :--- | :--- |
| `docker-compose.yml` | Multi-container composition for MongoDB, Backend API, and Nginx Frontend |
| `Dockerfile.backend` | Lightweight Node.js 22 production image for the backend API |
| `Dockerfile.frontend` | Multi-stage build (Vite compilation -> Nginx Alpine runtime) |
| `Dockerfile` | All-in-one multi-stage image for single-container PaaS hosting |
| `nginx/default.conf` | Nginx reverse proxy, security headers, gzip, and static asset caching |
| `.dockerignore` | Build context exclusions (`node_modules`, `.git`, `dist`, logs) |

---

## Quickstart: Running Locally with Docker Compose

### 1. Prerequisites
- Docker Engine 24+ and Docker Compose v2+ installed.
- Ensure ports `80` (or custom `FRONTEND_PORT`) and `5001` (or custom `BACKEND_PORT`) are available.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` or set required environment variables:
```bash
cp .env.example .env
```

Key environment variables:
```env
# Security
JWT_SECRET=your_strong_random_jwt_secret_here
SESSION_SECRET=your_strong_session_secret_here

# Initial Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@Shobha2026

# Email Integration (Resend)
RESEND_API_KEY=re_your_api_key
ENQUIRY_RECIPIENT_EMAIL=admissions@yourdomain.org

# Ports (Optional overrides)
FRONTEND_PORT=80
BACKEND_PORT=5001
```

### 3. Build & Launch Containers
```bash
docker compose up --build -d
```

### 4. Verify Services
- **Main Website**: [http://localhost](http://localhost)
- **Admin Portal**: [http://localhost/admin/](http://localhost/admin/)
- **Backend Health Check**: [http://localhost/api/health](http://localhost/api/health)
- **Container Logs**:
  ```bash
  docker compose logs -f backend
  ```

### 5. Stop Containers
```bash
docker compose down
```
*(Data in MongoDB and uploaded student files remain preserved in `set_mongo_data` and `set_uploads_data` volumes).*

---

## Deployment to Cloud Platforms

### A. Single-Container PaaS (Render / Railway / Fly.io / Heroku)
1. Point the platform service to your GitHub repository.
2. Select **Docker** as the runtime environment (the root [Dockerfile](file:///Users/harshsingh/Desktop/college/Dockerfile) will be picked automatically).
3. Connect an external MongoDB database (e.g., MongoDB Atlas) and set `MONGODB_URI` in the platform's Environment Variables dashboard.
4. Set `PORT` (assigned automatically by Render/Railway) and `JWT_SECRET`.

### B. Virtual Private Server (VPS / AWS EC2 / DigitalOcean Droplet / Hetzner)
1. Clone the repository onto the server.
2. Ensure Docker and Docker Compose are installed.
3. Configure your production domain in `nginx/default.conf` or terminate SSL using Certbot / Cloudflare.
4. Run:
   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```

---

## Volume Maintenance & Backup

- **Database Backup**:
  ```bash
  docker exec -t set-mongodb mongodump --out /data/db/backup_$(date +%Y%m%d)
  ```
- **Uploads Backup**:
  ```bash
  docker run --rm -v set_uploads_data:/volume -v $(pwd):/backup alpine tar -czf /backup/uploads_backup.tar.gz -C /volume .
  ```
