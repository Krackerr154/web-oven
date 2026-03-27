# XRD Phase Matching Platform — Integration Plan (Incremental)

## Background

The **web-oven** project is a Next.js 16 lab management application (oven bookings, reagents, glassware, announcements) running as a single Docker container connected to the shared `x01_db` PostgreSQL instance on the `x01-bot_x01_net` network. The XRD Phase Matching PRD introduces 4 new features and several new services (Python compute engine, Redis, MinIO) that must be integrated **into the same Docker Compose file and database**.

### Key Constraints
- **Same database** (`x01_db`) — all XRD tables will use `@@map("xrd_*")` prefix to avoid collisions with existing `ap_*` tables
- **Same Docker network** (`x01-bot_x01_net`) — all new services join the existing external network
- **Single `docker-compose.yml`** — unified deployment; no separate compose files
- **No nginx** — the existing NPM (Nginx Proxy Manager) reverse proxy handles TLS/routing; the Next.js app exposes its own port
- **Existing auth** — **NextAuth sessions** are used throughout. All XRD routes use `getServerSession(authOptions)` for authentication. Role checks (`ADMIN`/`USER`) follow existing middleware patterns.

---

## Implementation Strategy

This plan uses **incremental development** with checkpoints after each step. Each step:
1. Delivers a testable unit of functionality
2. Includes verification procedures
3. Ensures existing app remains functional
4. Can be rolled back if issues arise

**Phase 1 delivers:** Feature 1 (Mixture Decomposition) + Feature 2 (Uncertainty Quantification) + Feature 3 (WebSocket Progress) + Admin CIF Management

**Phase 2 delivers:** Feature 4 (Rietveld Refinement) only

---

## Phase 1: Incremental Implementation Steps

---

## STEP 1: Infrastructure Foundation

**Goal:** Set up Docker services (Redis, MinIO, Python compute skeleton) and verify they start correctly.

### 1.1 Add Docker Services

#### [MODIFY] `docker-compose.yml`

Add three new services:

```yaml
xrd-redis:
  image: redis:7-alpine
  container_name: xrd-redis
  restart: unless-stopped
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - ./data/redis:/data
  networks:
    - x01_net

xrd-minio:
  image: minio/minio:latest
  container_name: xrd-minio
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
  volumes:
    - ./data/minio:/data
  networks:
    - x01_net

xrd-compute:
  build: ./services/xrd-compute
  container_name: xrd-compute
  restart: unless-stopped
  environment:
    WORKERS: "3"
  networks:
    - x01_net
```

### 1.2 Create Python Compute Skeleton

#### [NEW] `services/xrd-compute/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "3"]
```

#### [NEW] `services/xrd-compute/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
numpy==1.26.4
scipy==1.13.0
```

#### [NEW] `services/xrd-compute/main.py`

```python
from fastapi import FastAPI

app = FastAPI(title="XRD Compute Engine", version="1.0.0")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
```

### 1.3 Update Environment Variables

#### [MODIFY] `.env.example`

Add:
```bash
# XRD Services
XRD_COMPUTE_URL=http://xrd-compute:8000
REDIS_URL=redis://xrd-redis:6379

# MinIO Configuration
MINIO_ENDPOINT=http://xrd-minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=xrd-files
```

Copy to `.env`:
```bash
cp .env.example .env
# Edit .env and add the XRD variables
```

---

### ✅ CHECKPOINT 1: Infrastructure Verification

**Test Procedures:**

1. **Build and start services:**
   ```bash
   docker compose up -d --build
   ```

2. **Verify all containers running:**
   ```bash
   docker ps
   # Expected: web-oven-ap-lab, xrd-redis, xrd-minio, xrd-compute all "Up"
   ```

3. **Test Python compute health:**
   ```bash
   docker exec web-oven-ap-lab curl http://xrd-compute:8000/health
   # Expected: {"status":"ok","version":"1.0.0"}
   ```

4. **Test Redis connection:**
   ```bash
   docker exec xrd-redis redis-cli PING
   # Expected: PONG
   ```

5. **Test MinIO running:**
   ```bash
   docker logs xrd-minio | grep "API"
   # Expected: MinIO API endpoint logs
   ```

6. **Verify existing app still works:**
   - Open browser to your web-oven URL
   - Log in with existing credentials
   - Navigate to booking page
   - Verify no console errors
   - Create a test booking
   - **Expected: Everything works as before**

**Rollback if needed:**
```bash
docker compose down
git checkout docker-compose.yml
docker compose up -d
```

**Success Criteria:**
- ✅ All 4 containers running
- ✅ Python health endpoint responds
- ✅ Redis responds to PING
- ✅ MinIO logs show startup
- ✅ Existing app fully functional

---

## STEP 2: Database Schema & MinIO Initialization

**Goal:** Add XRD tables to database and initialize MinIO bucket.

### 2.1 Add Prisma Schema Models

#### [MODIFY] `prisma/schema.prisma`

Add at the end of the file (after `AnnouncementComment`):

```prisma
// ============================================
// XRD Phase Matching Models
// ============================================

enum PhaseStatus {
  PENDING
  PROCESSING
  READY
  FAILED

  @@map("xrd_phase_status")
}

enum ScoringMethod {
  RWP
  PEARSON

  @@map("xrd_scoring_method")
}

enum JobType {
  CIF_PARSE
  XRD_MATCH
  DECOMPOSE
  BOOTSTRAP_CI

  @@map("xrd_job_type")
}

enum RefinementStatus {
  QUEUED
  RUNNING
  CONVERGED
  FAILED

  @@map("xrd_refinement_status")
}

model Phase {
  id            String        @id @default(cuid())
  name          String
  formula       String
  spaceGroup    String?
  crystalSystem String?
  codId         String?       @unique
  cifHash       String?       @unique
  cifPath       String?
  status        PhaseStatus   @default(PENDING)
  // No fingerprint column — pgvector not used
  uploadedBy    String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  uploader      User?         @relation(fields: [uploadedBy], references: [id])
  dSpacings     DSpacing[]
  matchResults  MatchResult[]

  @@map("xrd_phases")
}

model DSpacing {
  id            String   @id @default(cuid())
  phaseId       String
  wavelengthKey String
  dValues       Float[]
  intensities   Float[]
  twoTheta      Float[]

  phase         Phase    @relation(fields: [phaseId], references: [id], onDelete: Cascade)

  @@unique([phaseId, wavelengthKey])
  @@map("xrd_d_spacings")
}

model ExperimentalScan {
  id                  String        @id @default(cuid())
  userId              String
  rawFilePath         String
  processedTwoTheta   Float[]
  processedIntensity  Float[]
  peakPositions       Float[]
  backgroundStripped  Boolean       @default(false)
  createdAt           DateTime      @default(now())

  user                User          @relation(fields: [userId], references: [id])
  matchResults        MatchResult[]
  refinements         Refinement[]

  @@map("xrd_scans")
}

