# NeuroNotes Module Map

This document provides high-level architectural matrices detailing dependencies, workflows, ownership, coupling, and extractability for the 12 primary logical modules in the NeuroNotes system.

---

## 1. Module Dependency Matrix

| Consuming Module ↓ \ Provided By → | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 | X1/X2 |
|------------------------------------|---|---|---|---|---|---|---|---|---|----|----|----|-------|
| **M1: Meeting Lifecycle** | - | | | | | | | | | | O | | X |
| **M2: Transcript Engine** | O | - | | | | | | | | | | | X |
| **M3: Command Interpreter** | | | - | | O*| | | | | | | | X |
| **M4: Automation Orchestrator** | O | | | - | X | | O | | | O | | | X |
| **M5: Intelligence Core** | | | | | - | | | | | | | | X |
| **M6: Insight Generator** | | O | | | X | - | | | | | | | X |
| **M7: Visualization Pipeline** | | | | | X | | - | | | | | | X |
| **M8: Conversational Interface** | | X | | | X | | | - | | | | | X |
| **M9: Voice Interaction** | | X | | | X | | | | - | | | | X |
| **M10: Communication & Notif.** | | | | | | | | | | - | X | | X |
| **M11: Workspace & Identity** | | | | | | | | | | | - | | X |
| **M12: Presentation Application**| X | X | | X | | X | X | X | X | | X | - | |

**Legend:**
* **X**: Hard Dependency (Required for core function)
* **O**: Soft/Allowed Dependency (Read-only reference or async dispatch)
* **O\***: Future Dependency

---

## 2. Workflow Participation Matrix

| Workflow | Initiator | Middle-Tier Processors | Final Executing Handlers |
|----------|-----------|------------------------|--------------------------|
| **W1: Live Transcript Ingestion** | M12 / Ext | M2 → M3 → M4 | M1, M7, M10 |
| **W2: Post-Meeting Summary** | M1 | M6 → M5 | M4 → M10 |
| **W3: Automation Approval** | M12 | M4 | M1, M10 |
| **W4: AI Chat Interaction** | M12 | M8 → M2 → M5 | M12 (UI) |
| **W5: Voice Interaction** | M12 | M9 → M2 → M5 | M9 (TTS), M12 (UI) |
| **W6: Visualization Generation** | M4 | M7 → M5 | M12 (UI) |
| **W7: Insights Request** | M12 | M6 → M5 | M12 (UI) |

---

## 3. Ownership Map

| Domain Concept / Entity | Authoritative Owner |
|-------------------------|---------------------|
| `Meeting` (Status, Times, Title) | **M1: Meeting Lifecycle** |
| `MinuteWindow` (Transcript Data) | **M2: Transcript Engine** |
| `AutomationLog` (Pending/Approved state) | **M4: Automation Orchestrator** |
| `VisualArtifact` (Chart Configurations) | **M7: Visualization Pipeline** |
| `ActionItem` / `Decision` | **M6: Insight Generator** |
| `Workspace` / Member Directory | **M11: Workspace & Identity** |
| LLM API Keys & Prompts | **M5** (Keys) / Calling Modules (Prompts) |
| HTML Email Templates | **M10: Communication & Notification** |
| "Hey NeuroNotes" Regex/Keywords | **M3: Command Interpreter** |

---

## 4. Extractability & Coupling Map

This matrix highlights how tightly coupled the current implementation is, versus how easily the *ideal* module could be extracted into a standalone microservice.

| Module | Current Coupling | Extractability Potential | Target Architecture |
|--------|------------------|--------------------------|---------------------|
| M1: Meeting Lifecycle | High (Tangled in endMeeting) | High | Independent Node Service |
| M2: Transcript Engine | High (Coupled to Automation) | High | Streaming Ingest Service |
| M3: Command Interpreter | Severe (Trapped in Service) | Very High | NPM Package / Stateless API |
| M4: Automation Orchestrator | Severe ("God Object") | High | Workflow Engine Service |
| M5: Intelligence Core | Severe ("God Object") | Very High | API Gateway Service |
| M6: Insight Generator | High (Trapped in LLMService) | High | Analytics/Batch Service |
| M7: Visualization Pipeline | Medium (Dual triggers) | High | Stateless Generator API |
| M8: Conversational Interface| Medium | High | Chatbot Backend |
| M9: Voice Interaction | Low (Clean adapter) | High | Streaming Audio Service |
| M10: Communication | Severe (Trapped in M4/M1) | High | Notification Worker Queue |
| M11: Workspace & Identity | Low | High | Standard Auth/IAM Service |
| M12: Presentation App | High (API URLs, M12a vs M12b) | High | Static CDN Deployment |
