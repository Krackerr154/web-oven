# Product Requirements Document
## XRD Phase Matching Platform (XRD-PM)

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-03-26  
**Authors:** Engineering Team  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals and Success Metrics](#2-goals-and-success-metrics)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Node.js API Gateway](#5-nodejs-api-gateway)
6. [Python Compute Engine](#6-python-compute-engine)
7. [Feature 1 — Mixture Phase Decomposition](#7-feature-1--mixture-phase-decomposition)
8. [Feature 2 — Uncertainty Quantification](#8-feature-2--uncertainty-quantification)
9. [Feature 3 — WebSocket Real-Time Progress](#9-feature-3--websocket-real-time-progress)
10. [Feature 4 — Rietveld Refinement](#10-feature-4--rietveld-refinement)
11. [Reference Database Integration (COD)](#11-reference-database-integration-cod)
12. [Deployment and Infrastructure](#12-deployment-and-infrastructure)
13. [API Contract](#13-api-contract)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

XRD-PM is a microservices-based web platform for X-Ray Diffraction (XRD) phase identification, quantitative mixture analysis, and lattice parameter refinement. It combines a TypeScript/Node.js API gateway, a Python scientific compute engine, and a PostgreSQL reference database populated from the Crystallography Open Database (COD).

The platform is designed to run on a single Dockerized server (4-core CPU, 8 GB RAM) while remaining horizontally scalable. It handles the full analytical workflow: raw CIF ingestion → experimental data cleaning → phase matching → mixture decomposition → uncertainty reporting → Rietveld refinement — with real-time progress streaming throughout.

**Target users:** Materials scientists, mineralogists, pharmaceutical chemists, and engineers who perform powder diffraction analysis and need a self-hosted, auditable, and extensible alternative to commercial tools such as MDI JADE or HighScore Plus.

---

## 2. Goals and Success Metrics

### Product Goals

| # | Goal |
|---|------|
| G1 | Identify the dominant phases in a powder XRD scan in under 10 seconds |
| G2 | Decompose multi-phase mixtures with weight fraction estimates |
| G3 | Report match confidence intervals so users can distinguish certain from ambiguous identifications |
| G4 | Stream progress in real time for long-running batch jobs |
| G5 | Refine lattice parameters against the experimental pattern |
| G6 | Operate fully offline using COD as the reference source |

### Key Performance Indicators

| Metric | Target |
|---|---|
| Phase identification latency (single phase) | < 10 s end-to-end |
| Match throughput | ≥ 5,000 candidates/s on 4 cores |
| Mixture decomposition (up to 5 phases) | < 60 s |
| Rietveld refinement convergence | < 120 s for standard patterns |
| WebSocket event latency | < 500 ms per progress tick |
| Bootstrap CI computation (10 iterations) | < 30 s |
| API gateway P99 response time (non-compute) | < 200 ms |
| System uptime target | 99.5% monthly |

---

## 3. System Architecture

### 3.1 Service Topology

```
┌─────────────────────────────────────────────────────┐
│  CLIENT LAYER                                        │
│  React SPA · REST/JSON · WebSocket · File Uploads    │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────────────────┐
│  nginx — reverse proxy + TLS termination             │
└────────────────────┬────────────────────────────────┘
                     │ HTTP internal
┌────────────────────▼────────────────────────────────┐
│  Node.js API GATEWAY (TypeScript / Fastify / Prisma) │
│  JWT auth · rate limiting · file validation          │
│  BullMQ job dispatch · SSE + WebSocket relay         │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
┌──────▼──────┐     ┌─────────▼──────────────────────┐
│ PostgreSQL  │     │  Python Compute Engine (FastAPI) │
│ Phases      │     │  /parse-cif                      │
│ d-spacings  │     │  /process-xrd                    │
│ Results     │     │  /match-phases                   │
│ pgvector    │     │  /decompose-mixture              │
└──────┬──────┘     │  /bootstrap-ci                   │
       │            │  /refine-rietveld                │
┌──────▼──────┐     └─────────────────────────────────┘
│  Redis      │
│  BullMQ     │
│  WS sessions│
│  Cache      │
└─────────────┘
┌─────────────────────────────────────────────────────┐
│  MinIO / S3-compatible object store                  │
│  Raw CIF files · Raw XRD files · Refinement outputs  │
└─────────────────────────────────────────────────────┘
```

### 3.2 Communication Patterns

| Path | Protocol | Format |
|---|---|---|
| Client → nginx → Node | HTTPS | JSON / multipart |
| Client → Node (progress) | WSS | JSON events |
| Node → Python (small payload) | HTTP | JSON |
| Node → Python (candidate arrays) | HTTP | MessagePack |
| Node → Python (streaming response) | HTTP | NDJSON |
| Node → PostgreSQL | TCP (Prisma pool) | SQL |
| Node → Redis | TCP | RESP |
| Node → MinIO | HTTP | S3 API |

### 3.3 Internal Network

All services communicate over a Docker bridge network (`xrd-internal`). Only nginx is exposed externally. Python compute endpoints are never reachable from outside the Docker network.

---

## 4. Database Design

### 4.1 Schema (Prisma)

```prisma
model Phase {
  id            String        @id @default(cuid())
  name          String
  formula       String
  spaceGroup    String?
  crystalSystem String?
  codId         String?       @unique   // COD entry ID
  cifHash       String?       @unique   // SHA-256 of source CIF
  cifPath       String?                 // MinIO object key
  status        PhaseStatus   @default(PENDING)
  fingerprint   Unsupported("vector(64)")?  // pgvector ANN index
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  dSpacings     DSpacing[]
  matchResults  MatchResult[]
}

model DSpacing {
  id           String   @id @default(cuid())
  phaseId      String
  wavelengthKey String  // e.g. "CuKa", "MoKa", "wavelength_independent"
  dValues      Float[]
  intensities  Float[]
  twoTheta     Float[]
  phase        Phase    @relation(fields: [phaseId], references: [id])

  @@unique([phaseId, wavelengthKey])
}

model ExperimentalScan {
  id                String        @id @default(cuid())
  userId            String
  rawFilePath       String        // MinIO object key
  processedTwoTheta Float[]
  processedIntensity Float[]
  peakPositions     Float[]
  backgroundStripped Boolean      @default(false)
  createdAt         DateTime      @default(now())

  matchResults      MatchResult[]
  refinements       Refinement[]
}

model MatchResult {
  id             String          @id @default(cuid())
  scanId         String
  phaseId        String
  rank           Int
  score          Float
  scoreLower     Float?          // CI lower bound (Feature 2)
  scoreUpper     Float?          // CI upper bound (Feature 2)
  weightFraction Float?          // mixture fraction (Feature 1)
  scoringMethod  ScoringMethod
  createdAt      DateTime        @default(now())

  scan           ExperimentalScan @relation(fields: [scanId], references: [id])
  phase          Phase            @relation(fields: [phaseId], references: [id])
  refinements    Refinement[]
}

model Refinement {
  id              String           @id @default(cuid())
  scanId          String
  matchResultId   String?
  status          RefinementStatus @default(QUEUED)
  jobId           String?          // BullMQ job ID (Feature 3)
  refinedA        Float?
  refinedB        Float?
  refinedC        Float?
  refinedAlpha    Float?
  refinedBeta     Float?
  refinedGamma    Float?
  rwp             Float?
  outputPath      String?          // MinIO path for output CIF
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  scan            ExperimentalScan @relation(fields: [scanId], references: [id])
  matchResult     MatchResult?     @relation(fields: [matchResultId], references: [id])
}

enum PhaseStatus     { PENDING PROCESSING READY FAILED }
enum ScoringMethod   { RWP PEARSON }
enum RefinementStatus { QUEUED RUNNING CONVERGED FAILED }
```

### 4.2 Indexes

```sql
-- ANN pre-filter (pgvector)
CREATE INDEX ON "Phase" USING ivfflat (fingerprint vector_cosine_ops) WITH (lists = 100);

-- Fast lookup by COD ID
CREATE INDEX ON "Phase" ("codId");

-- Scan → results ordered by rank
CREATE INDEX ON "MatchResult" ("scanId", "rank");
```

### 4.3 64-Dimensional Fingerprint

Each phase's d-spacing array is binned into a 64-element histogram over the range 0.5–10.0 Å (bin width 0.148 Å), L2-normalized, and stored as a `vector(64)` column. This enables approximate-nearest-neighbor pre-filtering via `pgvector` before any Python scoring, cutting the candidate set from potentially 500K entries to ~500 in milliseconds.

---

## 5. Node.js API Gateway

### 5.1 Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | LTS stability, ESM support |
| Framework | Fastify 4 | 2–3× JSON throughput vs Express |
| ORM | Prisma 5 | Type-safe queries, migration tooling |
| Auth | JWT (RS256) + refresh tokens | Stateless, verifiable |
| Job queue | BullMQ 5 + Redis 7 | Reliable at-least-once delivery |
| File storage client | `@aws-sdk/client-s3` | S3-compatible (MinIO) |
| WebSocket | `@fastify/websocket` | Shares HTTP server (Feature 3) |
| Serialization | `msgpackr` | MessagePack for Python payloads |
| Process management | Node cluster (2 workers) | Utilize remaining CPU |

### 5.2 Memory Budget

```
NODE_OPTIONS=--max-old-space-size=1536
```

Node.js is capped at 1.5 GB. Python receives the remainder of the 8 GB budget (~5 GB usable after OS and other services).

### 5.3 CIF Ingestion Flow

```
POST /api/cifs (multipart)
  │
  ├─ Validate file extension, MIME type, max 10 MB
  ├─ Compute SHA-256 → check Phase.cifHash for duplicate
  │   └─ If duplicate: return existing Phase record (200 OK)
  ├─ Upload raw file to MinIO
  ├─ INSERT Phase (status=PENDING)
  ├─ Enqueue BullMQ job { phaseId, minioPath }
  └─ Return { phaseId, status: "PENDING" } (202 Accepted)

BullMQ Worker:
  ├─ Download CIF from MinIO
  ├─ POST /parse-cif to Python (JSON)
  ├─ Receive { dValues[], intensities[], twoTheta[], fingerprint[] }
  ├─ INSERT DSpacing record
  ├─ UPDATE Phase fingerprint vector + status=READY
  └─ Emit WebSocket event "cif:ready" to subscribed clients
```

### 5.4 Match Request Flow

```
POST /api/scans/match (multipart: .xy or .csv)
  │
  ├─ Parse file → validate 2θ/intensity column structure
  ├─ POST /process-xrd → cleaned arrays + peak list
  ├─ INSERT ExperimentalScan
  ├─ Query PostgreSQL:
  │   ├─ ANN pre-filter: SELECT top 500 by fingerprint <=> $experimental_fp
  │   └─ Optional hard filters: crystalSystem, element whitelist, 2θ range
  ├─ POST /match-phases (MessagePack) → ranked scores with CI bounds
  ├─ INSERT MatchResult rows (bulk)
  └─ Stream NDJSON results via SSE as scoring completes in batches of 50
```

### 5.5 Rate Limiting

```
Global:    1000 req/min per IP
/api/scans: 10 match requests/min per user (compute-intensive)
/api/cifs:  50 uploads/min per user
```

---

## 6. Python Compute Engine

### 6.1 Technology Stack

| Component | Choice |
|---|---|
| Framework | FastAPI 0.111 |
| ASGI server | Uvicorn 0.29 — 3 workers, 2 threads each |
| Scientific | NumPy 1.26, SciPy 1.13, pymatgen 2024.6 |
| Acceleration | Numba 0.59 (JIT-compiled Rwp kernel) |
| Serialization | `msgpack-python` |
| Background tasks | FastAPI `BackgroundTasks` + asyncio |

### 6.2 `POST /parse-cif`

**Input:** `{ cif_text: string, wavelength_key: "CuKa" | "MoKa" | "wavelength_independent" }`

**Logic:**
1. Parse CIF with `pymatgen.core.Structure.from_str()`
2. Run `pymatgen.analysis.diffraction.xrd.XRDCalculator` at the requested wavelength
3. Extract `(d_hkl, relative_intensity)` tuples; d-values are wavelength-independent by Bragg's law
4. Compute 64-dim fingerprint histogram
5. Apply Debye-Scherrer peak broadening model at FWHM = 0.1° for synthetic pattern generation

**Output:** `{ d_values: float[], intensities: float[], two_theta: float[], fingerprint: float[64] }`

### 6.3 `POST /process-xrd`

**Input:** `{ two_theta: float[], counts: float[], wavelength_angstrom: float }`

**Logic:**
1. **SNIP background subtraction** — Statistics-sensitive Non-linear Iterative Peak-clipping:
   - 30 iterations; window shrinks as `w = floor(w_max * (1 - i/N))`
   - `w_max` defaults to 24 data points (~1.5° 2θ at typical step sizes)
   - Operates on `sqrt(counts)` space per the SNIP convention
2. **Savitzky-Golay smoothing** — `scipy.signal.savgol_filter(window=11, polyorder=3)`
3. **Peak detection** — `scipy.signal.find_peaks` with `prominence=0.03 * max_intensity`
4. **Conversion** — if wavelength provided, convert 2θ to d-spacing array via Bragg's law

**Output:** `{ two_theta: float[], intensity: float[], background: float[], peaks: float[] }`

### 6.4 `POST /match-phases`

**Input (MessagePack):**
```
{
  experimental: { two_theta: float[M], intensity: float[M] },
  candidates: [
    { phase_id: string, two_theta: float[K], intensity: float[K] },
    ...  // up to ~500 after ANN pre-filter
  ],
  method: "rwp" | "pearson"
}
```

**Vectorized pipeline (NumPy):**
```python
# 1. Interpolate all candidate arrays onto experimental grid in one call
#    Shape: (N_candidates, M_points) — single numpy.interp broadcast
ref_matrix = np.vstack([
    np.interp(exp_2theta, c["two_theta"], c["intensity"])
    for c in candidates
])  # shape (N, M)

# 2. L2-normalise each candidate row
norms = np.linalg.norm(ref_matrix, axis=1, keepdims=True)
ref_norm = ref_matrix / np.where(norms == 0, 1, norms)

# 3. Score — Rwp via Numba JIT kernel (parallel=True, cache=True)
#    or Pearson via einsum
scores = _score_rwp_jit(exp_intensity, ref_norm, weights)
# or
scores = np.einsum('j,ij->i', exp_norm, ref_norm)

# 4. Rank
top_k_idx = np.argpartition(scores, -top_k)[-top_k:]
ranked = top_k_idx[np.argsort(scores[top_k_idx])[::-1]]
```

**Memory envelope:** 500 candidates × 3,000 points × 4 bytes (fp32) = ~6 MB per request — well within budget.

**Output (NDJSON stream):** One JSON line per ranked result as scoring completes.

---

## 7. Feature 1 — Mixture Phase Decomposition

### 7.1 Overview

After initial single-phase identification, the platform performs iterative greedy pattern subtraction to identify and quantify co-existing phases. This is Quantitative Phase Analysis (QPA) implemented without requiring a full Rietveld refinement.

### 7.2 Algorithm

```
Input: cleaned experimental pattern, ranked MatchResult list

Iteration 1:
  ├─ Take Phase rank-1 as the dominant phase
  ├─ Scale its reference pattern to minimise ||exp - scale * ref||²
  │   └─ Optimal scale factor: s* = dot(exp, ref) / dot(ref, ref)
  ├─ Compute residual: R = exp - s* * ref
  └─ If max(R) < 5% of max(exp): stop — single-phase sample

Iteration 2..5:
  ├─ Re-run /match-phases on residual R with same candidate set
  ├─ Record the new top-ranked phase
  ├─ Scale and subtract again
  └─ Accumulate (phase_id, scale_factor) pairs

Weight fractions:
  weight[i] = scale[i] * RIR[i] / Σ(scale[j] * RIR[j])
  where RIR = Reference Intensity Ratio from Phase metadata (default 1.0 if unavailable)
```

### 7.3 API Endpoints

**Trigger decomposition:**
```
POST /api/scans/{scanId}/decompose
Body: { maxPhases: 1–5, method: "rwp" | "pearson" }
Response: 202 Accepted + jobId
```

**Stream progress (WebSocket — see Feature 3):**
```
WS event: { type: "decompose:iteration", iteration: 2, residualRwp: 0.34 }
WS event: { type: "decompose:done", phases: [ { phaseId, rank, weightFraction } ] }
```

### 7.4 Data Flow Integration

- Each identified phase is persisted as a `MatchResult` row with `weightFraction` populated
- The `Refinement` table links back to individual `MatchResult` rows, so refinement (Feature 4) can be triggered per constituent phase
- The residual array at each iteration is stored transiently in Redis (TTL 1 hour) keyed by `decompose:{jobId}:iter:{n}` for debugging

### 7.5 Stopping Criteria

| Condition | Action |
|---|---|
| Residual max < 5% of original max | Stop — well-identified |
| Iteration count reaches `maxPhases` | Stop — report partial |
| No new phase improves residual by > 3% | Stop — noise floor reached |
| Match score < 0.1 on residual | Stop — unknown phase, flag as "unidentified residual" |

---

## 8. Feature 2 — Uncertainty Quantification

### 8.1 Overview

Every match score is accompanied by a bootstrap confidence interval. This lets users immediately distinguish a confident identification (narrow CI, e.g. Rwp 0.12 ± 0.01) from an ambiguous one (wide CI, e.g. Rwp 0.45 ± 0.18).

### 8.2 Bootstrap Method

```python
N_BOOTSTRAP = 10        # per request — tunable via config
NOISE_SIGMA_FRACTION = 0.02  # 2% of max intensity

scores_bootstrap = np.zeros((N_BOOTSTRAP, N_candidates))

for i in range(N_BOOTSTRAP):
    noise = rng.normal(0, NOISE_SIGMA_FRACTION * exp.max(), size=exp.shape)
    perturbed = np.maximum(exp + noise, 0)          # no negative counts
    scores_bootstrap[i] = score_all(perturbed, ref_matrix, method)

ci_lower = np.percentile(scores_bootstrap, 5,  axis=0)
ci_upper = np.percentile(scores_bootstrap, 95, axis=0)
```

The bootstrap loop is parallelised across the N_BOOTSTRAP iterations using `concurrent.futures.ThreadPoolExecutor(max_workers=4)` since each iteration is independent and GIL-free during NumPy operations.

### 8.3 Python Endpoint

`POST /bootstrap-ci` accepts the same MessagePack payload as `/match-phases` and returns:

```json
{
  "results": [
    {
      "phase_id": "clx...",
      "score_mean": 0.12,
      "score_lower": 0.10,
      "score_upper": 0.15,
      "ci_width": 0.05
    }
  ]
}
```

### 8.4 Integration with Match Flow

The CI endpoint is called **in parallel** with the main `/match-phases` call. Node.js dispatches both via `Promise.all()`. The main match result streams to the client first; CI bounds are merged into each `MatchResult` row as they arrive and pushed as a WebSocket update event `match:ci_ready`.

```typescript
const [matchStream, ciResults] = await Promise.all([
  pythonClient.post('/match-phases', payload, { responseType: 'stream' }),
  pythonClient.post('/bootstrap-ci', payload),
]);
```

### 8.5 Database Storage

`MatchResult.scoreLower` and `MatchResult.scoreUpper` store the 5th and 95th percentiles. The frontend renders a confidence bar beneath each ranked result.

### 8.6 User-Facing Interpretation

| CI width | Label shown in UI |
|---|---|
| < 0.05 | High confidence |
| 0.05 – 0.15 | Moderate confidence |
| > 0.15 | Low confidence — inspect pattern manually |

---

## 9. Feature 3 — WebSocket Real-Time Progress

### 9.1 Overview

All long-running operations — CIF ingestion, match jobs, mixture decomposition, and Rietveld refinement — publish structured progress events over a persistent WebSocket connection. This eliminates polling and gives users immediate feedback.

### 9.2 Session Architecture

```
Client connects: WSS /ws?token=<JWT>
  │
  ├─ Node validates JWT → extracts userId
  ├─ Subscribes client to Redis pub/sub channel "ws:{userId}"
  └─ Forwards all channel messages to the WebSocket in real time

BullMQ workers publish:
  redis.publish("ws:{userId}", JSON.stringify({ type, jobId, payload }))
```

Redis pub/sub decouples the worker process from the WebSocket connection, so horizontal scaling of workers does not require shared state beyond Redis.

### 9.3 Event Schema

All events share a common envelope:

```typescript
interface WsEvent {
  type: string;        // namespaced, e.g. "cif:ready"
  jobId: string;       // BullMQ job ID
  timestamp: string;   // ISO-8601
  payload: object;     // event-specific data
}
```

| Event type | Trigger | Payload fields |
|---|---|---|
| `cif:queued` | CIF upload accepted | `{ phaseId, fileName }` |
| `cif:parsing` | Worker started | `{ phaseId }` |
| `cif:ready` | Parse complete | `{ phaseId, dSpacingCount }` |
| `cif:failed` | Parse error | `{ phaseId, error }` |
| `match:started` | Match job begins | `{ scanId, candidateCount }` |
| `match:batch` | 50 candidates scored | `{ scanId, progress: 0–100, topHits[] }` |
| `match:ci_ready` | Bootstrap CI merged | `{ scanId, results[] }` |
| `match:done` | All candidates scored | `{ scanId, totalTime }` |
| `decompose:iteration` | Greedy iteration N done | `{ scanId, iteration, residualRwp, phase }` |
| `decompose:done` | All phases identified | `{ scanId, phases[], weightFractions[] }` |
| `refine:queued` | Refinement job queued | `{ refinementId }` |
| `refine:progress` | Iteration update | `{ refinementId, iteration, rwp, chiSq }` |
| `refine:converged` | Refinement finished | `{ refinementId, latticeParams, rwp }` |
| `refine:failed` | Refinement error | `{ refinementId, error }` |

### 9.4 BullMQ Job Queues

| Queue | Concurrency | Workers | Notes |
|---|---|---|---|
| `cif-ingestion` | 4 | 1 Node worker | Burst OK, I/O bound |
| `match-jobs` | 2 | 1 Node worker | CPU bound on Python side |
| `refinement` | 1 | 1 Node worker | Long-running, single slot |

### 9.5 Reconnection and Missed Events

- WebSocket clients send a `{ type: "resume", lastEventId }` message on reconnect
- Node replays any events from the last 5 minutes stored in Redis as a sorted set `ws:events:{userId}` (scored by timestamp), with a 10-minute TTL

---

## 10. Feature 4 — Rietveld Refinement

### 10.1 Overview

After a phase (or mixture of phases) has been identified, users can trigger a Rietveld least-squares refinement to extract precise lattice parameters. This transforms XRD-PM from an identification tool into a light structure refinement platform without requiring GSAS-II or FullProf locally.

### 10.2 Refinement Engine

The Python `/refine-rietveld` endpoint orchestrates refinement using `pymatgen`'s built-in refinement utilities combined with `scipy.optimize.minimize` (L-BFGS-B) for the least-squares objective:

```
Minimise:  Rwp = sqrt[ Σ w_i (I_obs_i − I_calc_i)² / Σ w_i I_obs_i² ]

Where:
  I_calc = Σ_phases [ scale * Σ_hkl F²_hkl · LP(θ) · A(θ) · Peak(2θ − 2θ_hkl, FWHM) ]
  w_i    = 1 / I_obs_i (Poisson weighting)
```

**Refined parameters (initial scope):**
- Lattice parameters a, b, c, α, β, γ (constrained by space group symmetry)
- Scale factor per phase
- Zero-point correction (2θ offset)
- Peak width parameters U, V, W (Cagliotti equation)

### 10.3 Python Endpoint

**`POST /refine-rietveld`**

```json
Input:
{
  "scan_id": "clx...",
  "phases": [
    { "phase_id": "clx...", "initial_lattice": { "a": 4.05, ... } }
  ],
  "wavelength_angstrom": 1.5406,
  "max_iterations": 500,
  "convergence_tolerance": 1e-6
}

Response (streaming NDJSON):
{ "iteration": 1, "rwp": 0.42, "chi_sq": 1.8 }
{ "iteration": 50, "rwp": 0.18, "chi_sq": 1.1 }
...
{ "converged": true, "rwp": 0.09, "chi_sq": 0.97,
  "lattice": { "a": 4.0494, "b": 4.0494, "c": 4.0494,
               "alpha": 90.0, "beta": 90.0, "gamma": 90.0 },
  "output_cif_path": "refinements/clx.../result.cif" }
```

Each iteration update is published to the BullMQ worker → Redis pub/sub → WebSocket (Feature 3) so the client sees the Rwp curve decreasing in real time.

### 10.4 API Endpoints (Node.js)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/results/:matchResultId/refine` | Trigger refinement for a single identified phase |
| `POST` | `/api/scans/:scanId/refine-mixture` | Trigger refinement for all decomposed phases simultaneously |
| `GET` | `/api/refinements/:id` | Fetch refinement status and results |
| `GET` | `/api/refinements/:id/cif` | Download the refined CIF output |

### 10.5 Node.js Orchestration

```typescript
// POST /api/results/:matchResultId/refine
async function triggerRefinement(req, reply) {
  const matchResult = await prisma.matchResult.findUniqueOrThrow({
    where: { id: req.params.matchResultId },
    include: { scan: true, phase: { include: { dSpacings: true } } },
  });

  const refinement = await prisma.refinement.create({
    data: { scanId: matchResult.scanId, matchResultId: matchResult.id, status: 'QUEUED' },
  });

  const job = await refinementQueue.add('refine', {
    refinementId: refinement.id,
    scanId: matchResult.scanId,
    phases: [{ phaseId: matchResult.phaseId, lattice: matchResult.phase.unitCell }],
    wavelength: req.body.wavelengthAngstrom ?? 1.5406,
  });

  await prisma.refinement.update({ where: { id: refinement.id }, data: { jobId: job.id } });
  return reply.status(202).send({ refinementId: refinement.id, jobId: job.id });
}
```

### 10.6 Output Artifacts

On convergence, the Python engine:
1. Writes a refined CIF file to MinIO at `refinements/{refinementId}/result.cif`
2. Writes a difference plot data file (obs, calc, diff arrays) to `refinements/{refinementId}/plot.json`
3. Updates `Refinement` record with final lattice parameters and Rwp
4. Emits `refine:converged` WebSocket event

### 10.7 Convergence Guard

If Rwp does not decrease by > 0.5% over 50 consecutive iterations, the refinement is flagged as stalled. The endpoint sets `Refinement.status = FAILED` with error `"Refinement stalled — check phase identity or starting parameters"` and emits a `refine:failed` event.

---

## 11. Reference Database Integration (COD)

### 11.1 Why COD

The Crystallography Open Database (COD) is the primary reference source. It contains over 500,000 freely licensed crystal structures in CIF format, covers the vast majority of phases encountered in academic and industrial XRD workflows, and can be legally bulk-mirrored and re-used without license restrictions — unlike ICDD PDF products.

ICDD PDF databases (PDF-2, PDF-4, PDF-5+) use proprietary binary formats accessible only via ICDD-licensed ODBC drivers on Windows. Bulk automated extraction is prohibited by the ICDD license agreement. COD provides equivalent coverage for most use cases and is the correct technical and legal choice for this platform.

### 11.2 Initial Population

```bash
# Mirror the full COD via rsync (~40 GB, ~2 hours on a typical connection)
rsync -av --port=873 cod.ibt.lt::cod/cif /data/cod-mirror/

# Run the ingestion worker
npm run seed:cod -- --dir /data/cod-mirror --concurrency 8
```

The seed script:
1. Walks the CIF directory tree
2. For each file: computes SHA-256, skips if `Phase.cifHash` exists
3. Uploads to MinIO, creates a `Phase` record, enqueues a `cif-ingestion` BullMQ job
4. Progress is emitted as `seed:progress` WebSocket events (batch ingestion uses a special admin WebSocket channel)

Estimated ingestion time at 4 cores: ~14 hours for full COD (dominated by pymatgen structure parsing). The database is fully searchable from the moment any phase is processed — no need to wait for the full run.

### 11.3 Nightly Sync

A BullMQ cron job (`0 2 * * *` — 02:00 daily) calls the COD REST API for entries updated since the last sync:

```
GET https://www.crystallography.net/cod/result?modified_since=YYYY-MM-DD&format=json
```

New entries are enqueued into `cif-ingestion` and processed normally.

### 11.4 COD REST Metadata Enrichment

When a Phase is created from a COD CIF, the gateway also calls:

```
GET https://www.crystallography.net/cod/entry/{codId}.json
```

to populate `Phase.formula`, `Phase.spaceGroup`, `Phase.crystalSystem`, and element lists used for hard-filter queries.

---

## 12. Deployment and Infrastructure

### 12.1 Docker Compose Services

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["443:443", "80:80"]
    cpus: "0.1"
    mem_limit: "64m"

  gateway:
    build: ./services/gateway
    environment:
      NODE_OPTIONS: "--max-old-space-size=1536"
    cpus: "0.5"
    mem_limit: "1536m"
    depends_on: [postgres, redis]

  compute:
    build: ./services/compute
    command: uvicorn main:app --workers 3 --host 0.0.0.0 --port 8000
    cpus: "2.5"
    mem_limit: "5120m"
    depends_on: []   # stateless — no DB access

  postgres:
    image: pgvector/pgvector:pg16
    cpus: "0.5"
    mem_limit: "1024m"
    environment:
      POSTGRES_SHARED_BUFFERS: "256MB"
      POSTGRES_WORK_MEM: "32MB"
      POSTGRES_MAX_CONNECTIONS: "50"

  redis:
    image: redis:7-alpine
    cpus: "0.1"
    mem_limit: "256m"
    command: redis-server --maxmemory 200mb --maxmemory-policy allkeys-lru

  minio:
    image: minio/minio:latest
    cpus: "0.1"
    mem_limit: "256m"
    command: server /data --console-address ":9001"

  worker:
    build: ./services/gateway      # shares gateway image
    command: node dist/worker.js   # BullMQ worker entry
    cpus: "0.2"
    mem_limit: "512m"
    depends_on: [redis, postgres, compute]
```

**Total CPU allocation:** 4.0 cores  
**Total memory allocation:** 8.7 GB (within OS overhead budget for 8 GB host)

### 12.2 Resource Allocation Summary

| Service | CPU | RAM | Notes |
|---|---|---|---|
| nginx | 0.1 | 64 MB | TLS termination, reverse proxy |
| gateway (2 Node workers) | 0.5 | 1.5 GB | I/O + orchestration |
| compute (3 Uvicorn workers) | 2.5 | 5 GB | NumPy/SciPy + Numba |
| postgres | 0.5 | 1 GB | shared_buffers=256 MB |
| redis | 0.1 | 256 MB | pub/sub + BullMQ + cache |
| minio | 0.1 | 256 MB | object storage |
| worker | 0.2 | 512 MB | BullMQ job executor |

### 12.3 Volume Mounts

```
./data/postgres    → /var/lib/postgresql/data
./data/redis       → /data
./data/minio       → /data
./data/cod-mirror  → /data/cod-mirror   (seed only, can be unmounted after ingestion)
```

### 12.4 Health Checks

Every service exposes a health endpoint:

```
GET /health  →  { status: "ok", version, uptime }
```

nginx polls these every 10 seconds and removes an unhealthy upstream from rotation after 3 consecutive failures.

### 12.5 Logging

All services emit structured JSON logs (stdout) consumed by Docker's `json-file` driver with `max-size: 50m, max-file: 3`. Log fields: `timestamp`, `level`, `service`, `requestId`, `userId` (where applicable), `durationMs`, `message`.

---

## 13. API Contract

### 13.1 Authentication

All routes except `POST /api/auth/login` and `POST /api/auth/register` require `Authorization: Bearer <JWT>`.

Tokens expire in 1 hour. Refresh tokens expire in 30 days and are stored in an `HttpOnly` cookie.

### 13.2 Endpoint Reference

| Method | Path | Service | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Node | Authenticate, receive JWT |
| `POST` | `/api/auth/refresh` | Node | Refresh access token |
| `POST` | `/api/cifs` | Node | Upload CIF file |
| `GET` | `/api/phases` | Node | Search reference phases |
| `GET` | `/api/phases/:id` | Node | Get phase details + d-spacings |
| `POST` | `/api/scans/match` | Node | Upload XRD file, trigger match |
| `GET` | `/api/scans/:id` | Node | Get scan + match results |
| `GET` | `/api/scans/:id/stream` | Node (SSE) | Stream results as they score |
| `POST` | `/api/scans/:id/decompose` | Node | Trigger mixture decomposition |
| `POST` | `/api/results/:id/refine` | Node | Trigger Rietveld refinement |
| `POST` | `/api/scans/:id/refine-mixture` | Node | Refine all decomposed phases |
| `GET` | `/api/refinements/:id` | Node | Get refinement status + params |
| `GET` | `/api/refinements/:id/cif` | Node | Download refined CIF |
| `WSS` | `/ws` | Node | WebSocket — all job events |
| `POST` | `/parse-cif` | Python (internal) | CIF → d-spacing arrays |
| `POST` | `/process-xrd` | Python (internal) | Raw XRD → cleaned arrays |
| `POST` | `/match-phases` | Python (internal) | Vectorized scoring |
| `POST` | `/decompose-mixture` | Python (internal) | Iterative subtraction |
| `POST` | `/bootstrap-ci` | Python (internal) | Confidence interval |
| `POST` | `/refine-rietveld` | Python (internal) | Rietveld least-squares |
| `GET` | `/health` | Both | Health check |

### 13.3 Error Schema

All errors return:

```json
{
  "error": {
    "code": "INVALID_CIF",
    "message": "Could not parse CIF: missing _cell_length_a",
    "requestId": "req_abc123"
  }
}
```

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_FILE` | Wrong file type or malformed |
| 400 | `INVALID_CIF` | pymatgen parse failure |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Resource belongs to another user |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `DUPLICATE_CIF` | CIF hash already in database |
| 422 | `INVALID_XRD` | XRD file has wrong column structure |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `COMPUTE_ERROR` | Python engine returned an error |
| 503 | `COMPUTE_UNAVAILABLE` | Python engine health check failed |

---

## 14. Non-Functional Requirements

### 14.1 Security

- All traffic over HTTPS/WSS (TLS 1.3)
- JWT signed with RS256 (2048-bit key pair rotated every 90 days)
- File upload validation: extension allow-list (`.cif`, `.xy`, `.csv`), MIME check, 10 MB max
- Python compute engine not reachable from outside Docker network
- MinIO access via pre-signed URLs only (no direct bucket exposure)
- SQL injection: impossible via Prisma parameterised queries
- Input sanitisation on all string fields before pymatgen parsing

### 14.2 Scalability Path

| Bottleneck | Horizontal scale action |
|---|---|
| Python compute | Add compute containers; nginx upstream round-robin |
| PostgreSQL | Add read replica for SELECT-heavy phase search |
| Redis | Sentinel or Cluster if > 10K concurrent users |
| MinIO | Add nodes to distributed mode |
| Node gateway | Already stateless; add instances behind nginx |

### 14.3 Data Retention

| Data | Retention |
|---|---|
| Raw uploaded CIF files | Indefinite (deduplicated by hash) |
| Raw XRD scan files | 90 days, then deleted from MinIO |
| Processed scan arrays | 90 days in PostgreSQL |
| Match results | 1 year |
| Refinement outputs | 1 year |
| Redis decomposition residuals | 1 hour TTL |
| WebSocket event replay buffer | 10 minutes TTL |

### 14.4 Testing Requirements

| Layer | Requirement |
|---|---|
| Python scientific functions | Unit tests with synthetic patterns (known phase, expected Rwp < 0.05) |
| SNIP + Savitzky-Golay | Reference datasets from IUCr benchmark collection |
| Rietveld refinement | α-Al₂O₃ (corundum) standard — expect a=4.7588, c=12.9920 Å |
| Mixture decomposition | Synthetic 50/50 quartz/calcite blend |
| Node.js API | Integration tests with test PostgreSQL + mocked Python service |
| WebSocket | Playwright end-to-end: upload → match → WS events received |
| Bootstrap CI | Statistical test: CI contains true score in ≥ 90% of 100 runs |

---

## 15. Open Questions

| # | Question | Owner | Due |
|---|---|---|---|
| Q1 | Should Rietveld refinement support anisotropic broadening (Stephens model) in v1, or defer to v2? | Engineering | TBD |
| Q2 | What is the target COD subset for initial population — all 500K entries, or a mineralogy/pharmacy subset? | Product | TBD |
| Q3 | Should the bootstrap CI use 10 or 20 iterations by default? (20 gives tighter intervals but doubles compute time) | Engineering | TBD |
| Q4 | Is multi-user isolation required (separate phase databases per user/org), or is a shared global reference DB sufficient? | Product | TBD |
| Q5 | Should the refined CIF output be validated against ICSD criteria before download? | Engineering | TBD |

---

*End of document. Version 1.0.0.*