model MatchResult {
  id             String          @id @default(cuid())
  scanId         String
  phaseId        String
  rank           Int
  score          Float
  scoreLower     Float?
  scoreUpper     Float?
  weightFraction Float?
  scoringMethod  ScoringMethod
  createdAt      DateTime        @default(now())

  scan           ExperimentalScan @relation(fields: [scanId], references: [id], onDelete: Cascade)
  phase          Phase            @relation(fields: [phaseId], references: [id])
  refinements    Refinement[]

  @@map("xrd_match_results")
}

model JobStatus {
  id        String   @id @default(cuid())
  userId    String
  jobId     String   @unique
  jobType   JobType
  status    String
  progress  Int      @default(0)
  result    Json?
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])

  @@map("xrd_job_status")
}

model Refinement {
  id              String           @id @default(cuid())
  scanId          String
  matchResultId   String?
  status          RefinementStatus @default(QUEUED)
  jobId           String?
  refinedA        Float?
  refinedB        Float?
  refinedC        Float?
  refinedAlpha    Float?
  refinedBeta     Float?
  refinedGamma    Float?
  rwp             Float?
  outputPath      String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  scan            ExperimentalScan @relation(fields: [scanId], references: [id], onDelete: Cascade)
  matchResult     MatchResult?     @relation(fields: [matchResultId], references: [id])

  @@map("xrd_refinements")
}
```

#### [MODIFY] Existing `User` model

Add relation fields:
```prisma
model User {
  // ... existing fields ...

  // XRD relations
  phases           Phase[]
  experimentalScans ExperimentalScan[]
  jobStatuses      JobStatus[]
}
```

### 2.2 Initialize MinIO Bucket

#### [NEW] `scripts/init-minio.sh`

```bash
#!/bin/bash
set -e

echo "Waiting for MinIO to be ready..."
until curl -sf http://xrd-minio:9000/minio/health/live > /dev/null 2>&1; do
  sleep 2
done

echo "Installing MinIO client..."
wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
chmod +x /tmp/mc

echo "Configuring MinIO alias..."
/tmp/mc alias set local http://xrd-minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}

echo "Creating bucket..."
/tmp/mc mb local/${MINIO_BUCKET} --ignore-existing

echo "MinIO initialization complete!"
```

#### [MODIFY] `docker-entrypoint.sh`

Add after database setup:

```bash
# Initialize MinIO bucket
if [ -f /app/scripts/init-minio.sh ]; then
  bash /app/scripts/init-minio.sh
fi
```

---

### ✅ CHECKPOINT 2: Database & Storage Verification

**Test Procedures:**

1. **Generate Prisma client:**
   ```bash
   docker exec web-oven-ap-lab npx prisma generate
   ```

2. **Push schema to database:**
   ```bash
   docker exec web-oven-ap-lab npx prisma db push
   # Expected: "Your database is now in sync with your schema"
   ```

3. **Verify tables created:**
   ```bash
   docker exec web-oven-ap-lab npx prisma studio
   # Open Prisma Studio and verify xrd_* tables exist
   ```

4. **Verify MinIO bucket:**
   ```bash
   docker exec web-oven-ap-lab curl http://xrd-minio:9000/xrd-files/
   # Expected: XML response (bucket exists)
   ```

6. **Test existing app:**
   - Log in to web-oven
   - Navigate through all existing pages
   - Verify no database errors
   - **Expected: All existing features work**

**Rollback if needed:**
```bash
# Revert schema changes
git checkout prisma/schema.prisma
docker exec web-oven-ap-lab npx prisma generate
docker exec web-oven-ap-lab npx prisma db push
```

**Success Criteria:**
- ✅ Prisma client generated successfully
- ✅ All xrd_* tables created in database
- ✅ MinIO bucket created
- ✅ Existing app fully functional

---

## STEP 3: Core Python Compute Endpoints

**Goal:** Implement Python endpoints for CIF parsing and XRD processing (no Next.js integration yet).

### 3.1 Add Python Dependencies

#### [MODIFY] `services/xrd-compute/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
numpy==1.26.4
scipy==1.13.0
pymatgen==2024.6.10
numba==0.59.1
msgpack==1.0.8
```

### 3.2 Implement Core Modules

#### [NEW] `services/xrd-compute/core/snip.py`

```python
import numpy as np

def snip_background(counts: np.ndarray, iterations: int = 30, window_max: int = 24) -> np.ndarray:
    """SNIP background subtraction algorithm."""
    y = np.sqrt(np.maximum(counts, 0))
    n = len(y)

    for i in range(iterations):
        w = max(1, int(window_max * (1 - i / iterations)))
        for j in range(w, n - w):
            y[j] = min(y[j], (y[j - w] + y[j + w]) / 2)

    return y ** 2
```

#### [NEW] `services/xrd-compute/core/scoring.py`

```python
import numpy as np
from numba import jit

@jit(nopython=True, parallel=True, cache=True)
def score_rwp_batch(exp: np.ndarray, ref_matrix: np.ndarray) -> np.ndarray:
    """Vectorized Rwp scoring with Numba acceleration."""
    n_candidates = ref_matrix.shape[0]
    scores = np.zeros(n_candidates)

    for i in range(n_candidates):
        diff = exp - ref_matrix[i]
        scores[i] = np.sqrt(np.sum(diff ** 2) / np.sum(exp ** 2))

    return scores

def score_pearson_batch(exp: np.ndarray, ref_matrix: np.ndarray) -> np.ndarray:
    """Vectorized Pearson correlation scoring."""
    exp_norm = (exp - exp.mean()) / (exp.std() + 1e-10)
    ref_norm = (ref_matrix - ref_matrix.mean(axis=1, keepdims=True)) / (ref_matrix.std(axis=1, keepdims=True) + 1e-10)
    return np.einsum('j,ij->i', exp_norm, ref_norm) / len(exp)
```

### 3.3 Implement API Endpoints

#### [NEW] `services/xrd-compute/routers/parse_cif.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
from pymatgen.core import Structure
from pymatgen.analysis.diffraction.xrd import XRDCalculator

router = APIRouter()

class ParseCIFRequest(BaseModel):
    cif_text: str
    wavelength_key: str = "CuKa"

class ParseCIFResponse(BaseModel):
    d_values: list[float]
    intensities: list[float]
    two_theta: list[float]
    # No fingerprint — pgvector not used

