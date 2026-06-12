# NeuroNotes — Feature Inventory

> **Stage**: 1 — Technology Discovery
> **Evidence Source**: Existing documentation (Modules.md, ModuleMap.md)
> **Date**: 2026-06-12

---

## Feature Index

| ID | Feature Name |
|----|-------------|
| F01 | Meeting Management |
| F02 | Live Transcript Capture |
| F03 | Meeting Simulation |
| F04 | Voice Command Detection |
| F05 | Automation Approval Workflow |
| F06 | Post-Meeting Summary Generation |
| F07 | Action Item & Decision Extraction |
| F08 | Meeting Analytics & Insights |
| F09 | Live Visualization Generation |
| F10 | AI Chat Assistant |
| F11 | Voice AI Interaction |
| F12 | Email Summary Dispatch |
| F13 | Meeting Scheduling via Voice |
| F14 | Workspace & Team Management |
| F15 | Demo Mode |
| F16 | Dashboard & Meeting History |

---

## Feature Details

### F01 — Meeting Management

| Field | Value |
|-------|-------|
| **Feature ID** | F01 |
| **Feature Name** | Meeting Management |
| **Short Description** | Create, list, view, delete, and end meetings. Meetings progress through a lifecycle of scheduled → live → completed. Participants and meeting links are tracked per meeting. |
| **Primary User** | Meeting Host |
| **Major Modules Involved** | M1 (Meeting Lifecycle), M12 (Presentation Application) |
| **Documentation Sources** | Modules.md §1 — Meeting Lifecycle; ModuleMap.md §3 — Ownership Map |

---

### F02 — Live Transcript Capture

| Field | Value |
|-------|-------|
| **Feature ID** | F02 |
| **Feature Name** | Live Transcript Capture |
| **Short Description** | Real-time ingestion of speech-to-text data from an external Chrome extension (Transcriptonic) via webhook. Transcript is segmented into 1-minute windows, speakers are resolved to participant names, and data is stored for immediate display in the UI. |
| **Primary User** | Meeting Participant (passive — runs automatically) |
| **Major Modules Involved** | M2 (Transcript Engine), M1 (Meeting Lifecycle), M12 (Presentation Application) |
| **Documentation Sources** | Modules.md §2 — Transcript Engine (Process Webhook Batch, Resolve Speaker); ModuleMap.md §2 — Workflow W1 |

---

### F03 — Meeting Simulation

| Field | Value |
|-------|-------|
| **Feature ID** | F03 |
| **Feature Name** | Meeting Simulation |
| **Short Description** | Inject scripted, timed transcript data to simulate a live meeting for demonstrations and testing purposes without requiring an actual audio source. |
| **Primary User** | Developer / Demo Presenter |
| **Major Modules Involved** | M2 (Transcript Engine — SimulationService) |
| **Documentation Sources** | Modules.md §2 — Transcript Engine (Simulation Execution) |

---

### F04 — Voice Command Detection

| Field | Value |
|-------|-------|
| **Feature ID** | F04 |
| **Feature Name** | Voice Command Detection |
| **Short Description** | Detect explicit voice commands within the live transcript stream using "Hey NeuroNotes … Over" framing. The captured text is normalized, classified into an intent (e.g., schedule meeting, create visualization), and routed to the automation system for execution. |
| **Primary User** | Meeting Participant |
| **Major Modules Involved** | M3 (Command Interpreter), M4 (Automation Orchestrator) |
| **Documentation Sources** | Modules.md §3 — Command Interpreter (Process Stream Chunk, Classify Intent); ModuleMap.md §2 — Workflow W1 |

---

### F05 — Automation Approval Workflow

| Field | Value |
|-------|-------|
| **Feature ID** | F05 |
| **Feature Name** | Automation Approval Workflow |
| **Short Description** | Detected intents are logged as pending automation tasks. Users can review, modify parameters, and approve or reject them from the UI before any side-effect-producing action is executed. The system enforces idempotency to prevent duplicate actions. |
| **Primary User** | Meeting Host / Participant |
| **Major Modules Involved** | M4 (Automation Orchestrator), M12 (Presentation Application) |
| **Documentation Sources** | Modules.md §4 — Automation Orchestrator (Ingest Intent, Approve and Dispatch Automation); ModuleMap.md §2 — Workflow W3 |

---

### F06 — Post-Meeting Summary Generation

