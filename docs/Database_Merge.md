# Database Merge — PostgreSQL Consolidation

**Date:** 2026-05-02  
**Server:** 62.217.178.173 (homosapience.org)

## Summary

Consolidated all databases from Docker PostgreSQL 18 into the system PostgreSQL 16 instance.  
Docker pg-18 container and volume were removed after successful migration.

---

## Before

| Instance | Port | Databases with data |
|----------|------|---------------------|
| System pg-16 | 5432 | safety_db, delivery_db, baikal_love_db, seismonet_db, myepa_db, and others |
| Docker pg-18 | 5433 | aggregator_db (67 MB), baikal_yachts_db (62 MB), wiki_db, zenyaspa_db |

## After

| Instance | Port | All databases |
|----------|------|---------------|
| System pg-16 | 5432 | ALL databases (see list below) |
| Docker pg-18 | — | **Removed** |

---

## Final Database List (pg-16, port 5432)

| Database | Size | Project |
|----------|------|---------|
| aggregator_db | 61 MB | aggregator service |
| baikal_yachts_db | 57 MB | baikal.yachts |
| safety_db | 24 MB | worldsafetyindex.org |
| baikal_love_db | 12 MB | baikal.love |
| seismonet_db | 10 MB | seismonet project |
| myepa_db | 10 MB | myepa project |
| mongol_db | 9.8 MB | mongol project |
| delivery_db | 9.6 MB | lastmiles.ru |
| satconnect_db | 9.2 MB | satconnect project |
| sokolred_gps_db | 8.9 MB | sokolred GPS |
| fintrack_db | 8.8 MB | fintrack project |
| forest_db | 8.7 MB | forest project |
| wiki_db | 8.7 MB | wiki.baikal.link |
| virtual_gallery_db | 8.5 MB | virtual gallery |
| onlyyou_db | 8.4 MB | onlyyou project |
| marketsat_db | 7.9 MB | marketsat project |
| zenyaspa_db | 7.9 MB | zenya.spa |
| meteo_db | 7.9 MB | meteo project |
| night_db | 7.8 MB | night project |

---

## Migration Steps

1. **Backup** — full dump of both instances saved to `/home/tulubyev/db_backups/migration_20260502/`
2. **Stop apps** — wiki.js (Docker), baikal.yachts backend (process)
3. **Transfer** — pg_dump from pg-18 → psql into pg-16 for: baikal_yachts_db, aggregator_db, wiki_db, zenyaspa_db
4. **Fix users** — created `wikijs_user` in pg-16, granted schema permissions
5. **Update configs** — baikal.yachts `.env`: port 5433 → 5432; wiki.js docker-compose: DB_HOST → 172.28.0.1
6. **Restart** — baikal-backend added to PM2 under tulubyev user; wiki.js restarted
7. **Remove** — Docker pg-18 container and volume deleted

---

## Backups Location

```
/home/tulubyev/db_backups/migration_20260502/
  pg16_full_backup.sql   — 21 MB (system pg-16 before migration)
  pg18_full_backup.sql   — 74 MB (Docker pg-18 full dump)
  baikal_yachts_db.sql   — individual database backup
  aggregator_db.sql      — individual database backup
  wiki_db.sql            — individual database backup
  zenyaspa_db.sql        — individual database backup
```

---

## Connection Info

All projects now connect to:
- **Host:** `localhost` (or `172.28.0.1` from Docker containers)
- **Port:** `5432`
- **Superuser:** `tulubyev`

### pgAdmin Access
- URL: https://pgadmin.baikal.link
- Email: alt@baikal.link
- Add server: Host `172.28.0.1`, Port `5432`, User `tulubyev`