@router.post("/parse-cif", response_model=ParseCIFResponse)
async def parse_cif(req: ParseCIFRequest):
    try:
        structure = Structure.from_str(req.cif_text, fmt="cif")
        wavelength = 1.5406 if req.wavelength_key == "CuKa" else 0.7107

        calculator = XRDCalculator(wavelength=wavelength)
        pattern = calculator.get_pattern(structure)

        d_values = pattern.d_hkls
        intensities = pattern.y
        two_theta = pattern.x

        return ParseCIFResponse(
            d_values=d_values.tolist(),
            intensities=intensities.tolist(),
            two_theta=two_theta.tolist()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CIF parse error: {str(e)}")
```

#### [NEW] `services/xrd-compute/routers/process_xrd.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
from scipy.signal import savgol_filter, find_peaks
from core.snip import snip_background

router = APIRouter()

class ProcessXRDRequest(BaseModel):
    two_theta: list[float]
    counts: list[float]
    wavelength_angstrom: float = 1.5406

class ProcessXRDResponse(BaseModel):
    two_theta: list[float]
    intensity: list[float]
    background: list[float]
    peaks: list[float]

@router.post("/process-xrd", response_model=ProcessXRDResponse)
async def process_xrd(req: ProcessXRDRequest):
    try:
        two_theta = np.array(req.two_theta)
        counts = np.array(req.counts)

        # Background subtraction
        background = snip_background(counts)
        intensity = np.maximum(counts - background, 0)

        # Smoothing
        if len(intensity) > 11:
            intensity = savgol_filter(intensity, window_length=11, polyorder=3)

        # Peak detection
        peaks, _ = find_peaks(intensity, prominence=0.03 * intensity.max())
        peak_positions = two_theta[peaks].tolist()

        return ProcessXRDResponse(
            two_theta=two_theta.tolist(),
            intensity=intensity.tolist(),
            background=background.tolist(),
            peaks=peak_positions
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"XRD processing error: {str(e)}")
```

#### [MODIFY] `services/xrd-compute/main.py`

```python
from fastapi import FastAPI
from routers import parse_cif, process_xrd

app = FastAPI(title="XRD Compute Engine", version="1.0.0")

app.include_router(parse_cif.router)
app.include_router(process_xrd.router)

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
```

---

### ✅ CHECKPOINT 3: Python Compute Verification

**Test Procedures:**

1. **Rebuild Python service:**
   ```bash
   docker compose up -d --build xrd-compute
   docker logs xrd-compute
   # Expected: "Uvicorn running on http://0.0.0.0:8000"
   ```

2. **Test health endpoint:**
   ```bash
   docker exec web-oven-ap-lab curl http://xrd-compute:8000/health
   # Expected: {"status":"ok","version":"1.0.0"}
   ```

3. **Test CIF parsing (create test file):**
   ```bash
   # Create test CIF
   cat > /tmp/test.cif << 'EOF'
data_quartz
_cell_length_a    4.916
_cell_length_b    4.916
_cell_length_c    5.405
_cell_angle_alpha 90
_cell_angle_beta  90
_cell_angle_gamma 120
_symmetry_space_group_name_H-M 'P 32 2 1'
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si 0.4697 0.0000 0.0000
O  0.4135 0.2669 0.1188
EOF

   # Test parse endpoint
   docker exec web-oven-ap-lab curl -X POST http://xrd-compute:8000/parse-cif \
     -H "Content-Type: application/json" \
     -d "{\"cif_text\": \"$(cat /tmp/test.cif | sed 's/"/\\"/g' | tr '\n' ' ')\"}"
   # Expected: JSON with d_values, intensities, two_theta arrays
   ```

4. **Test XRD processing:**
   ```bash
   docker exec web-oven-ap-lab curl -X POST http://xrd-compute:8000/process-xrd \
     -H "Content-Type: application/json" \
     -d '{"two_theta":[10,11,12,13,14,15,16,17,18,19,20],"counts":[100,120,150,200,180,160,140,130,125,120,115]}'
   # Expected: JSON with processed arrays and peak positions
   ```

5. **Check Python logs for errors:**
   ```bash
   docker logs xrd-compute --tail 50
   # Expected: No errors, successful request logs
   ```

6. **Verify existing app:**
   - Test existing booking functionality
   - **Expected: No impact from Python service**

**Rollback if needed:**
```bash
docker compose stop xrd-compute
# Fix issues, then:
docker compose up -d --build xrd-compute
```

**Success Criteria:**
- ✅ Python service starts with 3 workers
- ✅ Health endpoint responds
- ✅ CIF parsing works with test data
- ✅ XRD processing works with test data
- ✅ No errors in Python logs
- ✅ Existing app unaffected

---

## STEP 4: BullMQ Job Queue Setup

**Goal:** Set up BullMQ infrastructure for async job processing (no jobs yet, just infrastructure).

### 4.1 Install Dependencies

#### [MODIFY] `package.json`

Add to dependencies:
```json
{
  "dependencies": {
    "bullmq": "^5.8.0",
    "ioredis": "^5.4.0"
  }
}
```

Install:
```bash
docker exec web-oven-ap-lab npm install
```

### 4.2 Create Queue Infrastructure

#### [NEW] `src/lib/xrd/queue.ts`

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Job queues
export const cifQueue = new Queue('cif-ingestion', { connection });
export const matchQueue = new Queue('xrd-match', { connection });
export const decomposeQueue = new Queue('xrd-decompose', { connection });

// Queue events for monitoring
export const cifQueueEvents = new QueueEvents('cif-ingestion', { connection });
export const matchQueueEvents = new QueueEvents('xrd-match', { connection });
export const decomposeQueueEvents = new QueueEvents('xrd-decompose', { connection });
```

#### [NEW] `src/lib/xrd/redis.ts`

```typescript
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL!);
  }
  return redisClient;
}

export async function publishWebSocketEvent(userId: string, event: any) {
  const redis = getRedisClient();
  await redis.publish(`xrd:ws:${userId}`, JSON.stringify(event));
}
```

---

### ✅ CHECKPOINT 4: BullMQ Infrastructure Verification

**Test Procedures:**

1. **Rebuild Next.js app:**
   ```bash
   docker compose up -d --build web-oven-ap-lab
   docker logs web-oven-ap-lab --tail 50
   # Expected: No errors, app starts successfully
   ```

2. **Test Redis connection from Node:**
   ```bash
   docker exec web-oven-ap-lab node -e "
   const Redis = require('ioredis');
   const redis = new Redis(process.env.REDIS_URL);
   redis.ping().then(r => console.log('PING:', r)).then(() => redis.quit());
   "
   # Expected: PING: PONG
   ```

3. **Test BullMQ queue creation:**
   ```bash
   docker exec web-oven-ap-lab node -e "
   const { Queue } = require('bullmq');
   const Redis = require('ioredis');
   const q = new Queue('test', { connection: new Redis(process.env.REDIS_URL) });
   q.add('test-job', {data: 'test'}).then(() => console.log('Job added')).then(() => q.close());
   "
   # Expected: Job added
   ```

4. **Check Redis for queues:**
   ```bash
   docker exec xrd-redis redis-cli KEYS "bull:*"
   # Expected: Keys showing BullMQ queue structures
   ```

5. **Verify existing app:**
   - Test all existing features
   - **Expected: No impact from BullMQ setup**

**Rollback if needed:**
```bash
npm uninstall bullmq ioredis
rm -rf src/lib/xrd/queue.ts src/lib/xrd/redis.ts
docker compose up -d --build web-oven-ap-lab
```

**Success Criteria:**
- ✅ BullMQ and ioredis installed
- ✅ Redis connection works from Node
- ✅ Queue creation works
- ✅ Redis shows queue keys
- ✅ Existing app unaffected

---

## STEP 5: MinIO Client & Python Client Libraries

**Goal:** Create utility libraries for MinIO and Python communication (no API routes yet).

### 5.1 Install Dependencies

#### [MODIFY] `package.json`

Add:
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "msgpackr": "^1.10.0"
  }
}
```

Install:
```bash
docker exec web-oven-ap-lab npm install
```

### 5.2 Create MinIO Client

#### [NEW] `src/lib/xrd/minio-client.ts`

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT!,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.MINIO_BUCKET!;

export async function ensureBucketExists() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await ensureBucketExists();
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return Buffer.from(await response.Body!.transformToByteArray());
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn });
}
```