| Field | Value |
|-------|-------|
| **Feature ID** | F06 |
| **Feature Name** | Post-Meeting Summary Generation |
| **Short Description** | When a meeting ends, the full transcript is analyzed by an LLM to produce a structured summary containing key points, decisions, action items, opportunities, risks, eligibility criteria, and open questions. The summary is saved to the meeting record. |
| **Primary User** | Meeting Host / All Participants |
| **Major Modules Involved** | M6 (Insight Generator), M5 (Intelligence Core), M1 (Meeting Lifecycle) |
| **Documentation Sources** | Modules.md §6 — Insight Generator (Generate Comprehensive Summary); ModuleMap.md §2 — Workflow W2 |

---

### F07 — Action Item & Decision Extraction

| Field | Value |
|-------|-------|
| **Feature ID** | F07 |
| **Feature Name** | Action Item & Decision Extraction |
| **Short Description** | The system identifies discrete commitments (action items with assignees and statuses) and finalized agreements (decisions with confidence scores) from meeting transcripts. These are persisted as independent, trackable entities. |
| **Primary User** | Meeting Host / Team Members |
| **Major Modules Involved** | M6 (Insight Generator), M5 (Intelligence Core), M12 (Presentation Application — Actions view) |
| **Documentation Sources** | Modules.md §6 — Insight Generator (Artifact Extraction) |

---

### F08 — Meeting Analytics & Insights Dashboard

| Field | Value |
|-------|-------|
| **Feature ID** | F08 |
| **Feature Name** | Meeting Analytics & Insights Dashboard |
| **Short Description** | Provides computed and AI-generated analytics for a completed meeting: speaker participation statistics (word counts, speaking time), engagement timeline, topic breakdown, and sentiment analysis. Displayed in a dedicated Insights view. |
| **Primary User** | Meeting Host / Team Lead |
| **Major Modules Involved** | M6 (Insight Generator), M5 (Intelligence Core), M12 (Presentation Application — Insights view) |
| **Documentation Sources** | Modules.md §6 — Insight Generator (Compute Meeting Analytics, Sentiment and Topic Analysis); ModuleMap.md §2 — Workflow W7 |

---

### F09 — Live Visualization Generation

| Field | Value |
|-------|-------|
| **Feature ID** | F09 |
| **Feature Name** | Live Visualization Generation |
| **Short Description** | During a meeting, users can verbally request chart generation (bar, line, pie, timeline) from data points spoken in the conversation. The system uses an LLM to extract quantitative data from the transcript, validates the chart configuration, and renders it live in the UI. |
| **Primary User** | Meeting Participant |
| **Major Modules Involved** | M7 (Visualization Pipeline), M5 (Intelligence Core), M4 (Automation Orchestrator), M3 (Command Interpreter), M12 (Presentation Application — VisualIntelligence view) |
| **Documentation Sources** | Modules.md §7 — Visualization Pipeline (Generate Visualization from Content, Validate Chart Candidate); ModuleMap.md §2 — Workflow W6 |

---

### F10 — AI Chat Assistant

| Field | Value |
|-------|-------|
| **Feature ID** | F10 |
| **Feature Name** | AI Chat Assistant |
| **Short Description** | A text-based conversational interface grounded in the meeting's transcript. Users can ask natural language questions about what was discussed, or use slash commands (/summary, /actions, /decisions, /insights) to get predefined analysis. Responses include provenance metadata (speakers involved, timeframe analyzed, confidence score). |
| **Primary User** | Meeting Participant / Reviewer |
| **Major Modules Involved** | M8 (Conversational Interface), M5 (Intelligence Core), M2 (Transcript Engine), M12 (Presentation Application) |
| **Documentation Sources** | Modules.md §8 — Conversational Interface (Handle Chat Query); ModuleMap.md §2 — Workflow W4 |

---

### F11 — Voice AI Interaction

| Field | Value |
|-------|-------|
| **Feature ID** | F11 |
| **Feature Name** | Voice AI Interaction |
| **Short Description** | Users speak a question about the meeting and receive both a text response and synthesized audio playback. The response is generated by an LLM (optimized for speech: concise, no markdown) and converted to audio via ElevenLabs TTS. Gracefully degrades to text-only if TTS is unavailable. |
| **Primary User** | Meeting Participant |
| **Major Modules Involved** | M9 (Voice Interaction), M5 (Intelligence Core), M2 (Transcript Engine), M12 (Presentation Application — Voice component) |
| **Documentation Sources** | Modules.md §9 — Voice Interaction (Handle Voice Interaction, Generate Audio); ModuleMap.md §2 — Workflow W5 |

