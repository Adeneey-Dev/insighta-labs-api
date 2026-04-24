# Insighta Labs Intelligence Query API

A NestJS + PostgreSQL REST API for querying demographic profile data with advanced filtering, sorting, pagination, and natural language search.

## Stack
- NestJS (Node.js framework)
- PostgreSQL with TypeORM
- UUID v4 for primary keys

## Setup

```bash
npm install
cp .env.example .env
# Fill in your DB credentials in .env
npm run start:dev
```

## Endpoints

### GET /api/profiles
Query profiles with filters, sorting, and pagination.

**Filters:** `gender`, `age_group`, `country_id`, `min_age`, `max_age`, `min_gender_probability`, `min_country_probability`  
**Sorting:** `sort_by` (age | created_at | gender_probability), `order` (asc | desc)  
**Pagination:** `page` (default: 1), `limit` (default: 10, max: 50)

### GET /api/profiles/search?q=...
Natural language query endpoint.

## Natural Language Parsing Approach

The parser uses rule-based keyword matching via regex patterns. No AI or LLM is used.

### Supported keywords and their mappings

| Keyword / Phrase | Filter Applied |
|---|---|
| `males`, `male` | gender = male |
| `females`, `female`, `women`, `girls` | gender = female |
| `male and female`, `both` | no gender filter |
| `children`, `kids` | age_group = child |
| `teenagers`, `teens` | age_group = teenager |
| `adults` | age_group = adult |
| `seniors`, `elderly` | age_group = senior |
| `young` (not "young adult") | min_age = 16, max_age = 24 |
| `above 30`, `over 30`, `older than 30` | min_age = 30 |
| `below 18`, `under 18`, `younger than 18` | max_age = 18 |
| `between 20 and 40` | min_age = 20, max_age = 40 |
| `aged 25` | min_age = 25, max_age = 25 |
| `from nigeria`, `in kenya` | country_id = NG / KE |

Countries are matched from a hardcoded map of ~30 common African and global countries.

### How the logic works
1. The query string is lowercased and trimmed
2. Gender patterns are checked first (regex)
3. Age group keywords are checked
4. Explicit age range patterns (above/below/between) override group keywords for min/max
5. Country phrases (`from X`, `in X`) are matched; fallback scans for any known country name
6. If no filter is extracted, an error is returned

### Limitations
- Does not understand synonyms not in the keyword list (e.g. "boys" is not mapped)
- Country names not in the hardcoded map will not be recognized
- Cannot handle compound queries like "Nigerians who are adults but not seniors"
- Does not support ISO country code input (e.g. "from NG" won't work)
- Does not handle negation (e.g. "not from Nigeria")
- "young adult" is treated as `adult`, not `young`
- Age ranges derived from age group keywords are not mixed with explicit `above/below` constraints — explicit constraints take priority
- Multiple countries in a single query resolves to the first match found