### 5.3 Create Python Client

#### [NEW] `src/lib/xrd/python-client.ts`

```typescript
import { pack, unpack } from 'msgpackr';

const PYTHON_URL = process.env.XRD_COMPUTE_URL!;

export async function callPythonEndpoint<T>(
  endpoint: string,
  data: any,
  options: { useMsgpack?: boolean; stream?: boolean } = {}
): Promise<T> {
  const url = `${PYTHON_URL}${endpoint}`;
  const headers: Record<string, string> = {};
  let body: any;

  if (options.useMsgpack) {
    headers['Content-Type'] = 'application/msgpack';
    body = pack(data);
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python compute error: ${error}`);
  }

  if (options.stream) {
    return response as any; // Return response for streaming
  }

  if (options.useMsgpack) {
    const buffer = await response.arrayBuffer();
    return unpack(new Uint8Array(buffer)) as T;
  }

  return response.json() as T;
}

export async function* streamNDJSON<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line) as T;
      }
    }
  }
}
```

---

### ✅ CHECKPOINT 5: Client Libraries Verification

**Test Procedures:**

1. **Rebuild app:**
   ```bash
   docker compose up -d --build web-oven-ap-lab
   ```

2. **Test MinIO client:**
   ```bash
   docker exec web-oven-ap-lab node -e "
   const { uploadFile, getFile } = require('./src/lib/xrd/minio-client.ts');
   (async () => {
     await uploadFile('test.txt', Buffer.from('hello'), 'text/plain');
     const data = await getFile('test.txt');
     console.log('Retrieved:', data.toString());
   })();
   "
   # Expected: Retrieved: hello
   ```

3. **Test Python client:**
   ```bash
   docker exec web-oven-ap-lab node -e "
   const { callPythonEndpoint } = require('./src/lib/xrd/python-client.ts');
   callPythonEndpoint('/health', {}, {}).then(r => console.log('Health:', r));
   "
   # Expected: Health: {status: 'ok', version: '1.0.0'}
   ```

4. **Verify existing app:**
   - Test existing features
   - **Expected: No issues**

**Success Criteria:**
- ✅ MinIO client can upload/download files
- ✅ Python client can call endpoints
- ✅ No build errors
- ✅ Existing app works

---

## STEP 6: Admin CIF Upload API & Worker

**Goal:** Implement admin CIF upload endpoint and BullMQ worker for processing.

### 6.1 Create Error Handling Utilities

#### [NEW] `src/lib/xrd/errors.ts`

```typescript
export class XRDError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'XRDError';
  }
}

export const ErrorCodes = {
  INVALID_FILE: { code: 'INVALID_FILE', status: 400 },
  INVALID_CIF: { code: 'INVALID_CIF', status: 400 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  COMPUTE_ERROR: { code: 'COMPUTE_ERROR', status: 500 },
} as const;
```

### 6.2 Create CIF Upload API Route

#### [NEW] `src/app/api/xrd/admin/cifs/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadFile } from '@/lib/xrd/minio-client';
import { cifQueue } from '@/lib/xrd/queue';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || !file.name.endsWith('.cif')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cifHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate
    const existing = await prisma.phase.findUnique({ where: { cifHash } });
    if (existing) {
      return NextResponse.json({
        phaseId: existing.id,
        status: existing.status,
        message: 'CIF already exists'
      });
    }

    // Upload to MinIO
    const cifPath = `cifs/${cifHash}.cif`;
    await uploadFile(cifPath, buffer, 'chemical/x-cif');

    // Create Phase record
    const phase = await prisma.phase.create({
      data: {
        name: file.name.replace('.cif', ''),
        formula: 'Unknown',
        cifHash,
        cifPath,
        status: 'PENDING',
        uploadedBy: session.user.id,
      },
    });

    // Enqueue job
    const job = await cifQueue.add('parse-cif', {
      phaseId: phase.id,
      cifPath,
      userId: session.user.id,
    });

    return NextResponse.json({
      phaseId: phase.id,
      jobId: job.id,
      status: 'PENDING',
    }, { status: 202 });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message
    }, { status: 500 });
  }
}
```

### 6.3 Create CIF Processing Worker

#### [NEW] `src/lib/xrd/workers/cif-worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import prisma from '@/lib/prisma';
import { getFile } from '@/lib/xrd/minio-client';
import { callPythonEndpoint } from '@/lib/xrd/python-client';
import { publishWebSocketEvent } from '@/lib/xrd/redis';

const connection = new Redis(process.env.REDIS_URL!);

interface CIFJobData {
  phaseId: string;
  cifPath: string;
  userId: string;
}

export const cifWorker = new Worker<CIFJobData>(
  'cif-ingestion',
  async (job: Job<CIFJobData>) => {
    const { phaseId, cifPath, userId } = job.data;

    try {
      await publishWebSocketEvent(userId, {
        type: 'cif:parsing',
        jobId: job.id,
        timestamp: new Date().toISOString(),
        payload: { phaseId },
      });

      await prisma.phase.update({
        where: { id: phaseId },
        data: { status: 'PROCESSING' },
      });

      // Download CIF from MinIO
      const cifBuffer = await getFile(cifPath);
      const cifText = cifBuffer.toString('utf-8');

      // Call Python to parse
      const result = await callPythonEndpoint<{
        d_values: number[];
        intensities: number[];
        two_theta: number[];
      }>('/parse-cif', { cif_text: cifText, wavelength_key: 'CuKa' });

      // Store d-spacing data
      await prisma.dSpacing.create({
        data: {
          phaseId,
          wavelengthKey: 'CuKa',
          dValues: result.d_values,
          intensities: result.intensities,
          twoTheta: result.two_theta,
        },
      });

      // Update phase status to READY
      await prisma.phase.update({
        where: { id: phaseId },
        data: { status: 'READY' },
      });

      await publishWebSocketEvent(userId, {
        type: 'cif:ready',
        jobId: job.id,
        timestamp: new Date().toISOString(),
        payload: { phaseId, dSpacingCount: result.d_values.length },
      });

    } catch (error: any) {
      await prisma.phase.update({
        where: { id: phaseId },
        data: { status: 'FAILED' },
      });

      await publishWebSocketEvent(userId, {
        type: 'cif:failed',
        jobId: job.id,
        timestamp: new Date().toISOString(),
        payload: { phaseId, error: error.message },
      });

      throw error;
    }
  },
  { connection, concurrency: 4 }
);
```

### 6.4 Initialize Workers on Startup

#### [NEW] `src/lib/xrd/workers/index.ts`

```typescript
import { cifWorker } from './cif-worker';

