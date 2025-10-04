# 🗄️ ArchiFlow Database Access Guide

## 📊 Adminer Web UI (Recommended)

**Adminer** is now installed and running - a lightweight, single-page database management tool.

### Access Adminer:
```
http://localhost:8082
```

### Login Credentials:
- **Server**: `archiflow-postgres` (or `localhost` if accessing from host)
- **Username**: `archiflow_user`
- **Password**: `archiflow_pass`
- **Database**: `archiflow`

### Features in Adminer:
- Browse all tables visually
- Run SQL queries
- Export/Import data
- Edit records directly
- View table structures
- Manage indexes and foreign keys

---

## 🖥️ Command Line Access

### Direct PostgreSQL CLI:
```bash
docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow
```

### Common Commands:
```sql
-- List all tables
\dt archiflow.*;

-- View diagrams
SELECT id, title, site_name, status FROM archiflow.diagrams;

-- View specific diagram
SELECT * FROM archiflow.diagrams WHERE id = '55476b7a-61e9-4eb9-90f4-5291fac695ad';

-- View version history
SELECT * FROM archiflow.diagram_versions ORDER BY created_at DESC;

-- View sites
SELECT * FROM archiflow.sites;

-- Exit
\q
```

---

## 🔧 Alternative Database Tools

If you prefer other tools, you can connect using these settings:

### Connection Details:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `archiflow`
- **Schema**: `archiflow`
- **Username**: `archiflow_user`
- **Password**: `archiflow_pass`

### Compatible Tools:
1. **DBeaver** (Free, cross-platform)
2. **TablePlus** (Free tier available)
3. **pgAdmin 4** (Official PostgreSQL tool)
4. **HeidiSQL** (Windows, free)
5. **DataGrip** (JetBrains, paid)

---

## 📝 Quick SQL Queries

### Find all diagrams:
```sql
SELECT
    id,
    title,
    site_name,
    status,
    created_at,
    modified_at
FROM archiflow.diagrams
ORDER BY modified_at DESC;
```

### Get diagram with full XML:
```sql
SELECT
    id,
    title,
    diagram_data
FROM archiflow.diagrams
WHERE id = 'YOUR_DIAGRAM_ID';
```

### Check diagram sizes:
```sql
SELECT
    id,
    title,
    LENGTH(diagram_data) as size_bytes,
    ROUND(LENGTH(diagram_data)/1024.0, 2) as size_kb
FROM archiflow.diagrams
ORDER BY LENGTH(diagram_data) DESC;
```

### View version history for a diagram:
```sql
SELECT
    version_number,
    version_type,
    change_summary,
    created_at,
    created_by
FROM archiflow.diagram_versions
WHERE diagram_id = 'YOUR_DIAGRAM_ID'
ORDER BY version_number DESC;
```

### Database statistics:
```sql
SELECT
    'Total Diagrams' as metric,
    COUNT(*) as value
FROM archiflow.diagrams
UNION ALL
SELECT
    'Total Versions' as metric,
    COUNT(*) as value
FROM archiflow.diagram_versions
UNION ALL
SELECT
    'Total Sites' as metric,
    COUNT(*) as value
FROM archiflow.sites;
```

---

## 🐳 Docker Database Management

### Backup database:
```bash
docker exec archiflow-postgres pg_dump -U archiflow_user archiflow > backup.sql
```

### Restore database:
```bash
docker exec -i archiflow-postgres psql -U archiflow_user archiflow < backup.sql
```

### View database logs:
```bash
docker logs archiflow-postgres --tail 50
```

### Connect to database container:
```bash
docker exec -it archiflow-postgres bash
```

---

## 🎯 Quick Actions in Adminer

1. **View all diagrams**:
   - Click on `archiflow` schema
   - Click on `diagrams` table
   - Click "Select data"

2. **Run custom query**:
   - Click "SQL command" in top menu
   - Enter your SQL
   - Click "Execute"

3. **Export data**:
   - Select table
   - Click "Export"
   - Choose format (SQL, CSV, etc.)

4. **Edit diagram**:
   - Browse to diagrams table
   - Click "Edit" next to any row
   - Modify fields
   - Click "Save"

---

## ⚠️ Important Notes

- **Schema**: All tables are in the `archiflow` schema
- **Primary Key**: Diagrams use UUID for global uniqueness
- **Diagram Data**: Stored as TEXT (no size limit)
- **Auto-versioning**: Updates create automatic versions
- **Timestamps**: All tables have created_at/modified_at

---

## 🔗 Access URLs Summary

| Service | URL | Purpose |
|---------|-----|---------|
| **Application** | http://localhost:8081 | Main diagram editor |
| **Adminer** | http://localhost:8082 | Database management UI |
| **WebSocket** | ws://localhost:3333 | Real-time backend |
| **PostgreSQL** | localhost:5432 | Direct database connection |