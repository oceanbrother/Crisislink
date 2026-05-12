# CrisisLink System Architecture

## Executive Summary

CrisisLink is a 5-layer system designed to connect surplus food providers with relief organizations through rule-based filtering baseline logic, forecasting support, and real-time coordination.

## Layer Descriptions

### Layer 1: Users
**Participants in the system**
- **Donors**: Bakeries, restaurants, grocers with surplus food
- **Organizations**: Food banks, meal services, rescue operations

### Layer 2: Frontend (Mobile-First React)
**User interfaces**

#### Donor App (Amber Theme)
- **Listing Form**: 60-second food posting interface
- Photo upload with camera integration
- AI auto-fill with manual override capability
- Zero-friction authentication (postcode + org code)

#### Organization App (Teal Theme)
- **Live Listing Board**: Real-time available inventory
- **Our Needs**: Post specific requests
- **Gap Map**: Postcode-level demand visualization
- **Alerts**: Smart demand warnings with explanations
- WebSocket-driven updates

### Layer 3: Backend Microservices (Python FastAPI)

#### Services
- **Listing Service**: CRUD operations for food listings
- **Matching Service**: rule-based surplus-to-need filtering baseline with notifications
- **Prediction Service**: Weekly demand forecasting and gap alerts
- **API Router**: Request routing and orchestration

#### Architecture Pattern
- Microservices communicate via direct function calls within same Python process
- All services share connection to PostgreSQL
- Integration with Layer 4 models through unified AI connector

### Layer 4: AI Engine (Python)

#### Components
1. **Food Photo Recognition**
   - Model: SegFormer fine-tuned on Food-101
   - Output: Food type, estimated portions, confidence score
   - Fallback: Google Cloud Vision API (confidence < 70%)

2. **Surplus-to-Org Matcher (Current Baseline)**
   - Approach: rule-based filtering and ranking heuristics
   - Input: Donation metadata + org preference/profile fields
   - Output: Filtered/ranked candidates for board views

3. **K-Means Postcode Clustering**
   - Input: SEIFA deciles, housing stress, income
   - Output: Postcode risk clusters (low/medium/high)

4. **Random Forest Demand Forecaster**
   - Input: Cluster profile, welfare cycle timing, seasonality, supply counts
   - Output: Weekly risk score, confidence intervals
   - Explainability: Feature importance for each prediction

### Layer 5: Data (PostgreSQL + External Datasets)

#### PostgreSQL Tables
- `listings`: Current and historical food offerings
- `organizations`: Registered relief organizations
- `needs`: Posted requirements from organizations
- `claims`: Link between listings and organizations
- `feedback`: User ratings and match quality data

#### External Data
- **ABS SEIFA 2021**: Socioeconomic indices by postcode
- **Census 2021**: Population, housing, employment data by region
- **Food-101**: Training dataset for image recognition model

## Data Flow

```
DONOR PATH:
David (Donor)
    ↓ [Photo + Details]
Layer 2: Donor App
    ↓ [POST /listings]
Layer 3: Listing Service → PostgreSQL
    ↓ [New Listing Event]
Layer 3: Matching Service (rule-based baseline)
    ↓ [Filtered/ranked candidates]
Layer 3: Matching Service → PostgreSQL (log matches)
    ↓ [Push notification]
Layer 2: Org App → Sarah (Organization) [WebSocket update]


ORGANIZATION PATH:
Sarah (Organization) → Layer 2: Org App Dashboard
    ↓ [View available listings]
Layer 2 connects to Layer 3: Listing Service [WebSocket for real-time updates]
    ↓ [Browse matches ranked by rule-based baseline]
Layer 3: Matching Service (displays ranked matches)
    ↓ [Click claim]
Layer 3: Listing Service → PostgreSQL (update status)


PREDICTION PATH:
[Weekly scheduled trigger]
Layer 3: Prediction Service
    ↓ [Call Layer 4 models]
Layer 4: K-Means + Random Forest
    ↓ [Generate risk scores]
Layer 3: Prediction Service → PostgreSQL (store predictions)
    ↓ [Identify high-gap postcodes]
Layer 2: Org App → Alerts tab [Show with explanations]
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Python FastAPI Backend | Direct ML model integration; async I/O for microservices |
| WebSocket for Real-Time | Low-latency updates for Live Listing Board; better UX than polling |
| No API Gateway (Phase 1) | Minimal infrastructure overhead; can evolve when service count increases |
| Color-Coded Apps | Visual consistency (Amber for donors, Teal for orgs) reduces cognitive load |
| AI Model Explainability | Alerts must show "why" to build user trust in ML decisions |

## Deployment Architecture (Future)

```
Docker Containers:
├── PostgreSQL (Layer 5)
├── FastAPI Backend + AI Engine (Layer 3 + 4)
├── React Donor App (Layer 2)
└── React Org App (Layer 2)

Orchestration: Docker Compose (local) → Kubernetes (production)
```

## Development Phases

1. **Phase 1 (Parallel)**: DataOps team builds Layer 5 + 4
2. **Phase 2**: Backend team implements Layer 3
3. **Phase 3**: Frontend team develops Layer 2
4. **Phase 4**: Integration testing + production deployment

---

**Last Updated**: April 2026
**Next Review**: After Phase 1 completion
