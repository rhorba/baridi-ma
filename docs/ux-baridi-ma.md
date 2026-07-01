# UX Foundation: Baridi.ma
**PRD Reference**: docs/prd-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: UX Designer

## 1. User Personas (minimal)
| Persona | Role | Goal | Pain Point |
|---|---|---|---|
| Amina | Shipper (dairy co-op export manager) | Create a shipment, hand off to a carrier, prove compliance later | Currently uses paper logs; loses shipments to failed EU customs checks |
| Youssef | Carrier (refrigerated truck operator) | See what's assigned to him, know instantly if there's a temp problem in transit | No visibility into sensor status without checking the physical unit |
| Karim | Receiver (EU importer's Morocco agent) | Confirm cold-chain was maintained before accepting delivery | No trustworthy record — has to take the shipper's word for it |
| Admin (internal) | Admin | Oversee all shipments, manage accounts | N/A (internal ops) |

## 2. Information Architecture / Site Map
```
[App Root] (role-based landing)
├── /login, /register
├── /shipments                  (list, scoped by role)
│   ├── /shipments/new          (Shipper only)
│   └── /shipments/[id]         (live tracking view, all roles with access)
│       └── /shipments/[id]/compliance-export  (Receiver/Admin)
├── /alerts                     (list, filterable by shipment)
└── /admin                      (Admin only)
    ├── /admin/users
    └── /admin/shipments
```

## 3. Core User Flows (top 3 journeys)

### Flow 1: Shipper creates and dispatches a shipment
```
[Login] → [Shipments list] → [New Shipment form: product, origin, destination, temp thresholds]
   → [Assign carrier] → [Shipment status: created] → [Carrier accepts, status: in_transit]
```

### Flow 2: Carrier monitors in-transit shipment, alert fires
```
[Login] → [My shipments (assigned)] → [Shipment detail: live temp/humidity]
   → Sensor reading breaches threshold → [In-app alert badge + email] → [Carrier views alert detail] → [Carrier takes corrective action, notes it — MVP: no in-app resolution workflow, just visibility]
```

### Flow 3: Receiver confirms delivery and exports compliance PDF
```
[Login] → [Incoming shipments] → [Shipment marked delivered by Carrier]
   → [Receiver opens shipment detail] → [Views full temp/humidity history + any alerts]
   → [Clicks "Export Compliance PDF"] → [Downloads signed PDF]
                                ↓ (if excursions occurred)
                          [History shows red-flagged periods, PDF includes alert log]
```

## 4. Key Screen Wireframes (text-based)

### Screen: Shipment Detail (live tracking)
```
┌───────────────────────────────────────────┐
│ ← Shipments   Shipment #A1B2   [in_transit]│
├───────────────────────────────────────────┤
│ Product: Dairy — Origin: Casablanca         │
│ Destination: Rotterdam (via port)           │
│                                             │
│  Current: 4.2°C  62% RH        ✅ Normal   │
│  [ Temp/humidity chart over time ]          │
│                                             │
│  Thresholds: 2°C – 8°C / 40% – 70% RH       │
│                                             │
│  ⚠ 1 Alert: Temp excursion 09:14 (8.6°C)   │
│                                             │
│  [ Export Compliance PDF ]  (enabled when   │
│    status = delivered)                      │
├───────────────────────────────────────────┤
│ Footer                                      │
└───────────────────────────────────────────┘
```

## 5. Screen States
| Screen | Empty State | Loading | Error | Success |
|---|---|---|---|---|
| Shipments list | "No shipments yet — create your first shipment" + CTA | Skeleton rows | "Couldn't load shipments, retry" | List renders with status badges |
| Shipment detail | N/A (always has data once created) | Skeleton chart + fields | "Shipment not found or access denied" | Live data + chart render |
| Compliance export | N/A | "Generating PDF..." spinner (sync, <2s) | "Export failed, try again" | PDF download triggers |
| Alerts list | "No alerts — all shipments within range" | Skeleton rows | "Couldn't load alerts" | List with reason/value/threshold |