export function startWorkers() {
  console.log('Starting XRD workers...');
  // Workers are already started by importing
  return { cifWorker };
}
```

#### [MODIFY] `src/app/layout.tsx` or create startup script

Add worker initialization (this runs on server startup):

```typescript
// In a server-side initialization file
import { startWorkers } from '@/lib/xrd/workers';

if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WORKERS === 'true') {
  startWorkers();
}
```

---

### ✅ CHECKPOINT 6: Admin CIF Upload Verification

**Test Procedures:**

1. **Rebuild app:**
   ```bash
   docker compose up -d --build web-oven-ap-lab
   docker logs web-oven-ap-lab --tail 50
   # Expected: "Starting XRD workers..." in logs
   ```

2. **Create test CIF file:**
   ```bash
   cat > /tmp/quartz.cif << 'EOF'
data_quartz
_cell_length_a    4.916
_cell_length_b    4.916
_cell_length_c    5.405
_cell_angle_alpha 90
_cell_angle_beta  90
_cell_angle_gamma 120
_symmetry_space_group_name_H-M 'P 32 2 1'
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si 0.4697 0.0000 0.0000
O  0.4135 0.2669 0.1188
EOF
   ```

3. **Test upload as admin (requires auth token):**
   ```bash
   # First, log in as admin and get session cookie
   # Then test upload:
   curl -X POST http://localhost:3005/api/xrd/admin/cifs \
     -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
     -F "file=@/tmp/quartz.cif"
   # Expected: {"phaseId":"...", "jobId":"...", "status":"PENDING"}
   ```

4. **Check job processing:**
   ```bash
   docker exec xrd-redis redis-cli LLEN "bull:cif-ingestion:wait"
   # Expected: 0 (job processed)

   docker exec xrd-redis redis-cli LLEN "bull:cif-ingestion:completed"
   # Expected: 1 (job completed)
   ```

5. **Verify database:**
   ```bash
   docker exec web-oven-ap-lab npx prisma studio
   # Check xrd_phases table: status should be READY
   # Check xrd_d_spacings table: should have data
   ```

6. **Check MinIO:**
   ```bash
   docker exec web-oven-ap-lab curl http://xrd-minio:9000/xrd-files/cifs/
   # Expected: XML listing with uploaded CIF
   ```

7. **Verify existing app:**
   - Test booking system
   - **Expected: No issues**

**Rollback if needed:**
```bash
# Remove API route and worker
rm -rf src/app/api/xrd
rm -rf src/lib/xrd/workers
docker compose up -d --build web-oven-ap-lab
```

**Success Criteria:**
- ✅ Admin can upload CIF files
- ✅ Worker processes jobs
- ✅ Phase record created with READY status
- ✅ D-spacing data stored
- ✅ Fingerprint vector stored
- ✅ File stored in MinIO
- ✅ Existing app works

---

## STEP 7: WebSocket Real-Time Progress

**Goal:** Implement WebSocket endpoint for real-time job progress updates.

### 7.1 Create WebSocket Route

#### [NEW] `src/app/api/xrd/ws/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRedisClient } from '@/lib/xrd/redis';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const upgradeHeader = req.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Note: WebSocket upgrade in Next.js requires custom server or edge runtime
  // For now, return SSE as fallback
  const stream = new ReadableStream({
    async start(controller) {
      const redis = getRedisClient();
      const subscriber = redis.duplicate();

      await subscriber.subscribe(`xrd:ws:${session.user.id}`);

      subscriber.on('message', (channel, message) => {
        controller.enqueue(`data: ${message}\n\n`);
      });

      req.signal.addEventListener('abort', () => {
        subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 7.2 Create WebSocket Hook

#### [NEW] `src/hooks/useXRDWebSocket.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';

interface WsEvent {
  type: string;
  jobId: string;
  timestamp: string;
  payload: any;
}

export function useXRDWebSocket() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/xrd/ws');

    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data) as WsEvent;
      setEvents((prev) => [...prev, event]);
    };

    return () => eventSource.close();
  }, []);

  return { events, connected };
}
```

---

### ✅ CHECKPOINT 7: WebSocket Verification

**Test Procedures:**

1. **Rebuild app:**
   ```bash
   docker compose up -d --build web-oven-ap-lab
   ```

2. **Test SSE endpoint (requires auth):**
   ```bash
   curl -N -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
     http://localhost:3005/api/xrd/ws
   # Expected: Connection stays open, waits for events
   ```

3. **Trigger event and verify delivery:**
   ```bash
   # In another terminal, publish test event
   docker exec xrd-redis redis-cli PUBLISH "xrd:ws:USER_ID" '{"type":"test","jobId":"123","timestamp":"2026-03-27T00:00:00Z","payload":{}}'

   # Check first terminal - should receive:
   # data: {"type":"test","jobId":"123",...}
   ```

4. **Test with CIF upload:**
   - Upload a CIF file as admin
   - Keep SSE connection open
   - Verify events received: `cif:parsing`, `cif:ready`

5. **Verify existing app:**
   - Test all features
   - **Expected: No issues**

**Success Criteria:**
- ✅ SSE endpoint accessible
- ✅ Events published to Redis
- ✅ Events delivered to client
- ✅ CIF upload triggers events
- ✅ Existing app works

---

## STEP 8: Admin CIF Management Frontend

**Goal:** Build admin UI for CIF upload and phase management.

### 8.1 Create Admin CIF Management Page

#### [NEW] `src/app/(dashboard)/admin/xrd/phases/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useXRDWebSocket } from '@/hooks/useXRDWebSocket';

