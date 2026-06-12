# Documentation Gap Analysis

Based on a review of `Modules.md`, `ModuleMap.md`, and the synthesized feature inventory, several technical and behavioral details remain undocumented or ambiguous.

---

### Gap ID: GQ-01
**Missing Information**: Core Database Schemas (MongoDB & Firestore)
**Why It Matters**: The documentation refers to entities like `Meeting`, `ActionItem`, `Decision`, `MinuteWindow`, `AutomationLog`, and `VisualArtifact`, but their exact fields, validation constraints, and indexing strategies are unknown. Without this, we cannot guarantee data integrity or write accurate database migration scripts.
**Suggested Files To Inspect**: `server/src/models/*.js` (Mongoose schemas)
**Confidence Level**: High (Schema details are definitively missing from current docs)

---

### Gap ID: GQ-02
**Missing Information**: LLM Prompt Structures and Constraints
**Why It Matters**: Features F06 (Summary), F07 (Artifacts), F09 (Visualization), and F10 (Chat) rely entirely on complex LLM prompting. We do not know how context is injected, what strict JSON formatting instructions are given, or how the system protects against prompt injection or hallucination. The exact system prompts dictate the quality of the product.
**Suggested Files To Inspect**: `server/src/services/LLMService.js`
**Confidence Level**: High (Prompts are described conceptually, but actual text/structure is missing)

---

### Gap ID: GQ-03
**Missing Information**: Real-time Frontend Synchronization Mechanism
**Why It Matters**: F02 (Live Transcript) and F12 (Presentation Application) mention both "polling" and "Firestore syncing". It is unclear if the frontend relies purely on React `setInterval` polling against REST endpoints, or if it maintains active WebSocket/Firebase listeners. This dramatically affects scalability considerations.
**Suggested Files To Inspect**: `client/src/context/AppContext.tsx`, `client/src/services/firebase.ts`
**Confidence Level**: High (Contradictory/vague statements in documentation regarding real-time updates)

---

### Gap ID: GQ-04
**Missing Information**: Visualization Trigger Conflict Resolution
**Why It Matters**: F09 notes a "legacy trigger path via VisualizationTriggerService" alongside the new Command Interpreter (M3). It is undocumented how these two systems coexist. Do they race? Can a single spoken command trigger two identical charts?
**Suggested Files To Inspect**: `server/src/services/VisualizationTriggerService.js`, `server/src/services/AutomationService.js`
**Confidence Level**: Medium (Docs acknowledge the problem, but don't explain the current runtime behavior)

---

### Gap ID: GQ-05
**Missing Information**: Idempotency Lock Implementation
**Why It Matters**: F05 (Automation Approval) states the system checks for "duplicate active logs" to enforce idempotency. It is undocumented exactly what constitutes a duplicate (e.g., is it an exact match on `meetingId` + `intent` + `status=pending`?). If implemented incorrectly, users could trigger multiple identical automations.
**Suggested Files To Inspect**: `server/src/services/AutomationService.js` (specifically intent ingestion logic)
**Confidence Level**: High (Concept mentioned, mechanism undocumented)

---

### Gap ID: GQ-06
**Missing Information**: Web Speech API Client Implementation
**Why It Matters**: F11 (Voice Interaction) relies on browser-native STT (Web Speech API). The documentation does not detail how microphone permissions are handled, how speech end-detection works, or what fallback exists if the browser (e.g., Firefox/Safari) does not fully support the API.
**Suggested Files To Inspect**: `client/src/components/VoiceInteraction.tsx` (or similar voice component)
**Confidence Level**: Medium (Implementation details of client-side APIs are generally missing)

---

### Gap ID: GQ-07
**Missing Information**: Webhook Error Handling and Retries
**Why It Matters**: F12 (Email Dispatch) relies on sending data to an n8n webhook. If n8n is down, does the `email_summary` automation fail silently? Is there a timeout? The documentation states there is "no retry mechanism", but does not document how the failure state is presented to the user.
**Suggested Files To Inspect**: `server/src/services/AutomationService.js` (webhook dispatch method), `utils/errorHandler.js`
**Confidence Level**: High (Critical failure path behavior is undocumented)

---

## Confirmed Documentation Discrepancies

Based on a minimal codebase inspection, the following discrepancies between the documentation and the actual implementation have been confirmed:

### 1. Real-time Synchronization (Firestore vs Polling)
* **Documentation Claim**: Transcript data is persisted to "Firestore for real-time frontend updates" (e.g., F02, F03, Modules.md).
* **Codebase Reality**: The frontend (`client/src/context/AppContext.tsx`) relies exclusively on REST API polling via `setInterval(fetchTranscript, 3000)`. There are no active Firebase/Firestore listeners driving the UI updates.

### 2. Database Schema Duplication (Action Items & Decisions)
* **Documentation Claim**: `ActionItem` and `Decision` are independent entities/collections.
* **Codebase Reality**: The schema organization is fragmented. There are standalone files for `Action.js` and `Decision.js`, but there is also an `Insight.js` model that explicitly re-defines `ActionItemSchema` and `DecisionSchema` within the same file.
