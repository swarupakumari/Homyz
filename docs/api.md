# API Reference

Base URL (local development): `http://localhost:8000/api` (the `PORT` in `server/.env`, currently `8000`; the code default is `3000` if `PORT` is unset).

All request/response bodies are JSON unless noted. Authenticated endpoints require an `Authorization: Bearer <token>` header containing a valid Auth0-issued access token.

> **Note on error formatting**: this API predates a global JSON error-handling middleware. Endpoints built in Sprint 2A/2B/2C (`search`, `ai/search`) return consistent `{success: false, message}` JSON on error. Older endpoints (`create`, `bookVisit`, `cancelBooking`, etc.) mostly rely on Express's default error handler for unexpected failures, which does **not** guarantee a JSON body — this is called out per-endpoint below.

---

## Table of Contents

- [Authentication](#authentication)
- [Property APIs](#property-apis)
  - [Create Property](#post-apiresidencycreate)
  - [List All Properties](#get-apiresidencyallresd)
  - [Get Property by ID](#get-apiresidencyid)
- [Search API](#search-api)
  - [Structured Search](#get-apiresidencysearch)
- [AI Search API (includes Recommendations)](#ai-search-api-includes-recommendations)
  - [AI Property Search](#post-apiaisearch)
- [User APIs](#user-apis)
  - [Register User](#post-apiuserregister)
  - [Book a Visit](#post-apiuserbookvisitid)
  - [Get All Bookings](#post-apiuserallbookings)
  - [Cancel a Booking](#post-apiuserremovebookingid)
  - [Toggle Favorite](#post-apiusertofavrid)
  - [Get All Favorites](#post-apiuserallfav)

---

## Authentication

Homyz does not have its own login endpoint — **Auth0 Universal Login handles authentication entirely on the frontend** (`@auth0/auth0-react`). The backend never receives a password; it only verifies a JWT access token that the frontend already obtained from Auth0.

| | |
|---|---|
| **Verification middleware** | `express-oauth2-jwt-bearer` (`server/config/auth0Config.js`), exported as `jwtCheck` |
| **Algorithm** | RS256 |
| **Applied** | Per-route (not globally) — see the "Auth" column on each endpoint below |
| **On missing/invalid token** | `jwtCheck` responds `401 Unauthorized` before the route handler runs |

To sync an Auth0-authenticated user into the app's own `User` collection, the frontend calls [`POST /api/user/register`](#post-apiuserregister) once per login (see `Layout.jsx`).

---

## Property APIs

### `POST /api/residency/create`

Creates a new property listing.

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{
  "data": {
    "title": "Coastal Breeze Villa",
    "description": "A beautiful villa near the coast.",
    "price": 8000,
    "address": "Street 2",
    "country": "Pakistan",
    "city": "Multan",
    "facilities": { "bedrooms": 4, "bathrooms": 5, "parkings": 1 },
    "image": "https://example.com/image.jpg",
    "userEmail": "owner@example.com"
  }
}
```

**Response `200`**

```json
{
  "message": "Residency created successfully",
  "residency": {
    "id": "64392e0bdfd90fb29e464fbc",
    "title": "Coastal Breeze Villa",
    "price": 8000,
    "...": "..."
  }
}
```

**Errors**

| Condition | Behavior |
|---|---|
| Duplicate `(address, userEmail)` (Prisma `P2002`) | Throws `"A residency with address already there"` — surfaced via Express's default error handler (no dedicated JSON error middleware exists yet; effectively a `500` with that message in the body/stack). |
| Any other database error | Same default-handler behavior, propagating `err.message`. |
| Missing/invalid Bearer token | `401` from `jwtCheck`. |

---

### `GET /api/residency/allresd`

Returns every property listing, newest first. **Not paginated.**

| | |
|---|---|
| **Auth** | — Public |
| **Query params** | None |

**Response `200`** — a bare array (not wrapped in `{success, data}`):

```json
[
  {
    "id": "64392e0bdfd90fb29e464fbc",
    "title": "Coastal Breeze Villa",
    "description": "...",
    "price": 8000,
    "address": "Street 2",
    "city": "Multan",
    "country": "Pakistan",
    "image": "https://...",
    "facilities": { "bathrooms": "5", "parking": "1", "bedrooms": "4" },
    "userEmail": "owner@example.com",
    "createdAt": "2023-04-14T10:42:19.231Z",
    "updatedAt": "2023-04-14T10:42:19.231Z"
  }
]
```

**Errors**

| Status | Body |
|---|---|
| `500` | `{ "message": "Server Error, Could not retrieve residencies." }` |

---

### `GET /api/residency/:id`

Fetches a single property by its MongoDB ObjectId.

| | |
|---|---|
| **Auth** | — Public |

**Response `200`** — the residency object, or `null` if no property with that ID exists (Prisma `findUnique` returns `null`, which is sent as-is with a `200` status).

**Errors**

Unexpected database errors propagate via Express's default handler (no dedicated JSON shape).

---

## Search API

### `GET /api/residency/search`

The dedicated, backend-driven property search (Sprint 2A) — replaces the earlier pattern of fetching every property and filtering with `Array.filter()` in the browser. All filtering happens at the database level (Prisma `where` for scalar fields, native MongoDB `aggregateRaw` for the JSON `facilities` fields — see [docs/architecture.md](architecture.md#search-architecture)).

| | |
|---|---|
| **Auth** | — Public |

**Query parameters** (all optional; omit any you don't want to filter on)

| Param | Type | Matching |
|---|---|---|
| `city` | string | Case-insensitive substring |
| `country` | string | Case-insensitive substring |
| `minPrice` | number | `price >= minPrice` |
| `maxPrice` | number | `price <= maxPrice` |
| `bedrooms` | number | Exact match against `facilities.bedrooms` (matches both string- and number-typed stored values) |
| `bathrooms` | number | Exact match against `facilities.bathrooms` |
| `keyword` | string | Case-insensitive substring across `title`, `description`, `address` |

**Example request**

```
GET /api/residency/search?city=Multan&bedrooms=4&keyword=villa
```

**Response `200`**

```json
{
  "success": true,
  "total": 1,
  "filters": { "city": "Multan", "bedrooms": 4, "keyword": "villa" },
  "data": [
    {
      "id": "64392e0bdfd90fb29e464fbc",
      "title": "Coastal Breeze Villa",
      "price": 8000,
      "city": "Multan",
      "country": "Pakistan",
      "facilities": { "bathrooms": "5", "parking": "1", "bedrooms": "4" },
      "...": "..."
    }
  ]
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "success": false, "message": "Invalid value for 'minPrice': must be a number" }` | A numeric param (`minPrice`/`maxPrice`/`bedrooms`/`bathrooms`) failed to parse as a number |

---

## AI Search API (includes Recommendations)

There is no separate "Recommendation API" endpoint — the Recommendation Engine (Sprint 3) runs *inside* `POST /api/ai/search`, after the Search Service returns matches, and its output (`recommendations`) is part of this same response.

### `POST /api/ai/search`

Accepts a natural-language property request, extracts structured search filters via OpenAI (never touching the database directly), passes those filters to the same Search Service used by [`GET /api/residency/search`](#get-apiresidencysearch), and returns the matched properties **ranked by a deterministic recommendation score** with human-readable, non-hallucinated match reasons and an optional AI-generated one-sentence explanation.

| | |
|---|---|
| **Auth** | — Public |
| **Timeout** | Frontend client sets a 25s Axios timeout; the OpenAI client itself times out at 20s |

**Request body**

```json
{ "prompt": "Need a 3 bedroom apartment under 80 lakh in Kolkata" }
```

| Field | Type | Constraints |
|---|---|---|
| `prompt` | string | Required, non-empty after trimming, ≤ 500 characters |

**Response `200`**

```json
{
  "success": true,
  "summary": "Found 1 matching property.",
  "parsedFilters": {
    "city": "Kolkata",
    "maxPrice": 8000000,
    "bedrooms": 3,
    "keyword": "apartment"
  },
  "recommendations": [
    {
      "score": 94,
      "reasons": [
        "Within your budget",
        "Matches requested bedrooms",
        "Located in requested city",
        "Parking available"
      ],
      "explanation": "This property is an excellent match because it fits your budget, is in your requested city, includes the requested number of bedrooms, and offers parking.",
      "property": {
        "id": "64392e0bdfd90fb29e464fbc",
        "title": "Coastal Breeze Villa",
        "price": 8000,
        "city": "Multan",
        "country": "Pakistan",
        "facilities": { "bathrooms": "5", "parking": "1", "bedrooms": "4" },
        "...": "..."
      }
    }
  ]
}
```

**Response field reference**

| Field | Description |
|---|---|
| `summary` | Plain-English count, e.g. `"Found 3 matching properties."` |
| `parsedFilters` | The structured filters the AI extracted from the prompt — only fields the model actually detected are present (never fabricated). |
| `recommendations` | Array, **sorted descending by `score`**. |
| `recommendations[].score` | Integer 0–100. Normalized against only the criteria that were both requested and evaluable for this search — see [docs/ai.md](ai.md#scoring-algorithm). |
| `recommendations[].reasons` | Deterministic strings drawn directly from real property/filter data — never LLM-generated, never fabricated. |
| `recommendations[].explanation` | One friendly sentence rephrasing `reasons`. Real OpenAI output for the top 5 ranked results; a deterministic `"Good match: ..."` fallback sentence otherwise (or `null` if `reasons` is empty). |
| `recommendations[].property` | The full property object, identical shape to [`GET /api/residency/:id`](#get-apiresidencyid). |

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "success": false, "message": "'prompt' is required and must be a non-empty string." }` | Missing/empty/non-string `prompt` |
| `400` | `{ "success": false, "message": "'prompt' must be 500 characters or fewer." }` | Prompt too long |
| `422` | `{ "success": false, "message": "The AI did not return a valid set of search filters after retrying." }` | Model output failed structured validation twice in a row |
| `429` | `{ "success": false, "message": "AI provider rate limit exceeded. Please try again shortly." }` | OpenAI rate limit |
| `502` | `{ "success": false, "message": "The AI provider returned an unexpected error." }` | Generic OpenAI API error |
| `503` | `{ "success": false, "message": "AI search is not configured on the server." }` | `OPENAI_API_KEY` missing |
| `503` | `{ "success": false, "message": "AI provider rejected the request due to a server configuration issue." }` | OpenAI auth/permission error |
| `504` | `{ "success": false, "message": "The AI provider timed out. Please try again." }` | OpenAI request timeout |

---

## User APIs

All routes are mounted at `/api/user`.

### `POST /api/user/register`

Creates (or acknowledges an existing) app-level user record for the currently logged-in Auth0 identity.

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{ "email": "user@example.com" }
```

**Response**

| Status | Body |
|---|---|
| `200` | `{ "message": "User registered successfully", "user": { "...": "..." } }` (new user) |
| `201` | `{ "message": "User already registered" }` (existing user) |

> **Note**: the controller passes the entire request body into `prisma.user.create({ data: req.body })` with no field allow-list — only `email` is sent by the current frontend, but this is worth tightening if the endpoint is ever exposed more broadly.

---

### `POST /api/user/bookVisit/:id`

Books a visit for property `:id`.

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{ "email": "user@example.com", "id": "64392e0bdfd90fb29e464fbc", "date": "14/06/2026" }
```

**Response**

| Status | Body |
|---|---|
| `200` | `"your visit is booked successfully"` (plain text, not JSON) |
| `400` | `{ "message": "This residency is already booked by you" }` |

---

### `POST /api/user/allBookings`

Returns a user's booked visits.

| | |
|---|---|
| **Auth** | ⚠️ **Not protected** — trusts the `email` in the request body. This is a pre-existing gap (not introduced by the AI work) and is documented here rather than silently carried forward; see [docs/architecture.md](architecture.md#tradeoffs). |

**Request body**

```json
{ "email": "user@example.com" }
```

**Response `200`**

```json
{ "bookedVisits": [{ "id": "64392e0bdfd90fb29e464fbc", "date": "14/06/2026" }] }
```

---

### `POST /api/user/removeBooking/:id`

Cancels a previously booked visit.

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{ "email": "user@example.com" }
```

**Response**

| Status | Body |
|---|---|
| `200` | `"Booking cancelled successfully"` (plain text) |
| `404` | `{ "message": "Booking not found" }` |

---

### `POST /api/user/toFav/:rid`

Toggles property `:rid` in the user's favorites.

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{ "email": "user@example.com" }
```

**Response `200`**

```json
{ "message": "Updated favorites", "user": { "favResidenciesID": ["64392e0bdfd90fb29e464fbc"] } }
```

(or `{ "message": "Removed from favorites", "user": {...} }` if it was already favorited)

---

### `POST /api/user/allFav`

Returns the raw list of favorited property IDs (not the hydrated property documents — the frontend fetches full listings separately and filters client-side by these IDs).

| | |
|---|---|
| **Auth** | ✅ Required (`jwtCheck`) |

**Request body**

```json
{ "email": "user@example.com" }
```

**Response `200`**

```json
{ "favResidenciesID": ["64392e0bdfd90fb29e464fbc"] }
```