export default function AdminXRDPhasesPage() {
  const [uploading, setUploading] = useState(false);
  const { events, connected } = useXRDWebSocket();

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/xrd/admin/cifs', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    console.log('Upload result:', data);
    setUploading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">XRD Phase Management</h1>

      <div className="mb-4">
        <span className={connected ? 'text-green-600' : 'text-red-600'}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      <form onSubmit={handleUpload} className="mb-6">
        <input type="file" name="file" accept=".cif" required />
        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload CIF'}
        </button>
      </form>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Recent Events</h2>
        <div className="space-y-2">
          {events.slice(-10).reverse().map((event, i) => (
            <div key={i} className="p-2 bg-gray-100 rounded">
              <span className="font-mono text-sm">{event.type}</span>
              <span className="text-xs text-gray-600 ml-2">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### ✅ CHECKPOINT 8: Admin UI Verification

**Test Procedures:**

1. **Access admin page:**
   - Log in as admin
   - Navigate to `/admin/xrd/phases`
   - **Expected: Page loads, shows upload form**

2. **Test file upload:**
   - Select a CIF file
   - Click "Upload CIF"
   - **Expected: "Uploading..." then success**

3. **Verify real-time events:**
   - Watch "Recent Events" section
   - **Expected: See `cif:parsing`, then `cif:ready`**

4. **Test connection indicator:**
   - **Expected: Green "● Connected"**

5. **Verify existing app:**
   - Test booking system
   - **Expected: No issues**

**Success Criteria:**
- ✅ Admin page accessible
- ✅ File upload works
- ✅ Real-time events display
- ✅ Connection status shows
- ✅ Existing app works

---

## STEP 9: XRD Pattern Matching (Backend)

**Goal:** Implement XRD scan upload, matching logic, and Python endpoints.

### 9.1 Add Python Matching Endpoints

#### [NEW] `services/xrd-compute/routers/match_phases.py`

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import numpy as np
import json
from core.scoring import score_rwp_batch, score_pearson_batch

router = APIRouter()

class Candidate(BaseModel):
    phase_id: str
    two_theta: list[float]
    intensity: list[float]

class MatchRequest(BaseModel):
    experimental: dict
    candidates: list[Candidate]
    method: str = "rwp"

@router.post("/match-phases")
async def match_phases(req: MatchRequest):
    async def generate():
        exp_2theta = np.array(req.experimental["two_theta"])
        exp_intensity = np.array(req.experimental["intensity"])

        # Interpolate all candidates onto experimental grid
        ref_matrix = np.vstack([
            np.interp(exp_2theta, c.two_theta, c.intensity)
            for c in req.candidates
        ])

        # Normalize
        norms = np.linalg.norm(ref_matrix, axis=1, keepdims=True)
        ref_norm = ref_matrix / np.where(norms == 0, 1, norms)
        exp_norm = exp_intensity / (np.linalg.norm(exp_intensity) + 1e-10)

        # Score
        if req.method == "rwp":
            scores = score_rwp_batch(exp_norm, ref_norm)
        else:
            scores = score_pearson_batch(exp_norm, ref_norm)

        # Rank and stream results
        ranked_idx = np.argsort(scores)

        for rank, idx in enumerate(ranked_idx[:50]):
            result = {
                "phase_id": req.candidates[idx].phase_id,
                "rank": rank + 1,
                "score": float(scores[idx])
            }
            yield json.dumps(result) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

### 9.2 Create XRD Match API Route

#### [NEW] `src/app/api/xrd/scans/match/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadFile } from '@/lib/xrd/minio-client';
import { matchQueue } from '@/lib/xrd/queue';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || (!file.name.endsWith('.xy') && !file.name.endsWith('.csv'))) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Upload to MinIO
    const scanPath = `scans/${fileHash}.xy`;
    await uploadFile(scanPath, buffer, 'text/plain');

    // Create scan record (will be updated by worker)
    const scan = await prisma.experimentalScan.create({
      data: {
        userId: session.user.id,
        rawFilePath: scanPath,
        processedTwoTheta: [],
        processedIntensity: [],
        peakPositions: [],
      },
    });

    // Enqueue job
    const job = await matchQueue.add('match-scan', {
      scanId: scan.id,
      scanPath,
      userId: session.user.id,
    });

    return NextResponse.json({
      scanId: scan.id,
      jobId: job.id,
      status: 'PENDING',
    }, { status: 202 });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message
    }, { status: 500 });
  }
}
```

### 9.3 Create Match Worker

#### [NEW] `src/lib/xrd/workers/match-worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import prisma from '@/lib/prisma';
import { getFile } from '@/lib/xrd/minio-client';
import { callPythonEndpoint, streamNDJSON } from '@/lib/xrd/python-client';
import { publishWebSocketEvent } from '@/lib/xrd/redis';

const connection = new Redis(process.env.REDIS_URL!);

interface MatchJobData {
  scanId: string;
  scanPath: string;
  userId: string;
}

export const matchWorker = new Worker<MatchJobData>(
  'xrd-match',
  async (job: Job<MatchJobData>) => {
    const { scanId, scanPath, userId } = job.data;

    try {
      await publishWebSocketEvent(userId, {
        type: 'match:started',
        jobId: job.id!,
        timestamp: new Date().toISOString(),
        payload: { scanId },
      });

      // Download and parse XRD file
      const fileBuffer = await getFile(scanPath);
      const lines = fileBuffer.toString('utf-8').split('\n');
      const data = lines
        .filter(l => l.trim() && !l.startsWith('#'))
        .map(l => l.trim().split(/\s+/).map(Number));

      const twoTheta = data.map(d => d[0]);
      const counts = data.map(d => d[1]);

      // Process XRD
      const processed = await callPythonEndpoint<any>('/process-xrd', {
        two_theta: twoTheta,
        counts,
      });

      // Update scan with processed data
      await prisma.experimentalScan.update({
        where: { id: scanId },
        data: {
          processedTwoTheta: processed.two_theta,
          processedIntensity: processed.intensity,
          peakPositions: processed.peaks,
          backgroundStripped: true,
        },
      });

      // Get ALL ready phases (no ANN — standard SQL query)
      const phases = await prisma.phase.findMany({
        where: { status: 'READY' },
        include: {
          dSpacings: { where: { wavelengthKey: 'CuKa' } },
        },
      });

      // Build candidates list
      const candidates = phases.map((p) => ({
        phase_id: p.id,
        two_theta: p.dSpacings[0]?.twoTheta || [],
        intensity: p.dSpacings[0]?.intensities || [],
      }));

      // Stream matching results
      const response = await callPythonEndpoint('/match-phases', {
        experimental: {
          two_theta: processed.two_theta,
          intensity: processed.intensity,
        },
        candidates,
        method: 'rwp',
      }, { stream: true }) as Response;

      let rank = 0;
      for await (const result of streamNDJSON<any>(response)) {
        rank++;
        await prisma.matchResult.create({
          data: {
            scanId,
            phaseId: result.phase_id,
            rank: result.rank,
            score: result.score,
            scoringMethod: 'RWP',
          },
        });

        if (rank % 10 === 0) {
          await publishWebSocketEvent(userId, {
            type: 'match:batch',
            jobId: job.id!,
            timestamp: new Date().toISOString(),
            payload: { scanId, progress: (rank / 50) * 100 },
          });
        }
      }

      await publishWebSocketEvent(userId, {
        type: 'match:done',
        jobId: job.id!,
        timestamp: new Date().toISOString(),
        payload: { scanId, totalMatches: rank },
      });

    } catch (error: any) {
      await publishWebSocketEvent(userId, {
        type: 'match:failed',
        jobId: job.id!,
        timestamp: new Date().toISOString(),
        payload: { scanId, error: error.message },
      });
      throw error;
    }
  },
  { connection, concurrency: 2 }
);
```

---

### ✅ CHECKPOINT 9: XRD Matching Verification

**Test Procedures:**

1. **Rebuild services:**
   ```bash
   docker compose up -d --build
   ```

2. **Create test XRD file:**
   ```bash
   cat > /tmp/test.xy << 'EOF'
