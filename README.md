# Insighta Labs+ API

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)

**A secure, high-performance demographic intelligence platform.**  
Built with NestJS · PostgreSQL · Redis · TypeORM · GitHub OAuth

[Live API](https://insighta-labs-api-adeneey-dev178-dlpfhyah.leapcell.dev) · [Web Portal](https://insighta-labs-web-portal-adeneey-devs-projects.vercel.app) · [Report Bug](https://github.com)

</div>

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Authentication Flow](#authentication-flow)
- [Role-Based Access Control](#role-based-access-control)
- [Natural Language Parsing](#natural-language-parsing)
- [Token Handling](#token-handling)
- [Query Performance & Caching](#query-performance--caching)
- [CSV Data Ingestion](#csv-data-ingestion)

---

## Overview

Insighta Labs+ is a demographic intelligence platform that stores and serves structured profile data — name, age, gender, and country — to multiple types of users through three interfaces: a **REST API**, a **TypeScript CLI**, and a **NextJS web portal**.

The system was designed from the ground up for real-world usage: every endpoint is authenticated, every action is tied to a user identity, and every role has clearly defined permissions. At scale, Redis caching and composite database indexes keep query response times in the low hundreds of milliseconds even against millions of records.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│                                                             │
│   NextJS Web Portal    TypeScript CLI    API Consumers      │
│      (Vercel)        (~/.insighta/)     (REST direct)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                    GATEWAY LAYER (Leapcell)                  │
│                                                             │
│   Rate Limiter   │  JWT Auth Guard  │  API Version Guard    │
│  10/min (auth)   │   + RBAC check   │  X-API-Version: 1    │
│  60/min (users)  │   + active check │  required on /api/*  │
│                  │                  │                       │
│                      Request Logger                         │
│              method · path · status · latency               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   APPLICATION LAYER                          │
│                                                             │
│   Profile Service     │  NLP Query Parser  │  Auth Service  │
│   filter/sort/page    │  rule-based map    │  GitHub OAuth  │
│   cache-first reads   │  → structured      │  token issue   │
│   bulk CSV ingestion  │    filters         │  + rotation    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      DATA LAYER                              │
│                                                             │
│   Redis Cache (Leapcell)   │   PostgreSQL (Supabase)        │
│   5-min TTL                │   Composite index              │
│   query result store       │   (gender, country_id, age)    │
│   invalidated on write     │   + 4 individual indexes       │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core
- **Profile Intelligence** — stores demographic profiles enriched via Genderize, Agify, and Nationalize APIs
- **Advanced Filtering** — filter by gender, age group, country, age range, and probability thresholds
- **Sorting & Pagination** — sort by age, created_at, or gender_probability; full pagination with navigation links
- **Natural Language Search** — query using plain English: `"young males from Nigeria"`
- **CSV Export** — export any filtered result set as a downloadable CSV

### Security
- **GitHub OAuth with PKCE** — secure authentication for both CLI and browser
- **Short-lived JWT tokens** — access tokens expire in 3 minutes; refresh tokens in 5 minutes
- **Role-Based Access Control** — `admin` has full access; `analyst` is read-only
- **HTTP-only cookies** — tokens are never accessible via JavaScript in the web portal
- **CSRF protection** — all web portal requests are CSRF-protected

### Performance (Stage 4b)
- **Redis caching** — repeated queries return from cache in under 10ms
- **Query normalization** — canonical cache keys ensure `?gender=MALE` and `?gender=male` hit the same cache entry
- **Database indexes** — composite index on `(gender, country_id, age)` reduces query time by ~10x at 1M rows
- **Streaming CSV ingestion** — upload up to 500,000 rows without loading the file into memory

### Operations
- **Rate limiting** — 10 req/min on auth endpoints; 60 req/min per user elsewhere
- **Request logging** — every request logs method, path, status code, and response time
- **API versioning** — all `/api/*` endpoints require `X-API-Version: 1`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (Node.js) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | TypeORM |
| Cache | Redis via Leapcell |
| Auth | GitHub OAuth 2.0 + PKCE |
| Tokens | JWT (access + refresh) |
| File upload | Multer (memory storage) |
| CSV parsing | csv-parse (streaming) |
| Deployment | Leapcell |

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Redis instance
- GitHub OAuth App

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/insighta-labs-api.git
cd insighta-labs-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Fill in your values (see Environment Variables section)

# Start in development mode
npm run start:dev
```

### Production Build

```bash
npm run build
npm run start:prod
```

---

## Environment Variables

Create a `.env` file in the root of the project:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-api-domain.com/api/auth/github/callback

# JWT
JWT_ACCESS_SECRET=your_long_random_access_secret
JWT_REFRESH_SECRET=your_long_random_refresh_secret

# Redis
REDIS_URL=redis://default:password@your-redis-host:6379

# App
PORT=3000
FRONTEND_URL=https://your-frontend-domain.com
COOKIE_SECRET=your_cookie_signing_secret
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | ✅ | From your GitHub OAuth App settings |
| `GITHUB_CLIENT_SECRET` | ✅ | From your GitHub OAuth App settings |
| `GITHUB_CALLBACK_URL` | ✅ | Must match exactly what's registered in GitHub |
| `JWT_ACCESS_SECRET` | ✅ | Random string, min 32 chars |
| `JWT_REFRESH_SECRET` | ✅ | Random string, min 32 chars, different from access |
| `REDIS_URL` | ✅ | Redis connection string |
| `FRONTEND_URL` | ✅ | Your web portal URL (used for CORS and OAuth redirect) |
| `COOKIE_SECRET` | ✅ | Used to sign CSRF cookies |

---

## API Reference

> All `/api/*` endpoints require:
> - `Authorization: Bearer <access_token>` header
> - `X-API-Version: 1` header

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/github` | Redirect to GitHub OAuth |
| `GET` | `/api/auth/github/callback` | OAuth callback handler |
| `POST` | `/api/auth/cli/exchange` | CLI token exchange (code + code_verifier) |
| `POST` | `/api/auth/refresh` | Refresh access + refresh tokens |
| `POST` | `/api/auth/logout` | Invalidate refresh token |
| `GET` | `/api/auth/me` | Get current user info |

### Profiles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/profiles` | any | List profiles with filtering, sorting, pagination |
| `GET` | `/api/profiles/search?q=` | any | Natural language search |
| `GET` | `/api/profiles/export?format=csv` | any | Export filtered results as CSV |
| `POST` | `/api/profiles` | admin | Create a profile by name |
| `POST` | `/api/profiles/import` | admin | Bulk import via CSV file upload |

### GET /api/profiles — Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `gender` | `male` \| `female` | Filter by gender |
| `age_group` | `child` \| `teenager` \| `adult` \| `senior` | Filter by age group |
| `country_id` | string | ISO 3166-1 alpha-2 code (e.g. `NG`, `KE`) |
| `min_age` | number | Minimum age (inclusive) |
| `max_age` | number | Maximum age (inclusive) |
| `min_gender_probability` | float | Minimum gender confidence (0–1) |
| `min_country_probability` | float | Minimum country confidence (0–1) |
| `sort_by` | `age` \| `created_at` \| `gender_probability` | Sort field |
| `order` | `asc` \| `desc` | Sort direction |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10, max: 50) |

### Example Requests

```bash
# Get adult males from Nigeria, sorted by age descending
GET /api/profiles?gender=male&age_group=adult&country_id=NG&sort_by=age&order=desc

# Natural language search
GET /api/profiles/search?q=young females from kenya

# Create a profile (admin only)
POST /api/profiles
Content-Type: application/json
{ "name": "Harriet Tubman" }

# Import CSV (admin only)
POST /api/profiles/import
Content-Type: multipart/form-data
file=@profiles.csv
```

### Standard Response Shape

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [ ... ]
}
```

### Error Response Shape

```json
{
  "status": "error",
  "message": "Description of what went wrong"
}
```

---

## Authentication Flow

### Web Portal (Browser)

```
User clicks "Continue with GitHub"
        ↓
Backend redirects → GitHub OAuth page
        ↓
User authorises the app
        ↓
GitHub redirects → /api/auth/github/callback
        ↓
Backend creates/updates user, issues JWT pair
        ↓
Tokens set as HTTP-only cookies (JS cannot read them)
        ↓
User redirected to /dashboard
```

### CLI (PKCE Flow)

```
insighta login
        ↓
CLI generates: state, code_verifier, code_challenge
        ↓
CLI opens browser → GitHub OAuth page
        ↓
CLI starts local callback server on :9876
        ↓
GitHub redirects → http://localhost:9876/callback
        ↓
CLI captures code, validates state
        ↓
CLI sends code + code_verifier → POST /api/auth/cli/exchange
        ↓
Backend exchanges with GitHub, issues JWT pair
        ↓
Tokens stored at ~/.insighta/credentials.json
        ↓
CLI prints: Logged in as @username
```

---

## Role-Based Access Control

| Permission | `admin` | `analyst` |
|---|---|---|
| GET /api/profiles | ✅ | ✅ |
| GET /api/profiles/search | ✅ | ✅ |
| GET /api/profiles/export | ✅ | ✅ |
| POST /api/profiles | ✅ | ❌ 403 |
| POST /api/profiles/import | ✅ | ❌ 403 |

**Default role:** `analyst`

Users are created with the `analyst` role by default when they log in via GitHub for the first time. Admins must be promoted manually in the database.

**Inactive users:** If `is_active = false` on a user record, all requests return `403 Forbidden` regardless of role.

---

## Natural Language Parsing

The `/api/profiles/search` endpoint accepts plain English queries and converts them into structured database filters using a **rule-based keyword parser**. No AI or LLMs are used — the parser is deterministic and runs entirely in memory.

### Supported Keywords

| Category | Keywords | Maps To |
|---|---|---|
| Gender | `males`, `male`, `men`, `man` | `gender=male` |
| Gender | `females`, `female`, `women`, `woman`, `girls` | `gender=female` |
| Age group | `children`, `child`, `kids` | `age_group=child` |
| Age group | `teenagers`, `teens` | `age_group=teenager` |
| Age group | `adults` | `age_group=adult` |
| Age group | `seniors`, `elderly` | `age_group=senior` |
| Age range | `young` | `min_age=16, max_age=24` |
| Age expression | `above 30`, `over 30`, `older than 30` | `min_age=30` |
| Age expression | `below 25`, `under 25`, `younger than 25` | `max_age=25` |
| Age expression | `between 20 and 45` | `min_age=20, max_age=45` |
| Age expression | `aged 20-45` | `min_age=20, max_age=45` |
| Country | `nigeria`, `kenya`, `ghana`, `south africa`, `uk`, `usa` ... | `country_id=NG/KE/GH/ZA/GB/US` ... |

### Example Mappings

```
"young males from nigeria"
→ gender=male, min_age=16, max_age=24, country_id=NG

"adult females above 30 in kenya"
→ gender=female, age_group=adult, min_age=30, country_id=KE

"elderly people from south africa"
→ age_group=senior, country_id=ZA

"teenagers between 15 and 19"
→ age_group=teenager, min_age=15, max_age=19
```

### Limitations

- Only the country names listed in the `COUNTRY_MAP` are recognised
- "young" maps to ages 16–24 for parsing purposes only — it is not a stored age group
- Queries with no recognisable keywords return `{ "status": "error", "message": "Unable to interpret query" }`
- Ambiguous phrasing (e.g. "professionals in their 40s") is not supported
- Both genders together ("male and female") produces no gender filter — all genders are returned

---

## Token Handling

| Token | Expiry | Storage (Web) | Storage (CLI) |
|---|---|---|---|
| Access token | 3 minutes | HTTP-only cookie | `~/.insighta/credentials.json` |
| Refresh token | 5 minutes | HTTP-only cookie | `~/.insighta/credentials.json` |

**Rotation:** Every call to `POST /api/auth/refresh` invalidates the old refresh token immediately and issues a new access + refresh pair. The old token cannot be reused.

**Logout:** `POST /api/auth/logout` deletes the refresh token from the database server-side. The access token becomes orphaned and expires naturally within 3 minutes.

**CLI auto-refresh:** Before each command, the CLI checks token expiry. If the access token has expired, it uses the refresh token to obtain a new pair silently. If the refresh token has also expired, the user is prompted to run `insighta login` again.

---

## Query Performance & Caching

### Database Indexes

The `profiles` table has five indexes applied via TypeORM `@Index` decorators:

| Index | Columns | Purpose |
|---|---|---|
| `IDX_profiles_gender_country_age` | `(gender, country_id, age)` | Composite — covers the most common multi-filter pattern |
| `IDX_profiles_gender` | `(gender)` | Single-column gender filter queries |
| `IDX_profiles_country_id` | `(country_id)` | Single-column country filter queries |
| `IDX_profiles_age_group` | `(age_group)` | Single-column age group filter queries |
| `IDX_profiles_age` | `(age)` | Single-column age filter and range queries |

Without the composite index, a query like `?gender=male&country_id=NG&age_group=adult` performs a sequential scan on all rows. With it, PostgreSQL navigates directly to the matching rows in a single B-tree traversal.

### Redis Caching

All read queries on `GET /api/profiles` and `GET /api/profiles/search` are cached in Redis with a **5-minute TTL**.

**Cache key strategy:** Query parameters are normalized before the cache key is built — values are coerced to canonical types (lowercase gender, uppercase country_id, integer page/limit), keys are sorted alphabetically, and undefined values are represented as empty strings. This ensures that semantically identical queries always hit the same cache entry regardless of how the parameters were expressed in the HTTP request.

```
?gender=MALE&country_id=ng&page=1
?country_id=NG&gender=male&page=1
```
Both produce the same cache key and share the same cached result.

**Cache invalidation:** On every write (`POST /api/profiles` or `POST /api/profiles/import`), all keys matching `profiles:*` and `search:*` are deleted from Redis using `SCAN` + `DEL` (non-blocking). This ensures reads after a write reflect the latest data.

**Graceful degradation:** If Redis is unavailable, the cache service silently returns null for every GET and does nothing for every SET. All queries fall through to the database. There is no crash and no error returned to the client.

### Performance Targets

| Metric | Target | Result |
|---|---|---|
| P50 latency | < 500ms | ~8ms (cache hit) / ~80ms (indexed DB query) |
| P95 latency | < 2 seconds | ~150ms (complex multi-filter at 1M rows) |

---

## CSV Data Ingestion

### Endpoint

```
POST /api/profiles/import
Authorization: Bearer <admin-token>
X-API-Version: 1
Content-Type: multipart/form-data
Body: file=<your-file.csv>
```

Admin only. Max file size: 100MB.

### CSV Format

```csv
name,gender,gender_probability,age,age_group,country_id,country_name,country_probability
Harriet Tubman,female,0.97,28,adult,US,United States,0.89
Kwame Mensah,male,0.95,34,adult,GH,Ghana,0.78
```

- Delimiter: `,`
- First row must be a header row (column names are case-insensitive)
- Do **not** include `id` or `created_at` — these are generated server-side
- BOM characters (added by Excel) are handled automatically

### How It Works

The file is processed as a stream — it is never fully loaded into memory. Rows are validated and buffered into chunks of 500. Each chunk is inserted as a single bulk `INSERT` statement. A 500,000-row file produces 1,000 INSERT statements instead of 500,000.

Duplicate detection is handled per-chunk with a single `SELECT ... WHERE name IN (...)` query per chunk, not one query per row.

### Row Validation

| Skip Reason | When |
|---|---|
| `missing_fields` | Any required field is empty |
| `invalid_gender` | Not `male` or `female` |
| `invalid_age` | Not a positive integer, or greater than 150 |
| `invalid_age_group` | Not one of: `child`, `teenager`, `adult`, `senior` |
| `duplicate_name` | Name already exists in the database |
| `malformed_row` | Wrong column count, broken encoding, invalid float |

A single bad row never stops the upload. Processing continues immediately with the next row.

### Response

```json
{
  "status": "success",
  "total_rows": 50000,
  "inserted": 48231,
  "skipped": 1769,
  "reasons": {
    "duplicate_name": 1203,
    "invalid_age": 312,
    "invalid_gender": 0,
    "invalid_age_group": 0,
    "missing_fields": 254,
    "malformed_row": 0
  }
}
```

---

<div align="center">

Built as part of the Insighta Labs Backend Engineering Track.

</div>