---

### F12 — Email Summary Dispatch

| Field | Value |
|-------|-------|
| **Feature ID** | F12 |
| **Feature Name** | Email Summary Dispatch |
| **Short Description** | After a meeting ends (or upon user approval), the system composes a professional HTML email containing the meeting summary and dispatches it to resolved recipients via an n8n webhook. Recipients are determined from explicit selections or fall back to workspace member defaults. |
| **Primary User** | Meeting Host |
| **Major Modules Involved** | M10 (Communication & Notification), M4 (Automation Orchestrator), M11 (Workspace & Identity) |
| **Documentation Sources** | Modules.md §10 — Communication & Notification (Generate Email Summary Payload, Dispatch Webhook); ModuleMap.md §2 — Workflows W2, W3 |

---

### F13 — Meeting Scheduling via Voice

| Field | Value |
|-------|-------|
| **Feature ID** | F13 |
| **Feature Name** | Meeting Scheduling via Voice |
| **Short Description** | Users verbally request scheduling of a follow-up meeting during a live session. The command is detected, parameters (title, date, participants) are refined by an LLM, and a pending automation is created for user approval. Upon approval, a new meeting record is created in the system. |
| **Primary User** | Meeting Participant |
| **Major Modules Involved** | M3 (Command Interpreter), M4 (Automation Orchestrator), M5 (Intelligence Core), M1 (Meeting Lifecycle) |
| **Documentation Sources** | Modules.md §3 — Command Interpreter (Classify Intent — schedule_meeting); Modules.md §4 — Automation Orchestrator (Approve and Dispatch — schedule_meeting); ModuleMap.md §2 — Workflows W1, W3 |

---

### F14 — Workspace & Team Management

| Field | Value |
|-------|-------|
| **Feature ID** | F14 |
| **Feature Name** | Workspace & Team Management |
| **Short Description** | Create, update, and delete team workspaces. Each workspace maintains a member directory (name and email) used as the default recipient pool for email summaries and as the organizational boundary for meeting grouping. |
| **Primary User** | Team Administrator |
| **Major Modules Involved** | M11 (Workspace & Identity), M12 (Presentation Application — Settings view) |
| **Documentation Sources** | Modules.md §11 — Workspace & Identity (Workspace CRUD Operations, Resolve Workspace Members) |

---

### F15 — Demo Mode

| Field | Value |
|-------|-------|
| **Feature ID** | F15 |
| **Feature Name** | Demo Mode |
| **Short Description** | A system-wide feature flag (`DEMO_MODE`) that causes all LLM-dependent features to return deterministic, hardcoded responses instead of making external API calls. Allows the full application to be demonstrated without API keys or network connectivity. |
| **Primary User** | Developer / Demo Presenter |
| **Major Modules Involved** | M5 (Intelligence Core), X1 (Configuration & Environment) |
| **Documentation Sources** | Modules.md §5 — Intelligence Core (Demo Fallback Interception); Modules.md §13 — Configuration & Environment (Feature Flag Evaluation) |

---

### F16 — Dashboard & Meeting History

| Field | Value |
|-------|-------|
| **Feature ID** | F16 |
| **Feature Name** | Dashboard & Meeting History |
| **Short Description** | A central overview of all meetings with statistics (total meetings, meetings this week, productivity score, engagement rate, action item completion). Provides a historical list of completed meetings with their summaries, and the ability to navigate to detailed views for any past meeting. |
| **Primary User** | All Users |
| **Major Modules Involved** | M12 (Presentation Application — Dashboard, MeetingsHistory views), M1 (Meeting Lifecycle) |
| **Documentation Sources** | Modules.md §12 — Presentation Application (Live Meeting View, View Composition); Modules.md §1 — Meeting Lifecycle (Public Interface Surface — GET /api/meetings) |

---

## Summary

| Metric | Count |
|--------|-------|
| Total User-Visible Features | 16 |
| Features requiring LLM | 7 (F04, F06, F07, F08, F09, F10, F11) |
| Features requiring external APIs | 3 (F10/F11 via Groq, F11 via ElevenLabs, F12 via n8n) |
| Features available in Demo Mode | All (via F15 fallbacks) |
| Modules with user-facing features | 10 of 14 |