10.0 100
15.0 150
20.0 200
25.0 180
30.0 160
EOF
   ```

3. **Test match endpoint:**
   ```bash
   curl -X POST http://localhost:3005/api/xrd/scans/match \
     -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
     -F "file=@/tmp/test.xy"
   # Expected: {"scanId":"...", "jobId":"...", "status":"PENDING"}
   ```

4. **Verify job processing:**
   ```bash
   docker logs web-oven-ap-lab --tail 50
   # Expected: Match worker logs
   ```

5. **Check results in database:**
   ```bash
   docker exec web-oven-ap-lab npx prisma studio
   # Check xrd_scans: processed data populated
   # Check xrd_match_results: ranked results
   ```

6. **Verify WebSocket events:**
   - Keep SSE connection open
   - Upload XRD file
   - **Expected: `match:started`, `match:batch`, `match:done`**

**Success Criteria:**
- ✅ XRD file upload works
- ✅ Python processes XRD data
- ✅ Matching completes
- ✅ Results stored in database
- ✅ WebSocket events delivered
- ✅ Existing app works

---

## STEP 10: User XRD Dashboard & Results Pages

**Goal:** Build user-facing pages for XRD upload and viewing results.

### 10.1 Create XRD Dashboard

#### [NEW] `src/app/(dashboard)/xrd/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function XRDDashboardPage() {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/xrd/scans/match', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      router.push(`/xrd/scan/${data.scanId}`);
    }
    setUploading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">XRD Phase Matching</h1>

      <form onSubmit={handleUpload} className="mb-6">
        <div className="border-2 border-dashed p-6 rounded">
          <input type="file" name="file" accept=".xy,.csv" required />
          <button type="submit" disabled={uploading} className="mt-4">
            {uploading ? 'Uploading...' : 'Upload & Match'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 10.2 Create Scan Results Page

#### [NEW] `src/app/(dashboard)/xrd/scan/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function ScanResultsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return notFound();

  const scan = await prisma.experimentalScan.findUnique({
    where: { id: params.id },
    include: {
      matchResults: {
        include: { phase: true },
        orderBy: { rank: 'asc' },
        take: 20,
      },
    },
  });

  if (!scan || scan.userId !== session.user.id) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Scan Results</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Top Matches</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Phase</th>
              <th>Formula</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {scan.matchResults.map((result) => (
              <tr key={result.id}>
                <td>{result.rank}</td>
                <td>{result.phase.name}</td>
                <td>{result.phase.formula}</td>
                <td>{result.score.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### ✅ CHECKPOINT 10: User UI Verification

**Test Procedures:**

1. **Access XRD dashboard:**
   - Log in as regular user
   - Navigate to `/xrd`
   - **Expected: Upload form visible**

2. **Upload XRD file:**
   - Select test XRD file
   - Click "Upload & Match"
   - **Expected: Redirect to results page**

3. **View results:**
   - **Expected: Table with ranked phases**

4. **Verify existing app:**
   - Test booking system
   - **Expected: No issues**

**Success Criteria:**
- ✅ Dashboard accessible
- ✅ File upload works
- ✅ Results page shows matches
- ✅ Existing app works

---

## STEP 11: Mixture Decomposition & Bootstrap CI

**Goal:** Implement Features 1 & 2 (mixture decomposition and uncertainty quantification).

### 11.1 Add Python Endpoints

#### [NEW] `services/xrd-compute/routers/decompose.py`

```python
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
from core.scoring import score_rwp_batch

router = APIRouter()

class DecomposeRequest(BaseModel):
    experimental: dict
    candidates: list[dict]
    max_phases: int = 5

@router.post("/decompose-mixture")
async def decompose_mixture(req: DecomposeRequest):
    exp = np.array(req.experimental["intensity"])
    residual = exp.copy()
    phases = []

    for iteration in range(req.max_phases):
        # Match residual against candidates
        ref_matrix = np.vstack([
            np.interp(req.experimental["two_theta"], c["two_theta"], c["intensity"])
            for c in req.candidates
        ])

        scores = score_rwp_batch(residual, ref_matrix)
        best_idx = np.argmin(scores)

        # Scale and subtract
        ref = ref_matrix[best_idx]
        scale = np.dot(residual, ref) / (np.dot(ref, ref) + 1e-10)
        residual = residual - scale * ref

        phases.append({
            "phase_id": req.candidates[best_idx]["phase_id"],
            "scale": float(scale),
            "residual_rwp": float(np.sqrt(np.sum(residual**2) / np.sum(exp**2)))
        })

        if np.max(residual) < 0.05 * np.max(exp):
            break

    # Normalize to weight fractions
    total = sum(p["scale"] for p in phases)
    for p in phases:
        p["weight_fraction"] = p["scale"] / total

    return {"phases": phases}
```

#### [NEW] `services/xrd-compute/routers/bootstrap_ci.py`

```python
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
from core.scoring import score_rwp_batch

router = APIRouter()

class BootstrapRequest(BaseModel):
    experimental: dict
    candidates: list[dict]
    n_iterations: int = 10

@router.post("/bootstrap-ci")
async def bootstrap_ci(req: BootstrapRequest):
    exp = np.array(req.experimental["intensity"])
    ref_matrix = np.vstack([
        np.interp(req.experimental["two_theta"], c["two_theta"], c["intensity"])
        for c in req.candidates
    ])

    scores_bootstrap = np.zeros((req.n_iterations, len(req.candidates)))

    for i in range(req.n_iterations):
        noise = np.random.normal(0, 0.02 * exp.max(), size=exp.shape)
        perturbed = np.maximum(exp + noise, 0)
        scores_bootstrap[i] = score_rwp_batch(perturbed, ref_matrix)

    results = []
    for idx, c in enumerate(req.candidates):
        results.append({
            "phase_id": c["phase_id"],
            "score_lower": float(np.percentile(scores_bootstrap[:, idx], 5)),
            "score_upper": float(np.percentile(scores_bootstrap[:, idx], 95)),
        })

    return {"results": results}
```

### 11.2 Update Match Worker with CI

#### [MODIFY] `src/lib/xrd/workers/match-worker.ts`

Add after main matching loop:

```typescript
// Compute bootstrap CI
const ciResponse = await callPythonEndpoint('/bootstrap-ci', {
  experimental: {
    two_theta: processed.two_theta,
    intensity: processed.intensity,
  },
  candidates,
  n_iterations: 10,
});

// Update match results with CI bounds
for (const ci of ciResponse.results) {
  await prisma.matchResult.updateMany({
    where: { scanId, phaseId: ci.phase_id },
    data: {
      scoreLower: ci.score_lower,
      scoreUpper: ci.score_upper,
    },
  });
}

await publishWebSocketEvent(userId, {
  type: 'match:ci_ready',
  jobId: job.id!,
  timestamp: new Date().toISOString(),
  payload: { scanId },
});
```

---

### ✅ CHECKPOINT 11: Features 1 & 2 Verification

**Test Procedures:**

1. **Rebuild services:**
   ```bash
   docker compose up -d --build
   ```

2. **Test decomposition endpoint:**
   ```bash
   docker exec web-oven-ap-lab curl -X POST http://xrd-compute:8000/decompose-mixture \
     -H "Content-Type: application/json" \
     -d '{"experimental":{"two_theta":[10,20,30],"intensity":[100,200,150]},"candidates":[{"phase_id":"1","two_theta":[10,20,30],"intensity":[90,180,140]}],"max_phases":3}'
   # Expected: JSON with phases and weight fractions
   ```

3. **Test bootstrap CI:**
   ```bash
   docker exec web-oven-ap-lab curl -X POST http://xrd-compute:8000/bootstrap-ci \
     -H "Content-Type: application/json" \
     -d '{"experimental":{"two_theta":[10,20,30],"intensity":[100,200,150]},"candidates":[{"phase_id":"1","two_theta":[10,20,30],"intensity":[90,180,140]}],"n_iterations":10}'
   # Expected: JSON with CI bounds
   ```

4. **Upload XRD and verify CI:**
   - Upload XRD file
   - Wait for `match:ci_ready` event
   - Check database: `scoreLower` and `scoreUpper` populated

**Success Criteria:**
- ✅ Decomposition endpoint works
- ✅ Bootstrap CI endpoint works
- ✅ CI bounds stored in database
- ✅ WebSocket events delivered

---

## STEP 12: Enhanced UI Components

**Goal:** Add visualization components for results display.

### 12.1 Install Charting Library

```bash
docker exec web-oven-ap-lab npm install recharts
```

### 12.2 Create UI Components

#### [NEW] `src/components/xrd/MatchResultsTable.tsx`

```typescript
'use client';

interface MatchResult {
  rank: number;
  phase: { name: string; formula: string };
  score: number;
  scoreLower?: number;
  scoreUpper?: number;
}

export function MatchResultsTable({ results }: { results: MatchResult[] }) {
  const getConfidenceColor = (lower?: number, upper?: number) => {
    if (!lower || !upper) return 'gray';
    const width = upper - lower;
    if (width < 0.05) return 'green';
    if (width < 0.15) return 'yellow';
    return 'red';
  };

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Phase</th>
          <th>Formula</th>
          <th>Score</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.rank}>
            <td>{r.rank}</td>
            <td>{r.phase.name}</td>
            <td>{r.phase.formula}</td>
            <td>{r.score.toFixed(4)}</td>
            <td>
              <span className={`px-2 py-1 rounded bg-${getConfidenceColor(r.scoreLower, r.scoreUpper)}-200`}>
                {r.scoreLower && r.scoreUpper
                  ? `${r.scoreLower.toFixed(3)} - ${r.scoreUpper.toFixed(3)}`
                  : 'Computing...'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### ✅ CHECKPOINT 12: UI Components Verification

**Test Procedures:**

1. **Rebuild app:**
   ```bash
   docker compose up -d --build web-oven-ap-lab
   ```

2. **View results page:**
   - Upload XRD file
   - Navigate to results
   - **Expected: Confidence bars with colors**

3. **Verify existing app:**
   - Test all features
   - **Expected: No issues**

**Success Criteria:**
- ✅ Components render correctly
- ✅ Confidence colors display
- ✅ Existing app works

---

## STEP 13: Final Integration & Testing

**Goal:** End-to-end testing and production readiness.

### 13.1 Add Rate Limiting

#### [NEW] `src/lib/xrd/rate-limit.ts`

```typescript
import { getRedisClient } from './redis';

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60000
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `ratelimit:${endpoint}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  if (count >= limit) {
    return false;
  }

  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, Math.ceil(windowMs / 1000));
  return true;
}
```

Apply to API routes:

```typescript
// In match route
const allowed = await checkRateLimit(session.user.id, 'match', 10);
if (!allowed) {
  return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
}
```

---

### ✅ CHECKPOINT 13: Final Verification

**Test Procedures:**

1. **Full system test:**
   ```bash
   docker compose down
   docker compose up -d --build
   docker ps
   # Expected: All 4 services running
   ```

2. **Test existing app:**
   - Log in
   - Create booking
   - View reagents
   - Check announcements
   - **Expected: Everything works**

3. **Test XRD flow (admin):**
   - Navigate to `/admin/xrd/phases`
   - Upload CIF file
   - Wait for `cif:ready` event
   - Verify phase in database

4. **Test XRD flow (user):**
   - Navigate to `/xrd`
   - Upload XRD file
   - Wait for `match:done` event
   - View results with CI bounds
   - **Expected: Complete flow works**

5. **Test rate limiting:**
   - Upload 11 XRD files rapidly
   - **Expected: 11th returns 429**

6. **Performance check:**
   ```bash
   docker stats
   # Monitor CPU and memory usage
   # Expected: Within allocated limits
   ```

7. **Log check:**
   ```bash
   docker logs web-oven-ap-lab --tail 100
   docker logs xrd-compute --tail 100
   # Expected: No errors
   ```

**Success Criteria:**
- ✅ All services running
- ✅ Existing app fully functional
- ✅ Admin CIF upload works end-to-end
- ✅ User XRD matching works end-to-end
- ✅ WebSocket events delivered
- ✅ CI bounds computed
- ✅ Rate limiting works
- ✅ No errors in logs
- ✅ Resource usage acceptable

---

## Phase 1 Complete! 🎉

**Delivered Features:**
- ✅ Feature 1: Mixture Decomposition
- ✅ Feature 2: Uncertainty Quantification (Bootstrap CI)
- ✅ Feature 3: WebSocket Real-Time Progress
- ✅ Admin CIF Management
- ✅ User XRD Pattern Matching
- ✅ Phase Database Browser

**Infrastructure:**
- ✅ Python compute engine (FastAPI)
- ✅ Redis (BullMQ + pub/sub)
- ✅ MinIO (object storage)
- ✅ BullMQ job queues
- ✅ WebSocket/SSE real-time updates
- ✅ Rate limiting
- ✅ Error handling

**Next Steps:**
- Phase 2: Rietveld Refinement (Feature 4)
- COD bulk ingestion (optional)
- Performance optimization
- Additional UI polish

---

## Rollback Strategy

If critical issues arise:

```bash
# Stop XRD services
docker compose stop xrd-compute xrd-redis xrd-minio

# Revert code changes
git checkout HEAD -- src/app/api/xrd
git checkout HEAD -- src/lib/xrd
git checkout HEAD -- src/components/xrd
git checkout HEAD -- src/hooks/useXRDWebSocket.ts
git checkout HEAD -- prisma/schema.prisma
git checkout HEAD -- services/xrd-compute

# Regenerate Prisma
docker exec web-oven-ap-lab npx prisma generate
docker exec web-oven-ap-lab npx prisma db push

# Restart
docker compose up -d
```

---

## Maintenance & Monitoring

**Daily checks:**
- Monitor Redis memory usage
- Check BullMQ queue lengths
- Review error logs

**Weekly tasks:**
- Clean up old scan files (90-day retention)
- Vacuum PostgreSQL
- Review rate limit logs

**Commands:**
```bash
# Check queue status
docker exec xrd-redis redis-cli INFO memory

# View BullMQ queues
docker exec xrd-redis redis-cli KEYS "bull:*:wait" | wc -l

# Clean old scans (run weekly)
docker exec web-oven-ap-lab node scripts/cleanup-old-scans.js
```

---

*End of Phase 1 Implementation Plan. Version 3.0.0 (Incremental).*


