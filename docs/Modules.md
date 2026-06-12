# NeuroNotes Modules - Table of Contents

1. [Meeting Lifecycle](#1-meeting-lifecycle)
2. [Transcript Engine](#2-transcript-engine)
3. [Command Interpreter](#3-command-interpreter)
4. [Automation Orchestrator](#4-automation-orchestrator)
5. [Intelligence Core](#5-intelligence-core)
6. [Insight Generator](#6-insight-generator)
7. [Visualization Pipeline](#7-visualization-pipeline)
8. [Conversational Interface](#8-conversational-interface)
9. [Voice Interaction](#9-voice-interaction)
10. [Communication Notification](#10-communication-notification)
11. [Workspace Identity](#11-workspace-identity)
12. [Presentation Application](#12-presentation-application)
13. [Configuration & Environment](#13-configuration-&-environment)
14. [Observability](#14-observability)

---

# 1. Meeting Lifecycle

## Purpose
To manage the end-to-end lifecycle of a meeting entity within the NeuroNotes system, acting as the foundational domain object around which transcripts, insights, and automations are anchored.

## Core Responsibility
Handle the creation, state transitions, participant tracking, duration tracking, and termination of meeting instances, ensuring the integrity of meeting metadata.

## Owned Domain Concepts
* **Meeting**: The core entity representing a recorded or scheduled session.
* **Meeting Status**: The lifecycle state machine (scheduled → live → completed).
* **Participant**: An individual attending the meeting.

## Owned State
* `Meeting` entity records (in MongoDB).
  * `title` (String)
  * `status` (Enum: 'live', 'completed', 'scheduled')
  * `startTime` (Date)
  * `endTime` (Date)
  * `participants` (Array of Strings)
  * `meetingLink` (String)
  * `workspaceId` (ObjectId)
  * `selectedRecipients` (Array of {name, email})
  * `summary` (Object with keyPoints, decisions, etc., acting as an aggregate root view)

## Responsibilities

* **Meeting Creation**
  * Definition: Initializing a new meeting record.
  * Owned behaviors: Validating inputs, setting default status, recording start time.
  * Ownership scope: Strictly metadata initialization.
  * Workflow participation: W1 (Ingestion setup), W3 (Automation execution for scheduling).

* **Lifecycle Management**
  * Definition: Progressing the meeting through its logical states.
  * Owned behaviors: Transitioning from scheduled to live, live to completed.
  * Ownership scope: The `status` field and associated timestamps (`startTime`, `endTime`).
  * Workflow participation: W2 (Meeting End).

* **Participant Tracking**
  * Definition: Maintaining the roster of meeting attendees.
  * Owned behaviors: Adding/removing participants, resolving generic speaker IDs to participants.
  * Ownership scope: The `participants` field.
  * Workflow participation: W1, W2.

## Requirements

* **State Integrity**
  * Definition: A meeting can only transition in logical forward states (scheduled → live → completed).
  * Constraints: Cannot transition from completed back to live.
  * Invariants: If `status` is 'completed', `endTime` MUST be set.
  * Validation expectations: Input state enum validation.
  * Operational expectations: Audit logging of state changes.

* **Anchor Reference**
  * Definition: The meeting must provide a stable ID for all related domain objects.
  * Constraints: A meeting ID cannot be modified once created.
  * Invariants: Associated artifacts (transcripts, insights) must orphan or cascade delete if a meeting is deleted.
  * Validation expectations: Valid UUID/ObjectId format.
  * Operational expectations: Highly available read access for associated sub-domains.

## Functionalities

### Create Meeting

#### Definition
Instantiates a new meeting record with initial metadata and sets the state to 'scheduled' or 'live'.

#### Current Implementation
Handled in `meetingController.createMeeting`. Receives body parameters, defaults status to 'live', and writes to `meetingRepository`. It is also incorrectly implemented inside `AutomationService.approveAutomation()` for the 'schedule_meeting' intent, where it creates a meeting internally.

#### Ideal Implementation
Exposed as a clean API endpoint and an internal service method `createMeeting(dto)`. The Automation Orchestrator (M4) should call this internal service method instead of reinventing the creation logic or directly accessing the repository.

#### Inputs
* `title` (string)
* `participants` (array of strings)
* `status` (string)
* `startTime` (Date)
* `meetingLink` (string)
* `workspaceId` (string)
* `selectedRecipients` (array of objects)

#### Outputs
* `Meeting` entity (transformed)

#### Side Effects
* Persists data to MongoDB.

#### State Mutations
* Inserts a new `Meeting` document.

#### Dependencies
* Database configuration (X1).

#### Failure Conditions
* Database connection failure.
* Invalid workspaceId reference.

#### Operational Considerations
* Minimal latency required for rapid meeting start from the client.

#### Scalability Considerations
* Indexing on `workspaceId` and `status` to quickly retrieve live meetings for a user.

#### Coupling Notes
* Currently coupled to `AutomationService` via direct repository access. This must be decoupled.

#### Security Considerations
* Must validate authorization context to ensure the user can create a meeting in the specified workspace.

#### Testability Considerations
* Easily unit testable by mocking the repository layer.

### End Meeting

#### Definition
Transitions a meeting from 'live' to 'completed', recording the end time.

#### Current Implementation
`meetingController.endMeeting` updates the status to 'completed'. It then performs a massive violation of boundaries by explicitly fetching workspace members, fetching the transcript, calling `LLMService` to generate a summary, and calling `AutomationLog.create` to queue an email summary.

#### Ideal Implementation
`MeetingService.endMeeting(id)` updates the meeting state and emits a domain event: `MeetingEndedEvent`. The Insight Generator (M6) and Automation Orchestrator (M4) listen to this event to perform their respective post-meeting workflows.

#### Inputs
* `meetingId` (string)

#### Outputs
* Success confirmation.

#### Side Effects
* State transition in DB.
* (Ideal) Domain event emission.

#### State Mutations
* Updates `Meeting.status` to 'completed'.
* Updates `Meeting.endTime` to current timestamp.

#### Dependencies
* Database configuration.

#### Failure Conditions
* Meeting ID not found.
* Database update failure.

#### Operational Considerations
* The state update must be fast; post-processing MUST be asynchronous to avoid blocking the client request.

#### Scalability Considerations
* Event emission allows decoupled scaling of post-meeting processing workers.

#### Coupling Notes
* Currently heavily coupled to M6 (Insight Generator), M4 (Automation Orchestrator), and M11 (Workspace). Needs to be decoupled via events or explicit orchestration.

#### Security Considerations
* Only participants or workspace admins can end a meeting.

#### Testability Considerations
* Requires decoupling to effectively unit test the state transition without mocking LLMs and Webhooks.

## Workflow Participation
* **W1 (Live Transcript Ingestion Pipeline)**: Provides the active meeting ID.
* **W2 (Meeting End → Post-Meeting Automation)**: Initiates the workflow by marking the meeting complete.
* **W3 (Automation Approval Pipeline)**: Consumes the 'schedule_meeting' intent to create a new meeting.

## Direct Dependencies
* X1 (Configuration & Environment)
* X2 (Observability)
* Database Driver (Mongoose)

## Allowed Dependencies
* M11 (Workspace & Identity - for reference validation only)

## Forbidden Dependencies
* M4 (Automation Orchestrator) - Should not know about automations.
* M5 (Intelligence Core) - Should not call LLMs directly.
* M6 (Insight Generator) - Should not generate its own summary.
* M10 (Communication) - Should not send emails.

## Encapsulation Boundaries
Strictly encapsulates the `Meeting` entity in the database. No other module should write to the `Meeting` collection directly.

## Public Interface Surface
* `POST /api/meetings`
* `GET /api/meetings`
* `GET /api/meetings/:id`
* `DELETE /api/meetings/:id`
* `POST /api/meetings/:id/end`

## Internal Implementation Details
Currently uses Mongoose (`meetingRepository.js`) to interact with MongoDB. Uses `transformers.js` to format output for the client.

## Reusability Potential
High. The concept of a scheduled/live/completed session is universal to productivity apps.

## Extractability Potential
High. Easily extractable into a standalone `Meeting Service` microservice.

## Scalability Considerations
Read-heavy for listing meetings. Caching layer (e.g., Redis) could be implemented for `GET /api/meetings` if tenant scale grows.

## Operational Responsibilities
Ensuring meetings are not left in a 'live' state indefinitely (zombie meetings). Requires a cleanup chron job.

## Current Architectural Problems
* The `endMeeting` controller acts as a god function orchestrating LLM calls, workspace queries, and automation log creation.
* `AutomationService` directly uses `meetingRepository` to create scheduled meetings.

## Technical Debt Impact
High. The coupling in `endMeeting` makes testing impossible without the full stack and risks failing the meeting termination if an external API (like Groq) is down.

## Future Expansion Opportunities
* Calendar synchronization (Google/Outlook).
* Recurring meetings.
* Role-based participant permissions (Host, Viewer, Editor).
* Meeting templates.

## Ownership Violations in Current Implementation
* `AutomationService` claims ownership of creating meetings for the `schedule_meeting` intent.
* `meetingController` claims ownership of composing the email automation and generating the summary upon meeting end.

## Recommended Refactoring Directions
1. Remove all LLM, Workspace, and Automation code from `meetingController.endMeeting`.
2. Implement a simple event bus or direct async method invocation to trigger post-meeting processing.
3. Expose a `createScheduledMeeting` internal interface for `AutomationService` to call instead of direct repository access.


# 2. Transcript Engine

## Purpose
To capture, normalize, time-bucket, store, and serve raw transcript data generated during a meeting. This module acts as the authoritative source of truth for "what was said and when."

## Core Responsibility
Manage the ingestion of continuous speech-to-text streams from various sources (Chrome extension, simulation), resolve speakers, segment data into manageable minute-windows, and provide real-time updates to connected clients (via Firestore).

## Owned Domain Concepts
* **Transcript Segment**: A single utterance or block of text spoken by an individual.
* **Minute Window**: A time-bucketed collection of transcript segments grouped by minute for efficient processing and retrieval.
* **Speaker Resolution**: The process of identifying the speaker of a segment based on context or metadata.

## Owned State
* `MinuteWindow` entity records (in Firestore/MongoDB).
  * `meetingId` (Reference)
  * `startTime` (Date)
  * `endTime` (Date)
  * `segments` (Array of {speaker, text, timestamp})
  * `transcript` (Legacy String field)
  * `speaker` (Legacy String field)
  * `processed` (Boolean flag for downstream processors)

## Responsibilities

* **Ingestion API**
  * Definition: Providing endpoints for external services to push transcript data.
  * Owned behaviors: Accepting webhook batches or individual chunks, validating payload structure.
  * Ownership scope: The `/api/ingest` routes and associated data mapping.
  * Workflow participation: W1 (Live Transcript Ingestion Pipeline).

* **Time Windowing**
  * Definition: Grouping continuous streams of text into discrete 1-minute blocks.
  * Owned behaviors: Calculating window boundaries based on timestamps, upserting data into the correct block.
  * Ownership scope: The `MinuteWindow` schema structure.
  * Workflow participation: W1.

* **Speaker Resolution**
  * Definition: Normalizing raw speaker identifiers into meaningful names based on meeting context.
  * Owned behaviors: Mapping 'Unknown' or '0' to the host, mapping IDs to participant names.
  * Ownership scope: The logic that assigns a `speaker` string to a segment.
  * Workflow participation: W1.

* **Simulation Execution**
  * Definition: Injecting scripted transcript data to simulate an active meeting for testing or demonstrations.
  * Owned behaviors: Running the timed script loop, calling the internal ingestion logic.
  * Ownership scope: The `SimulationService` script and timer.
  * Workflow participation: Standalone testing capability.

## Requirements

* **High Throughput Ingestion**
  * Definition: Must handle rapid, concurrent updates from live audio transcription.
  * Constraints: Cannot drop chunks; must handle out-of-order delivery gracefully.
  * Invariants: Every segment must belong to a valid `MinuteWindow`.
  * Validation expectations: Payload must contain meetingId, text, timestamp, and speaker.
  * Operational expectations: Near real-time write latency to support live UI updates.

* **Idempotent Updates**
  * Definition: Handling the same chunk multiple times safely.
  * Constraints: Time-window upserts must use atomic operations (e.g., Firestore arrayUnion or specific document IDs).

## Functionalities

### Process Webhook Batch

#### Definition
Receives an array of transcript segments from an external source (e.g., Transcriptonic Chrome Extension) and stores them.

#### Current Implementation
`ingestController.ingestWebhook` iterates through a `transcriptBatch`. For each block, it resolves the speaker using a heuristic against the latest live meeting, upserts the `MinuteWindow`, and immediately calls `AutomationService.processChunk()`.

#### Ideal Implementation
The controller validates the batch and passes it to a `TranscriptService`. The service resolves speakers, performs a batch write to the database (for efficiency), and emits a `TranscriptChunkReceived` domain event. Downstream modules (Command Interpreter) listen to this event.

#### Inputs
* `req.body` containing an array of transcript objects.

#### Outputs
* `{ success: true, processedCount: number }`

#### Side Effects
* Writes to Firestore.
* Triggers downstream intent detection.

#### State Mutations
* Inserts or updates `MinuteWindow` documents.

#### Dependencies
* Meeting Repository (to find active meeting).
* Command Interpreter (M3) (currently hard-coupled via AutomationService).

#### Failure Conditions
* No live meeting found.
* Database write failure.

#### Operational Considerations
* Webhooks can send large batches if connectivity is restored after a drop; requires efficient batch processing.

#### Scalability Considerations
* Use bulk write operations instead of sequential upserts in a loop.

#### Coupling Notes
* Tightly coupled to `AutomationService`. It synchronously awaits automation processing before returning a response, which can cause timeouts on the webhook caller.

#### Security Considerations
* Webhook endpoint needs authentication (e.g., secret token) to prevent unauthorized transcript injection.

### Resolve Speaker

#### Definition
Maps a raw, potentially generic speaker identifier from the transcription service to a specific participant name.

#### Current Implementation
Implemented ad-hoc inside `ingestController.ingestWebhook`, `ingestController.ingestChunk`, and redundantly inside `LLMService.calculateSpeakerStats`.

#### Ideal Implementation
A dedicated utility function or method inside the `Transcript Engine` module that takes the raw speaker ID and the Meeting context, returning the resolved string. This single source of truth is used whenever a segment is saved.

#### Inputs
* Raw speaker identifier (e.g., "0", "Unknown", "User 1").
* Meeting participants array.

#### Outputs
* Resolved speaker string (e.g., "Alice", "Host").

#### Side Effects
* None (pure computation based on context).

#### State Mutations
* None.

#### Coupling Notes
* The logic is currently duplicated across domains.

## Workflow Participation
* **W1 (Live Transcript Ingestion Pipeline)**: Entry point and primary driver of this workflow.

## Direct Dependencies
* X1 (Configuration & Environment)
* X2 (Observability)
* Database Driver (Firestore/Mongoose)
* M1 (Meeting Lifecycle) - Read-only dependency to validate meeting existence and get participants.

## Allowed Dependencies
* M1 (Read-only)

## Forbidden Dependencies
* M4 (Automation Orchestrator)
* M5 (Intelligence Core)
* M6 (Insight Generator)
* M7 (Visualization Pipeline)

## Encapsulation Boundaries
Owns all writes to the `MinuteWindow` collection. Provides read access via `getTranscript(meetingId)`.

## Public Interface Surface
* `POST /api/ingest/webhook`
* `POST /api/ingest/chunk`
* `POST /api/ingest/start-simulation`
* `GET /api/meetings/:id/transcript` (Logically belongs here, currently in meetingController)

## Internal Implementation Details
Currently relies heavily on Firestore for real-time capabilities on the frontend, using `minuteRepository.js`.

## Reusability Potential
High. The time-windowing pattern for continuous text streams is a common requirement for real-time transcription apps.

## Extractability Potential
High. Can function as an independent ingestion microservice that writes to a shared datastore or message queue.

## Scalability Considerations
Firestore handles the real-time syncing scale well, but if migrated entirely to MongoDB, would require WebSockets and careful connection management for live updates.

## Operational Responsibilities
Monitoring ingestion latency and handling malformed data from third-party transcription clients.

## Current Architectural Problems
* Synchronous coupling to intent detection and automation execution inside the webhook handler blocks the response and risks timeouts.
* Speaker resolution logic is duplicated.
* Simulation service logic is intertwined with production ingestion controllers.

## Technical Debt Impact
Medium. The synchronous webhook processing is a critical bottleneck that could cause data loss if the LLM or automation logic hangs.

## Future Expansion Opportunities
* Support for multiple simultaneous transcription providers.
* Real-time translation of ingested chunks.
* Speaker diarization using ML models to retroactively correct speaker tags.
* Audio stream ingestion (converting STT within the module).

## Ownership Violations in Current Implementation
* `ingestController` takes responsibility for evaluating intents and routing to automation.
* `meetingController` currently owns the `getTranscript` endpoint, which exposes `MinuteWindow` data formats directly.

## Recommended Refactoring Directions
1. Decouple ingestion from processing: Ingestion should write to the DB and emit an event (or publish to a queue). The Command Interpreter (M3) should subscribe to this event asynchronously.
2. Extract speaker resolution into a shared service within this module.
3. Move `getMeetingTranscript` from `meetingController` to an `ingestController` or dedicated `transcriptController`.


# 3. Command Interpreter

## Purpose
To parse streams of transcribed text, detect explicit user commands framed by specific trigger phrases (e.g., "Hey NeuroNotes ... Over"), normalize the text, and classify the underlying intent before passing it to the execution orchestrator.

## Core Responsibility
Act as the semantic parser for the live meeting audio. It listens to the transcript stream, identifies the boundaries of a command, cleans the input, and determines *what* the user wants to do, without executing the action itself.

## Owned Domain Concepts
* **Wake Word / Trigger Phrase**: The specific sequence of words that initiates or terminates command capture.
* **Command Buffer**: The temporary accumulation of transcript text that falls between a start and end trigger.
* **Intent**: A classified categorization of a user's goal (e.g., `schedule_meeting`, `create_visualization`).
* **Normalized Command**: The cleaned version of the raw transcript text, stripped of filler words and punctuation.

## Owned State
* **Active Command Buffers** (Transient/In-Memory)
  * Key: `meetingId`
  * Value: `{ text: string, speaker: string, startTime: Date }`

## Responsibilities

* **Frame Detection**
  * Definition: Identifying the start ("Hey NeuroNotes") and end ("Over") markers of a command within a continuous stream.
  * Owned behaviors: Pattern matching against regular expressions, managing the open/closed state of the buffer per meeting.
  * Ownership scope: The `buffers` map and the Regex patterns.
  * Workflow participation: W1 (Live Transcript Ingestion Pipeline).

* **Text Normalization**
  * Definition: Cleaning the captured raw text to make it suitable for intent classification and parameter extraction.
  * Owned behaviors: Lowercasing, removing punctuation, stripping defined filler words.
  * Ownership scope: The `fillerWords` list and the normalization logic.
  * Workflow participation: W1.

* **Intent Classification**
  * Definition: Determining the semantic goal of the normalized text.
  * Owned behaviors: Matching keywords against intent categories (e.g., `schedulingKeywords`, `visualizationKeywords`).
  * Ownership scope: The intent taxonomy (`schedule_meeting`, `create_visualization`, etc.) and the heuristic matching logic.
  * Workflow participation: W1.

## Requirements

* **State Isolation per Meeting**
  * Definition: The buffer state for one meeting must not leak into or block another.
  * Constraints: Buffers must be keyed by `meetingId`.
  * Invariants: Only one active buffer can exist per meeting at a time (nested commands are ignored or overwrite).
  * Validation expectations: Meeting ID must be present in every request.
  * Operational expectations: Buffers should have a TTL (time-to-live) to prevent memory leaks if an "Over" trigger is never received.

* **Speaker Preservation**
  * Definition: The module must track who initiated the command.
  * Constraints: The speaker of the segment containing the wake word becomes the owner of the entire command block.

## Functionalities

### Process Stream Chunk

#### Definition
Evaluates a single new segment of transcript text to update buffer state and detect completed commands.

#### Current Implementation
Implemented in `AutomationService.processChunk`. It uses hardcoded Regex `/hey[\s,.\-!]*neuro/i` and `/over/i`. If a complete block is found, it immediately calls `handleCommand`.

#### Ideal Implementation
Implemented as an independent `CommandParser.process(meetingId, segment)` method. It updates internal state and, upon detecting a complete frame, returns a `RawCommand` object or emits a `CommandDetectedEvent`.

#### Inputs
* `meetingId` (string)
* `chunkData` ({ text: string, speaker: string })

#### Outputs
* `null` (if incomplete) or `{ rawBlock, speaker, originalSnippet }`

#### Side Effects
* Mutates the internal in-memory `buffers` map.

#### State Mutations
* Adds to or deletes from the `buffers` map.

#### Dependencies
* None (pure logic).

#### Failure Conditions
* Missing meetingId.

#### Operational Considerations
* Extremely high frequency of calls; must be highly performant (Regex execution speed matters).

### Classify Intent

#### Definition
Analyzes a completed command block to determine its intent category.

#### Current Implementation
Implemented in `AutomationService.handleCommand` and `AutomationService.detectIntentType`. It performs basic text replacement (normalization) and checks `includes()` against arrays of keywords.

#### Ideal Implementation
Implemented as `IntentClassifier.classify(rawCommand)`. It applies standard NLP normalization techniques and returns a structured `Intent` object. Future implementations could call the Intelligence Core (M5) for semantic classification if heuristics fail.

#### Inputs
* `rawCommand` (string)

#### Outputs
* `IntentType` (string enum) or `null`.

#### Side Effects
* None.

#### State Mutations
* None.

#### Dependencies
* None.

#### Scalability Considerations
* Heuristic matching is fast. If moving to LLM-based classification, this step becomes asynchronous and requires rate limiting/caching.

#### Coupling Notes
* Currently tightly coupled to `AutomationService` execution logic. It immediately routes to `handleVisualizationIntent` or `handleSchedulingIntent`. This tight coupling prevents reuse of the parser for other features.

## Workflow Participation
* **W1 (Live Transcript Ingestion Pipeline)**: Acts as the middle layer, transforming raw text into actionable intents.

## Direct Dependencies
* X2 (Observability) - for logging detected commands.

## Allowed Dependencies
* M5 (Intelligence Core - Future) - For advanced intent classification.

## Forbidden Dependencies
* M4 (Automation Orchestrator) - Should not know how automation is executed.
* M1 (Meeting Lifecycle) - Should not interact with DB.
* M7 (Visualization Pipeline) - Should not know how to generate charts.

## Encapsulation Boundaries
Fully encapsulates the logic of *understanding* what the user said. Emits structured data out.

## Public Interface Surface
* `parseChunk(meetingId, segment) → IntentPayload | null`
* `resetBuffer(meetingId)`

## Internal Implementation Details
Relies heavily on Regex and string manipulation. Maintains state in a standard JavaScript `Map`.

## Reusability Potential
High. The concept of framing and classifying text streams is reusable across any voice-driven application.

## Extractability Potential
Very High. This module is mostly pure logic and could be extracted into an independent NPM package or standalone microservice with zero database dependencies.

## Scalability Considerations
Memory management is the primary concern. If 10,000 meetings are live, the `buffers` map will hold 10,000 strings. A cleanup mechanism for abandoned buffers (e.g., user said "Hey NeuroNotes" but never said "Over") is required.

## Operational Responsibilities
Monitoring false positive wake word detections. Tuning the `fillerWords` and keyword arrays based on real-world transcript inaccuracies.

## Current Architectural Problems
* Completely embedded inside `AutomationService`.
* Has no buffer timeout logic (memory leak potential).
* Hardcoded trigger phrases make internationalization or custom wake words impossible.

## Technical Debt Impact
Medium. The embedded nature makes it difficult to add new intents or test the parser independently from the execution orchestrator.

## Future Expansion Opportunities
* **LLM Intent Routing**: Using an LLM to classify intent instead of heuristic keywords for higher accuracy.
* **Parameter Extraction**: Extracting entities (dates, names, amounts) directly in the parser before passing to the orchestrator.
* **Custom Wake Words**: Allowing workspaces to define their own triggers instead of "Hey NeuroNotes".

## Ownership Violations in Current Implementation
* `AutomationService` currently owns this entire domain.

## Recommended Refactoring Directions
1. Create a `CommandInterpreter` class.
2. Move `processChunk`, `handleCommand`, and `detectIntentType` out of `AutomationService` into this new class.
3. Change the output of the interpreter to return a structured `{ intent: 'schedule_meeting', text: '...', speaker: '...' }` object.
4. Have the ingestion controller or an event bus pass this structured object to the `AutomationOrchestrator`.


# 4. Automation Orchestrator

## Purpose
To manage the lifecycle of user-initiated tasks and system automations, from detection and approval through to execution dispatch. It acts as the traffic controller for actions generated during a meeting.

## Core Responsibility
Maintain the state machine of pending, approved, rejected, and executed automations. It enforces idempotency (preventing duplicate actions), handles user modifications to action parameters, and dispatches approved tasks to the appropriate domain handlers.

## Owned Domain Concepts
* **Automation Log**: A record representing a requested action, its parameters, and its current lifecycle status.
* **Idempotency**: Ensuring the same command doesn't trigger duplicate actions.
* **Approval Workflow**: The process of requiring human intervention before executing a side-effect-heavy action.

## Owned State
* `AutomationLog` entity records (in MongoDB).
  * `meetingId` (Reference)
  * `intent` (String Enum: `schedule_meeting`, `email_summary`, `create_visualization`, etc.)
  * `triggerText` (String)
  * `parameters` (Mixed Object - LLM refined data)
  * `editedParameters` (Mixed Object - user modified data)
  * `status` (String Enum: `pending`, `approved`, `rejected`, `triggered`, `failed`, `completed`)
  * `confidenceScore` (Number)
  * `externalId` (String - e.g., n8n execution ID)

## Responsibilities

* **Intent Ingestion & Idempotency**
  * Definition: Receiving a classified intent and determining if it should create a new pending action.
  * Owned behaviors: Checking the DB for existing active logs of the same intent for the same meeting, preventing duplicates.
  * Ownership scope: `AutomationLog` creation.
  * Workflow participation: W1, W2.

* **Parameter Refinement**
  * Definition: Taking the raw text of an intent and transforming it into structured parameters required for execution.
  * Owned behaviors: Calling the Intelligence Core (M5) to extract dates, titles, and entities.
  * Ownership scope: The `parameters` and `confidenceScore` fields.
  * Workflow participation: W1.

* **Approval State Machine**
  * Definition: Managing user interactions with pending automations.
  * Owned behaviors: Transitioning status from `pending` to `approved` or `rejected`, storing `editedParameters` provided by the user.
  * Ownership scope: The `status` field and approval endpoints.
  * Workflow participation: W3.

* **Execution Dispatch**
  * Definition: Routing approved automations to the modules that actually perform the work.
  * Owned behaviors: Evaluating the `intent` and calling the corresponding module's interface (e.g., calling M10 for `email_summary`).
  * Ownership scope: The routing logic, not the execution logic.
  * Workflow participation: W3.

## Requirements

* **Auditability**
  * Definition: Every automation must have a traceable history.
  * Constraints: Logs cannot be deleted, only transitioned to terminal states (`rejected`, `completed`, `failed`).
  * Invariants: If `status` is `approved`, `approvedAt` must be set.
  * Validation expectations: Intent must exist in the recognized taxonomy.

* **Decoupled Execution**
  * Definition: The orchestrator must not perform the business logic of the action itself.
  * Constraints: It must call APIs or emit events to other modules (M1, M7, M10).

## Functionalities

### Ingest Intent

#### Definition
Receives a parsed intent, checks for duplicates, refines parameters via LLM, and creates a pending log.

#### Current Implementation
Handled in `AutomationService.handleSchedulingIntent` (and related methods). It queries `AutomationLog` for existing records. If none, calls `LLMService.refineCommand`, then saves the log.

#### Ideal Implementation
`Orchestrator.handleIntent(intentPayload)` is called. It uses a Strategy pattern based on the intent type. If the intent requires approval, it creates a pending log. If auto-execute (like visualizations), it dispatches immediately and logs as `completed`.

#### Inputs
* `meetingId`
* `intentType`
* `rawCommand` / `triggerText`

#### Outputs
* `AutomationLog` record (or null if duplicate).

#### Side Effects
* Writes to MongoDB.
* Calls external LLM API (via M5).

#### State Mutations
* Inserts new `AutomationLog`.

#### Dependencies
* M5 (Intelligence Core) for parameter refinement.

#### Operational Considerations
* LLM refinement adds latency. This should run asynchronously so it doesn't block the ingestion stream.

### Approve and Dispatch Automation

#### Definition
Receives user approval and modified parameters, marks the log as approved, and triggers the execution.

#### Current Implementation
`AutomationService.approveAutomation` handles the status update. Then, it blatantly violates boundaries by internally creating a meeting (for `schedule_meeting`) and generating HTML email bodies (for `email_summary`) before calling an n8n webhook.

#### Ideal Implementation
`approveAutomation(id, editedParams)` updates the database. Then, it delegates to an `ExecutionRouter`. 
* For `schedule_meeting`: Router calls `MeetingLifecycle.createMeeting(params)`.
* For `email_summary`: Router calls `CommunicationService.dispatchWebhook(payload)`.

#### Inputs
* `id` (AutomationLog ID)
* `editedParameters` (Object)

#### Outputs
* Updated `AutomationLog`.

#### Side Effects
* Triggers side effects in other modules.
* Updates MongoDB.

#### State Mutations
* `status` → 'approved' → 'completed'/'failed'.
* `editedParameters` is populated.

#### Dependencies
* M1 (Meeting Lifecycle).
* M10 (Communication & Notification).

#### Failure Conditions
* Downstream execution fails (e.g., webhook timeout). Should transition status to `failed` and record the error.

#### Coupling Notes
* Currently suffering from extreme coupling (violating Single Responsibility Principle). The orchestrator knows *how* to do everything, instead of just *orchestrating*.

## Workflow Participation
* **W1 (Live Transcript Ingestion)**: Consumes intents to create pending tasks.
* **W2 (Meeting End)**: Consumes the end event to create the post-meeting email task.
* **W3 (Automation Approval Pipeline)**: Owns this workflow entirely.

## Direct Dependencies
* X1 (Configuration)
* X2 (Observability)
* Database Driver
* M5 (Intelligence Core)

## Allowed Dependencies
* M1 (Meeting Lifecycle) - for dispatch only.
* M7 (Visualization Pipeline) - for dispatch only.
* M10 (Communication) - for dispatch only.

## Forbidden Dependencies
* M2 (Transcript Engine) - Should only receive events from it, not query it.
* M3 (Command Interpreter) - The interpreter calls the orchestrator, not vice versa.

## Encapsulation Boundaries
Owns the `AutomationLog` collection. Other modules must not modify these records directly.

## Public Interface Surface
* `GET /api/automation/pending`
* `POST /api/automation/:id/approve`
* `POST /api/automation/:id/reject`
* (Internal) `handleIntent(payload)`

## Internal Implementation Details
Uses Mongoose to manage state. Currently structured as a single massive `AutomationService` class.

## Reusability Potential
Medium. The pattern is reusable, but the specific intent routing is highly coupled to NeuroNotes' feature set.

## Extractability Potential
High. Could be a standalone workflow engine microservice (like a lightweight Temporal or Cadence).

## Scalability Considerations
Database indexing on `status` and `meetingId` is critical for quickly retrieving pending tasks for the UI.

## Operational Responsibilities
Tracking failure rates of dispatched actions (e.g., n8n webhooks failing frequently).

## Current Architectural Problems
* The "God Service" anti-pattern: `AutomationService` does intent detection, parameter refinement, HTML generation, internal meeting creation, and webhook dispatching.

## Technical Debt Impact
Very High. Adding a new intent requires modifying massive, brittle switch/if statements and injecting new domain logic into the orchestrator.

## Future Expansion Opportunities
* Configurable auto-approval rules based on confidence scores.
* Retry mechanisms for failed webhook dispatches.
* Complex multi-step workflows (e.g., approval → create ticket → send slack message).
* Integration with proper workflow engines (Temporal/AWS Step Functions).

## Ownership Violations in Current Implementation
* Owns meeting creation logic (Violation V1).
* Owns email HTML composition logic (Violation V2).

## Recommended Refactoring Directions
1. Remove all domain-specific execution logic (Meeting creation, HTML generation) and move it to M1 and M10.
2. Implement an `IntentHandlerRegistry` or Publisher/Subscriber model where domain modules register to handle specific intent types.
3. Keep the orchestrator strictly focused on state tracking (`pending` → `approved`) and passing the baton.


# 5. Intelligence Core (LLM Gateway)

## Purpose
To act as the centralized, reliable, and configurable gateway for all Large Language Model (LLM) communications. It abstracts the complexities of external AI APIs away from the domain modules.

## Core Responsibility
Manage external LLM API requests, handle retries and rate limits, format standardized responses (especially JSON validation), provide deterministic demo fallbacks, and decouple specific model implementations (e.g., Groq vs. OpenAI) from the rest of the system.

## Owned Domain Concepts
* **LLM Gateway**: The interface boundary between internal application logic and external AI providers.
* **Prompt Execution**: The process of sending text to an AI and receiving a response.
* **Demo Mode / Fallback**: The deterministic response system used when external APIs are unavailable or disabled for demonstrations.

## Owned State
* **API Configuration** (In-memory, loaded from X1)
  * `baseUrl`, `modelName`, `apiKey`, `demoMode` flags.
* **Rate Limit State** (Future)

## Responsibilities

* **API Communication**
  * Definition: Executing HTTP requests to the LLM provider.
  * Owned behaviors: Setting headers, handling fetch logic, checking HTTP status codes, parsing the basic response payload.
  * Ownership scope: Network interactions with `api.groq.com` (or similar).
  * Workflow participation: W2, W4, W5, W6, W7.

* **JSON Mode Enforcement**
  * Definition: Ensuring the LLM returns strictly valid JSON when requested.
  * Owned behaviors: Appending system instructions for JSON, stripping markdown code blocks (e.g., ` ```json `) from the response before returning.
  * Ownership scope: Raw response cleanup.
  * Workflow participation: W2, W6, W7.

* **Demo Fallback Interception**
  * Definition: Providing hardcoded, fast responses when the system is in `DEMO_MODE` or if API keys are missing.
  * Owned behaviors: Checking the config flag and returning predefined strings or objects instead of making network calls.
  * Ownership scope: The `DEMO_MODE` routing logic.
  * Workflow participation: All LLM-dependent workflows during demo conditions.

## Requirements

* **Domain Agnosticism**
  * Definition: The core must not know *why* it is making a call.
  * Constraints: It must not contain prompts specific to "meetings" or "visualizations". It takes a prompt string and returns a result string.
  * Invariants: Business logic belongs to the caller.

* **Resilience**
  * Definition: The system must not crash if the LLM API fails.
  * Constraints: Must handle 4xx/5xx errors gracefully, returning null or empty strings so upstream logic can fallback safely.
  * Validation expectations: Try/catch blocks around all network calls.

## Functionalities

### Execute Completion (`_callGrok` / `complete`)

#### Definition
The primary function that takes a prompt and optional configuration, sends it to the configured LLM, and returns the response.

#### Current Implementation
Implemented as `LLMService._callGrok(prompt, isJsonMode)`. It builds the request body, makes a `fetch` call, and extracts the content from the response object. It suppresses errors and returns an empty string on failure.

#### Ideal Implementation
Exposed as `IntelligenceCore.complete(prompt, options)`. Options include temperature, max_tokens, and response_format. The implementation handles retries with exponential backoff and tracks latency/usage metrics via the Observability module (X2).

#### Inputs
* `prompt` (string)
* `isJsonMode` (boolean) or `options` (object)

#### Outputs
* `responseString` (string)

#### Side Effects
* Network request.
* Logs latency/errors.

#### State Mutations
* None.

#### Dependencies
* X1 (Configuration).

#### Failure Conditions
* Network timeout.
* API Key invalid.
* Rate limit exceeded (HTTP 429).

#### Operational Considerations
* Latency is the biggest factor; this module represents the slowest operations in the application.

#### Scalability Considerations
* As traffic grows, connection pooling and request batching (if supported by provider) may be necessary.

#### Coupling Notes
* Currently well encapsulated at the network layer, but heavily coupled conceptually because the surrounding `LLMService` class contains massive amounts of domain logic.

#### Security Considerations
* API Keys must be protected and never leaked in logs. PII (Personally Identifiable Information) in transcripts should ideally be scrubbed before hitting this gateway (future requirement).

### Parse and Clean JSON

#### Definition
Utility logic applied to responses that are expected to be JSON.

#### Current Implementation
Scattered inside `generateSummary`, `refineCommand`, and `generateMeetingAnalytics`. Uses `.replace(/```json/g, '').replace(/```/g, '').trim()`.

#### Ideal Implementation
Centralized inside the `IntelligenceCore`. A method `completeJSON(prompt, schema)` that automatically handles the markdown stripping and attempts `JSON.parse()`. If parsing fails, it could theoretically prompt the LLM to fix it.

#### Inputs
* Raw LLM response string.

#### Outputs
* Parsed JavaScript Object, or throws an error.

## Workflow Participation
* Participates in almost every complex workflow (W2, W4, W5, W6, W7), acting as the central processing engine.

## Direct Dependencies
* X1 (Configuration).
* X2 (Observability).

## Allowed Dependencies
* None. This is a foundational utility module.

## Forbidden Dependencies
* M1, M2, M3, M4, M6, M7, M8, M9, M10, M11. The core must not depend on any domain modules.

## Encapsulation Boundaries
Strictly encapsulates external API communication. If the application switches from Groq to OpenAI, ONLY this module should change.

## Public Interface Surface
* `complete(prompt, options)`
* `completeJSON(prompt, options)`
* `isAvailable()` (checks config/keys)

## Internal Implementation Details
Currently uses `fetch` against the `api.groq.com` endpoint using OpenAI-compatible payload structures.

## Reusability Potential
Extremely High. This module is completely domain-agnostic and could be dropped into any Node.js application requiring an LLM gateway.

## Extractability Potential
Extremely High. Perfect candidate for an independent microservice or internal library package.

## Scalability Considerations
Rate limiting is typically enforced by the external provider. This module needs to gracefully handle 429 errors and implement backoff strategies.

## Operational Responsibilities
Monitoring LLM API latency, success rates, and token usage (cost tracking).

## Current Architectural Problems
* **The "God Service"**: `LLMService.js` contains the gateway logic (`_callGrok`) alongside highly specific domain logic (`processWindow`, `query`, `generateSummary`, `refineCommand`, `generateMeetingAnalytics`, `calculateSpeakerStats`).

## Technical Debt Impact
High. Changing the prompt for a meeting summary requires opening the file that handles network requests. The file is massive and violates the Single Responsibility Principle.

## Future Expansion Opportunities
* **Model Routing**: Routing simple requests to smaller, faster models (e.g., Llama-8B) and complex reasoning to larger models (e.g., Llama-70B) based on cost/performance profiles.
* **Caching**: Implementing a semantic cache (e.g., Redis) for identical queries to save API costs.
* **PII Scrubbing**: Automatically identifying and obfuscating sensitive data before sending it to third-party APIs.

## Ownership Violations in Current Implementation
* `LLMService` owns prompt design (Violation V4). Prompts should be owned by the module requesting the intelligence (e.g., M6 owns the summary prompt).
* `LLMService` owns pure computation logic (`calculateSpeakerStats`), which has nothing to do with LLMs.

## Recommended Refactoring Directions
1. Rename `_callGrok` and related config to a standalone `IntelligenceCore` or `LLMAdapter` class.
2. Evict ALL domain methods (`generateSummary`, `query`, etc.) from this class. Move them to M6, M4, M7, and M8.
3. Centralize the JSON cleaning logic into a single reusable method within this module.


# 6. Insight Generator

## Purpose
To distill raw, unstructured meeting transcripts into structured, actionable intelligence. It provides the "brain" for post-meeting analysis, generating summaries, extracting action items, tracking decisions, and computing meeting analytics.

## Core Responsibility
Own the domain logic and prompt engineering required to instruct the Intelligence Core (M5) on *how* to analyze a transcript. It also owns pure computational analytics (like speaker word counts) that do not require an LLM.

## Owned Domain Concepts
* **Meeting Summary**: A high-level overview of the discussion.
* **Action Item**: A discrete task assigned to a participant with a status.
* **Decision**: A finalized agreement made during the meeting.
* **Meeting Analytics**: Computed metrics describing the meeting's dynamics (e.g., speaker share, engagement, sentiment).

## Owned State
* `ActionItem` entity records.
  * `meetingId`, `content`, `assignee`, `status`, `sourceWindowId`
* `Decision` entity records.
  * `meetingId`, `content`, `confidence`, `sourceWindowId`
* Computed Analytics (Stored as a nested object on the `Meeting` entity or returned ephemerally).

## Responsibilities

* **Summary Generation**
  * Definition: Condensing the full meeting transcript into key points, risks, and opportunities.
  * Owned behaviors: Assembling the LLM prompt, defining the JSON schema for the output, triggering the LLM call.
  * Ownership scope: The prompt and parsing logic.
  * Workflow participation: W2 (Meeting End).

* **Artifact Extraction (Actions/Decisions)**
  * Definition: Identifying and persisting discrete commitments and agreements.
  * Owned behaviors: Parsing the LLM output for actions/decisions, associating them with the meeting, saving them to the database.
  * Ownership scope: `ActionItem` and `Decision` collections.
  * Workflow participation: W2, W6 (Live Processing).

* **Analytics Computation**
  * Definition: Calculating objective metrics about the meeting.
  * Owned behaviors: Counting words per speaker, mapping generic speaker IDs to names using meeting context, grouping activity by minute to create a timeline.
  * Ownership scope: Pure computational functions (`calculateSpeakerStats`, `calculateEngagementTimeline`).
  * Workflow participation: W7 (Insights Request).

* **Sentiment and Topic Analysis**
  * Definition: Evaluating the emotional tone and categorizing the subjects discussed.
  * Owned behaviors: Orchestrating an LLM call specific to sentiment and topic extraction, merging the results with computed analytics.
  * Ownership scope: The prompt and parsing logic.
  * Workflow participation: W7.

## Requirements

* **Context Awareness**
  * Definition: The generator must understand who the participants are to accurately assign actions and calculate stats.
  * Constraints: It must receive the `Meeting` object (or participants list) alongside the transcript.
  * Validation expectations: If speaker resolution fails, it must fall back to "Unknown" gracefully.

* **Schema Rigidity**
  * Definition: Outputs must be highly structured to be usable by the UI.
  * Constraints: Prompts must explicitly instruct the LLM to output valid JSON matching the exact expected format.
  * Operational expectations: Must handle LLM formatting errors (e.g., markdown wrapping).

## Functionalities

### Generate Comprehensive Summary

#### Definition
Analyzes the entire meeting transcript upon completion to generate the final summary view.

#### Current Implementation
Embedded in `LLMService.generateSummary`. It contains a massive hardcoded prompt string and a fallback `mockSummary`. It is called by `meetingController.endMeeting` and `generateMeetingSummary`.

#### Ideal Implementation
Implemented as `InsightGenerator.generateSummary(transcript)`. It retrieves the prompt template, calls `IntelligenceCore.completeJSON()`, and returns the validated object.

#### Inputs
* `transcript` (string)

#### Outputs
* `SummaryObject` (keyPoints, decisions, actionItems, opportunities, risks, eligibility, questions).

#### Side Effects
* Calls external API via M5.

#### Dependencies
* M5 (Intelligence Core).

#### Operational Considerations
* Full transcript analysis consumes a significant number of tokens. Prompt design must be optimized for context window limits.

### Compute Meeting Analytics

#### Definition
Combines pure computation (speaker stats) with LLM analysis (sentiment, topics) to produce the Insights dashboard data.

#### Current Implementation
Scattered across `LLMService.generateMeetingAnalytics`, `LLMService.calculateSpeakerStats`, and `LLMService.calculateEngagementTimeline`. Includes heavy mock data fallback logic.

#### Ideal Implementation
`InsightGenerator.generateAnalytics(transcript, segments, meetingContext)`. It runs the computational methods synchronously, then awaits the LLM sentiment/topic call via M5, merges the results, and returns the aggregate object.

#### Inputs
* `transcript` (string)
* `segments` (array of objects)
* `meetingContext` (Meeting object)

#### Outputs
* `AnalyticsObject` (speakerStats, topicBreakdown, engagementTimeline, sentimentScore, etc.)

#### Side Effects
* Calls external API via M5.

#### Dependencies
* M5 (Intelligence Core).

#### Coupling Notes
* Currently, `LLMService` owns speaker resolution fallback logic inside `calculateSpeakerStats`. This logic belongs in M2 (Transcript Engine), and M6 should just trust the provided speaker tags.

## Workflow Participation
* **W2 (Meeting End)**: Primary actor. Generates the content that is saved to the meeting and emailed.
* **W7 (Meeting Analytics/Insights)**: Primary actor. Generates the data for the Insights dashboard.

## Direct Dependencies
* M5 (Intelligence Core)
* Database Driver (for Action/Decision repositories)

## Allowed Dependencies
* None. (It consumes data passed to it from controllers).

## Forbidden Dependencies
* M1 (Meeting Lifecycle) - It should not update the meeting directly; it returns data for the orchestrator/controller to update.
* M10 (Communication) - It should not know about emails.

## Encapsulation Boundaries
Owns all prompt engineering related to meeting analysis. Owns the `ActionItem` and `Decision` collections.

## Public Interface Surface
* `generateSummary(transcript) → Object`
* `generateAnalytics(transcript, segments, context) → Object`
* `processLiveWindow(transcriptChunk) → { actions, decisions }` (For real-time extraction)

## Internal Implementation Details
Currently lives inside `services/LLMService.js` and `controllers/insightsController.js`. Uses Mongoose for artifact storage.

## Reusability Potential
Medium. The prompts are highly tuned to NeuroNotes' specific feature set (e.g., "eligibility" and "risks" fields). The pure computation functions are highly reusable.

## Extractability Potential
High. Could easily be extracted as a standalone microservice that accepts text and returns structured analysis.

## Scalability Considerations
Token limits. If a meeting is 4 hours long, the transcript may exceed the context window of the LLM. The Insight Generator may need to implement map-reduce summarization (summarizing chunks, then summarizing the summaries).

## Operational Responsibilities
Monitoring the quality of the LLM outputs. If the LLM frequently hallucinates action items, the prompts in this module must be refined.

## Current Architectural Problems
* Domain logic is trapped inside the API gateway (`LLMService`).
* Pure computational logic (counting words) is mixed with LLM network calls.
* Massive mock data objects are hardcoded in the service layer.

## Technical Debt Impact
High. It is difficult to test the analytics computation logic because it lives inside the class that makes external API calls.

## Future Expansion Opportunities
* **Map-Reduce Summarization**: For handling very long meetings.
* **Custom Prompts**: Allowing users to define custom extraction rules (e.g., "Extract all mentions of budget numbers").
* **Topic Tracking**: Identifying recurring topics across multiple meetings in a workspace.

## Ownership Violations in Current Implementation
* `LLMService` owns the logic that belongs here (Violation V4).

## Recommended Refactoring Directions
1. Create a new `InsightGenerator` class.
2. Move all prompt templates from `LLMService` into this class or a separate template file.
3. Move `calculateSpeakerStats` and `calculateEngagementTimeline` into this class.
4. Refactor `insightsController` and `meetingController` to call `InsightGenerator` instead of `LLMService`.


# 7. Visualization Pipeline

## Purpose
To transform conversational data points discussed during a meeting into structured, renderable visual artifacts (charts, graphs, timelines). It bridges the gap between unstructured speech and structured data visualization.

## Core Responsibility
Analyze text for quantitative data, construct LLM prompts to extract that data into a specific chart schema, validate the resulting JSON against strict chart configuration rules, and persist the artifacts for UI rendering.

## Owned Domain Concepts
* **Visual Artifact**: A saved, renderable chart configuration tied to a specific point in a meeting.
* **Chart Configuration**: The structured JSON (labels, values, type) required by the frontend rendering library (e.g., Chart.js or Recharts).
* **Data Extraction**: The process of identifying numbers, categories, and relationships in natural language.

## Owned State
* `VisualArtifact` (and legacy `Visual`) entity records (in MongoDB).
  * `meetingId` (Reference)
  * `type` (Enum: 'line', 'bar', 'timeline', 'pie')
  * `title` (String)
  * `description` (String)
  * `data` (Mixed JSON: { labels: [], values: [] })
  * `sourceWindowId` (Reference to the transcript chunk)
* **Active Capture Sessions** (Transient)
  * State tracking when a user says "Start chart" and is currently speaking data points before saying "End chart".

## Responsibilities

* **Data Identification & Extraction**
  * Definition: Finding the numbers and categories within a block of text.
  * Owned behaviors: Orchestrating the LLM to pull out `labels` and `values` and map them to a `type`.
  * Ownership scope: The extraction prompt and schema definition.
  * Workflow participation: W6 (Visualization Generation).

* **Configuration Validation**
  * Definition: Ensuring the LLM output is structurally sound and renderable.
  * Owned behaviors: Checking that labels and values arrays match in length, verifying all values are numbers, setting default types if missing.
  * Ownership scope: The `VisualEngine.validateCandidate` logic.
  * Workflow participation: W6.

* **Artifact Persistence**
  * Definition: Saving the validated chart configuration to the database.
  * Owned behaviors: Writing to the `visualRepository`.
  * Ownership scope: The `VisualArtifact` collection.
  * Workflow participation: W6.

## Requirements

* **Strict Validation**
  * Definition: The frontend will crash if provided malformed chart data.
  * Constraints: The pipeline MUST NOT save an artifact if `labels.length !== values.length`, or if values contain non-numeric strings.
  * Invariants: Every artifact must have a valid `type`.
  * Validation expectations: Schema validation run on every LLM output.

* **Deterministic Formatting**
  * Definition: The LLM must output precise JSON.
  * Constraints: Prompts must enforce strict JSON structure without markdown formatting.

## Functionalities

### Generate Visualization from Content

#### Definition
Takes an array of text lines representing the data points, asks the LLM to format it into a chart, validates the output, and saves it.

#### Current Implementation
Implemented in `VisualizationTriggerService.generateVisualization`. It constructs a prompt, calls `LLMService._callGrok`, attempts to parse the JSON, passes it to `VisualEngine.generateChart` for validation, and finally calls `createVisual` in the repository.

#### Ideal Implementation
Implemented as `VisualizationPipeline.generate(meetingId, contentLines, sourceId)`. It uses `IntelligenceCore.completeJSON` to get the raw object, validates it using an internal schema validator, and persists it.

#### Inputs
* `meetingId` (string)
* `contentLines` (array of strings)
* `sourceWindowId` (string, optional)

#### Outputs
* `VisualArtifact` object or `null` if generation/validation fails.

#### Side Effects
* Calls external API via M5.
* Writes to MongoDB.

#### State Mutations
* Inserts new `VisualArtifact`.

#### Dependencies
* M5 (Intelligence Core).

#### Failure Conditions
* LLM returns non-JSON.
* LLM returns hallucinated data that fails validation (e.g., text in the values array).
* Database write failure.

#### Operational Considerations
* LLMs are prone to formatting errors when generating complex nested JSON. Validation is the most critical step.

### Validate Chart Candidate (`VisualEngine`)

#### Definition
A pure function that checks if a proposed chart configuration is safe to render.

#### Current Implementation
`VisualEngine.validateCandidate` checks for required fields, array length matching, and uses `.every()` to ensure all values are numbers.

#### Ideal Implementation
Remains a pure function within this module. Could be upgraded to use a formal schema validation library (like Zod or Joi) for more robust error reporting.

#### Inputs
* `candidate` (object from LLM)

#### Outputs
* `boolean`

#### Coupling Notes
* Cleanly implemented as a pure function.

## Workflow Participation
* **W6 (Visualization Generation)**: Owns the core logic of this workflow.
* **W1 (Live Transcript Ingestion)**: Invoked by the Automation Orchestrator when a `create_visualization` intent is detected.

## Direct Dependencies
* M5 (Intelligence Core)
* Database Driver

## Allowed Dependencies
* None.

## Forbidden Dependencies
* M3 (Command Interpreter) - The pipeline should not parse raw transcripts for wake words; it should only receive the isolated content block.
* M4 (Automation Orchestrator) - The pipeline returns data; it does not dictate orchestration.

## Encapsulation Boundaries
Owns the `VisualArtifact` collection and the logic for converting text to chart configurations.

## Public Interface Surface
* `generateFromContent(meetingId, contentLines, sourceId) → VisualArtifact | null`
* `getVisualsForMeeting(meetingId) → VisualArtifact[]`
* `validateConfiguration(config) → boolean`

## Internal Implementation Details
Currently split across `VisualizationTriggerService.js` and `VisualEngine.js`.

## Reusability Potential
High. The `VisualEngine` and extraction prompts could be used in any application that needs to turn text into charts.

## Extractability Potential
High. Could function as an independent text-to-chart microservice.

## Scalability Considerations
Generation depends on LLM latency. Fast generation is critical for the "wow factor" during a live meeting demo.

## Operational Responsibilities
Monitoring validation failure rates. If validation frequently fails, the LLM prompt needs adjustment.

## Current Architectural Problems
* **Dual Entry Points**: Visualization generation can currently be triggered by the old `VisualizationTriggerService` parsing line-by-line for "start chart / end chart", AND by the new `AutomationService` intent detection. This creates race conditions and dual ownership of the trigger logic.

## Technical Debt Impact
Medium. The duplicate trigger paths cause confusion and potential double-generation of charts.

## Future Expansion Opportunities
* **Interactive Editing**: Allowing users to say "Change that to a pie chart" to mutate an existing artifact.
* **Multi-series Data**: Supporting grouped bar charts or multi-line graphs (requires more complex LLM prompts and validation).
* **Dashboard Export**: Bundling multiple visual artifacts into a shareable report.

## Ownership Violations in Current Implementation
* `VisualizationTriggerService` still contains trigger detection logic (`SIMPLE_START_TRIGGERS`). Trigger detection belongs entirely to M3 (Command Interpreter).

## Recommended Refactoring Directions
1. Remove all string-matching trigger logic (Regex, `WAKE_WORDS`, `sessions` map) from `VisualizationTriggerService`.
2. Rename `VisualizationTriggerService` to `VisualizationPipeline`.
3. Expose only the `generateVisualization` method, which accepts the already-isolated text block from M4.
4. Merge `VisualEngine` logic directly into the pipeline as a private validation step.


# 8. Conversational Interface

## Purpose
To provide a text-based, natural language query interface for users to interact with the intelligence gathered during a meeting. It allows users to ask questions, request ad-hoc summaries, and query decisions dynamically.

## Core Responsibility
Accept user queries from the frontend chat UI, assemble the necessary meeting context (transcripts, existing insights) to ground the AI, handle specific slash commands (`/summary`), format the LLM response, and provide metadata for UI provenance (e.g., highlighting source text).

## Owned Domain Concepts
* **Chat Query**: A text input from the user asking a question about the meeting.
* **Context Assembly**: The process of gathering recent or relevant transcript segments to send to the LLM alongside the query.
* **Grounded Response**: An LLM answer that is strictly based on the provided meeting context, avoiding external hallucinations.
* **Command Triggers**: Shortcuts like `/actions` that map to predefined, optimized prompts.

## Owned State
* **Chat History** (Currently ephemeral on the frontend, but logically owned by this domain if persisted).

## Responsibilities

* **Query Handling & Command Mapping**
  * Definition: Receiving the user input and determining if it's a natural question or a predefined command.
  * Owned behaviors: Detecting `/summary`, `/actions`, `/decisions`, `/insights` prefixes and expanding them into robust LLM prompts.
  * Ownership scope: The prompt templates for chat interactions.
  * Workflow participation: W4 (AI Chat Interaction).

* **Context Construction**
  * Definition: Building the "Ground Truth" text block that the LLM will base its answer on.
  * Owned behaviors: Fetching recent `MinuteWindow` records, flattening them into a readable transcript string, and appending them to the system prompt.
  * Ownership scope: Context window sizing and formatting logic.
  * Workflow participation: W4.

* **Metadata/Provenance Generation**
  * Definition: Providing verifiable data back to the UI to explain *why* the AI answered the way it did.
  * Owned behaviors: Extracting the list of unique speakers involved in the context window, calculating the timeframe analyzed, and generating a confidence score.
  * Ownership scope: The `metadata` object returned alongside the response text.
  * Workflow participation: W4.

## Requirements

* **Strict Grounding**
  * Definition: The AI must not invent facts or pull from outside knowledge.
  * Constraints: The system prompt must explicitly forbid answering questions outside the scope of the provided context.
  * Operational expectations: If the context is empty, the system must politely refuse to answer.

* **Context Window Management**
  * Definition: The system must fit the transcript into the LLM's token limits.
  * Constraints: Cannot blindly append the entire 4-hour meeting transcript to every chat query. Must implement windowing (e.g., "last 20 minutes") or semantic retrieval (future).

## Functionalities

### Handle Chat Query

#### Definition
The primary endpoint for the text-based AI assistant. It takes a meeting ID and a user string, and returns an AI-generated answer.

#### Current Implementation
`chatController.handleQuery` fetches all minutes for the meeting, concatenates them into a single context string, checks for slash commands (mutating the query if found), and calls `LLMService.query`. `LLMService.query` contains hardcoded `DEMO_MODE` fallback responses for specific slash commands.

#### Ideal Implementation
`ChatService.handle(meetingId, query)` fetches a *bounded* context (e.g., last N minutes). It expands slash commands using an internal map. It constructs the full prompt and calls `IntelligenceCore.complete()`. It then computes the provenance metadata based on the chunks used and returns the payload.

#### Inputs
* `meetingId` (string)
* `query` (string)

#### Outputs
* `response` (string - markdown formatted)
* `metadata` ({ window: string, speakers: string[], confidence: number })

#### Side Effects
* Calls external API via M5.

#### State Mutations
* None (currently stateless on backend).

#### Dependencies
* M2 (Transcript Engine) - to fetch recent context.
* M5 (Intelligence Core) - to generate the response.

#### Failure Conditions
* LLM API failure.
* Transcript not found.

#### Operational Considerations
* Must respond quickly (under 2 seconds ideally) for a good chat UX.

#### Coupling Notes
* Currently, the specific demo responses for slash commands are tightly coupled inside the generic `LLMService`. This logic belongs entirely in the Conversational Interface module.

## Workflow Participation
* **W4 (AI Chat Interaction)**: Owns this workflow from end to end.

## Direct Dependencies
* M2 (Transcript Engine)
* M5 (Intelligence Core)

## Allowed Dependencies
* None.

## Forbidden Dependencies
* M4 (Automation Orchestrator) - Chat queries do not trigger automations in this design.
* M10 (Communication) - Chat does not send emails.

## Encapsulation Boundaries
Owns the prompt templates specifically designed for interactive Q&A and the logic for windowing context.

## Public Interface Surface
* `POST /api/chat/query`

## Internal Implementation Details
Currently mostly lives in `chatController.js` and `LLMService.js`.

## Reusability Potential
Medium. The pattern of Context + Prompt → LLM is standard, but the specific slash command expansions are unique to the meeting domain.

## Extractability Potential
High. Could easily be extracted if the Transcript Engine provides a clean API for fetching bounded context.

## Scalability Considerations
As meetings get longer, passing the full transcript fails. The primary scaling concern is implementing a retrieval strategy (e.g., vector search) to find the *relevant* parts of the transcript to send to the LLM, rather than just the *recent* parts.

## Operational Responsibilities
Monitoring chat latency and token usage, as users can spam the chat interface and rapidly consume LLM credits.

## Current Architectural Problems
* **Unbounded Context**: Currently fetches `getMinutesByMeeting` and joins *all* of them for every query, which will crash or truncate on long meetings.
* **Logic Leakage**: The fallback responses for `/summary`, `/actions`, etc., are hardcoded inside the generic `LLMService` API wrapper.

## Technical Debt Impact
Medium. The unbounded context will become a critical bug as meeting durations increase.

## Future Expansion Opportunities
* **Retrieval-Augmented Generation (RAG)**: Using a vector database (like Pinecone or MongoDB Vector Search) to embed transcript chunks and only retrieve semantically relevant chunks for the chat context.
* **Persistent Chat History**: Storing the user's questions and the AI's answers so they persist across page reloads.
* **Multi-turn Memory**: Passing previous Q&A pairs into the LLM context so the user can ask follow-up questions ("Can you explain that last point more?").

## Ownership Violations in Current Implementation
* `LLMService.query` owns the fallback content and routing logic for slash commands (Violation V8).

## Recommended Refactoring Directions
1. Move the `DEMO_MODE` fallback logic out of `LLMService` and into `chatController` or a new `ChatService`.
2. Implement a hard limit on the context window fetched from the database (e.g., `minutes.slice(-15)`).
3. Ensure `LLMService` exposes only a generic `complete(prompt)` method that the Chat module calls.


# 9. Voice Interaction

## Purpose
To enable spoken interaction with the meeting's intelligence. It allows users to ask questions verbally and receive synthesized audio responses that are grounded in the meeting's context.

## Core Responsibility
Orchestrate the flow from a spoken query (already converted to text by the client) to an LLM-generated, speech-optimized response, and finally to a synthesized audio buffer using a third-party Text-to-Speech (TTS) provider.

## Owned Domain Concepts
* **Speech-Optimized Prompt**: Instructions for the LLM to generate concise, conversational text without complex markdown that would sound unnatural when read aloud.
* **Audio Synthesis**: The conversion of text into playable audio data (e.g., MP3/WAV buffers).
* **Voice Configuration**: Settings related to the TTS provider, such as voice IDs, stability, and similarity boost.

## Owned State
* **TTS Provider Configuration** (In-memory, loaded from X1)
  * `ELEVENLABS_API_KEY`
  * `ELEVENLABS_VOICE_ID`
* **Audio Buffers** (Transient/Ephemeral)

## Responsibilities

* **Context Assembly for Voice**
  * Definition: Gathering the necessary meeting context to ground the AI's response.
  * Owned behaviors: Fetching transcript segments, handling missing context scenarios.
  * Ownership scope: Context window logic for voice queries.
  * Workflow participation: W5 (Voice Interaction).

* **Grounded Response Generation (Speech Optimized)**
  * Definition: Generating the text response that will be read aloud.
  * Owned behaviors: Designing the prompt to ensure the output is conversational, concise (2-3 sentences), and free of markdown formatting (like asterisks or hash symbols).
  * Ownership scope: The voice-specific prompt template.
  * Workflow participation: W5.

* **Text-to-Speech Synthesis**
  * Definition: Converting the generated text into an audio file.
  * Owned behaviors: Calling the ElevenLabs API, handling API errors or quota limits, providing a mock/fallback audio buffer if the API fails, encoding the resulting buffer to base64 for JSON transport.
  * Ownership scope: TTS API adapter logic.
  * Workflow participation: W5.

## Requirements

* **Speech Suitability**
  * Definition: The LLM output must be readable by a TTS engine without bizarre artifacts.
  * Constraints: Prompt must explicitly forbid markdown lists, bolding (`**`), and code blocks.
  * Operational expectations: Responses should be short to reduce TTS generation latency and token cost.

* **Graceful Degradation**
  * Definition: If the TTS provider is down or out of credits, the system must not crash the client application.
  * Constraints: The service must catch TTS errors and ideally return the text response along with a fallback audio buffer (or error flag) so the UI can still display the text.
  * Validation expectations: Provide mock audio buffers in demo mode or upon API failure.

## Functionalities

### Handle Voice Interaction

#### Definition
The end-to-end endpoint that receives a text query, generates a text response, synthesizes audio, and returns both to the client.

#### Current Implementation
`voiceController.handleVoiceInteraction` fetches the transcript, calls `LLMService.generateVoiceResponse` to get the text, calls `VoiceService.generateAudio` to get the buffer, converts it to base64, and returns `{ text, audio }`.

#### Ideal Implementation
`VoiceInteractionService.interact(meetingId, query)` fetches bounded context from M2. It uses `IntelligenceCore.complete` with its own strictly defined conversational prompt. It then passes the result to a `TTSAdapter.synthesize(text)`.

#### Inputs
* `meetingId` (string)
* `query` (string)

#### Outputs
* `{ text: string, audio: string (base64) }`

#### Side Effects
* Calls external LLM API (via M5).
* Calls external TTS API (via direct fetch to ElevenLabs).

#### State Mutations
* None.

#### Dependencies
* M2 (Transcript Engine) - for context.
* M5 (Intelligence Core) - for text generation.

#### Failure Conditions
* ElevenLabs API quota exceeded.
* ElevenLabs API key missing.
* LLM failure.

#### Operational Considerations
* **Latency stacking**: This workflow waits for the LLM to finish generating text, and *then* waits for the TTS engine to synthesize audio. This serial latency is the biggest UX hurdle.

#### Coupling Notes
* Currently well encapsulated. The `VoiceService` is dedicated solely to ElevenLabs integration.

### Generate Audio (`VoiceService`)

#### Definition
The specific adapter for the third-party TTS provider.

#### Current Implementation
`VoiceService.generateAudio` makes a `fetch` request to `api.elevenlabs.io`. If it fails or the key is missing, it returns a hardcoded base64 string representing a silent/dummy MP3 file so the frontend doesn't crash.

#### Ideal Implementation
Remains an adapter, but could be abstracted behind an interface if multiple providers (e.g., OpenAI TTS, Google Cloud TTS) are supported in the future.

#### Inputs
* `text` (string)

#### Outputs
* `Buffer`

## Workflow Participation
* **W5 (Voice Interaction)**: Owns this workflow from end to end.

## Direct Dependencies
* M2 (Transcript Engine)
* M5 (Intelligence Core)
* External TTS Provider (ElevenLabs)

## Allowed Dependencies
* None.

## Forbidden Dependencies
* M4 (Automation Orchestrator)
* M1 (Meeting Lifecycle)

## Encapsulation Boundaries
Owns all configuration and logic related to audio synthesis and conversational prompt engineering.

## Public Interface Surface
* `POST /api/voice/interact`

## Internal Implementation Details
Currently uses `voiceController.js` and `VoiceService.js`. The prompt lives in `LLMService.js`.

## Reusability Potential
Medium. The TTS adapter (`VoiceService`) is highly reusable. The interaction controller is specific to the meeting context.

## Extractability Potential
High. If latency becomes an issue, this could be extracted to a service that supports WebSockets for streaming audio back to the client as it's generated, rather than waiting for the entire buffer.

## Scalability Considerations
* TTS APIs are expensive and rate-limited.
* Base64 encoding audio over REST is inefficient for large files; streaming binary data via WebSockets or HTTP streams is required for scaling.

## Operational Responsibilities
Monitoring TTS API quotas and costs. Handling API key rotation.

## Current Architectural Problems
* **Prompt Leakage**: The specialized voice prompt is hardcoded inside `LLMService.generateVoiceResponse` instead of living within the Voice Interaction module.
* **REST Transport**: Returning base64 audio in a JSON payload is inefficient and prevents streaming playback on the client.

## Technical Debt Impact
Medium. The REST payload approach is fine for short answers but will cause noticeable UI freezes if the LLM generates a long paragraph.

## Future Expansion Opportunities
* **Audio Streaming**: Implementing chunked transfer encoding or WebSockets so the client can begin playing audio before the synthesis is complete.
* **Voice Cloning**: Allowing users to select different voices or clone their own.
* **Speech-to-Text (STT)**: Moving the audio transcription of the user's query from the client-side (browser APIs) to the server-side (e.g., Whisper API) for better accuracy.

## Ownership Violations in Current Implementation
* `LLMService` owns the voice prompt logic (Violation V4).

## Recommended Refactoring Directions
1. Move the `generateVoiceResponse` prompt logic out of `LLMService` and into `voiceController` or a new `VoiceInteractionService`.
2. Ensure `LLMService` exposes only a generic `complete(prompt)` method.
3. Investigate moving from a REST JSON response to a streamable audio endpoint if latency requirements tighten.


# 10. Communication & Notification

## Purpose
To manage all outbound communications from the system to users and third-party services. This module abstracts the complexities of generating HTML emails, resolving recipient lists, and dispatching webhooks.

## Core Responsibility
Act as the execution engine for notification-based intents (e.g., `email_summary`). It takes raw data (like meeting summaries and recipient preferences), formats it into presentation-ready templates (HTML), and executes the network request to the delivery provider (currently n8n).

## Owned Domain Concepts
* **Recipient Resolution**: The logic required to determine who should receive a notification, falling back to workspace defaults if specific recipients are missing.
* **Email Templates**: The structural HTML/CSS formatting applied to raw data before sending.
* **Webhook Dispatch**: The execution of HTTP POST requests to configured external automation platforms.

## Owned State
* **Email Templates** (Code/Static Assets)
* **Webhook Configuration** (Loaded from X1: `N8N_WEBHOOK_URL`)
* (Future) **Notification Queue / Delivery Logs**

## Responsibilities

* **Recipient Resolution**
  * Definition: Determining the final list of email addresses for a notification.
  * Owned behaviors: Checking user-provided parameter lists, falling back to querying the Workspace module (M11) for default members, validating email address formats.
  * Ownership scope: `resolveRecipients` logic.
  * Workflow participation: W2 (Post-Meeting Automation), W3 (Automation Approval).

* **Email Composition**
  * Definition: Transforming structured summary data into a formatted HTML string.
  * Owned behaviors: Iterating over key points, decisions, and action items to build HTML lists, applying inline CSS for styling.
  * Ownership scope: The HTML generation logic.
  * Workflow participation: W3.

* **Webhook Dispatch**
  * Definition: Sending payloads to external services like n8n.
  * Owned behaviors: Formatting the JSON payload, executing the `fetch` request, handling response codes, capturing external execution IDs.
  * Ownership scope: Network adapter for n8n.
  * Workflow participation: W3.

## Requirements

* **Reliable Delivery**
  * Definition: Notifications must reach their destinations or fail loudly.
  * Constraints: Must handle network timeouts to external webhooks.
  * Validation expectations: Must verify recipient lists are not empty before attempting to send.
  * Operational expectations: Should log the external ID returned by n8n for auditability.

* **Presentation Quality**
  * Definition: Outbound emails must be professionally formatted.
  * Constraints: Must use inline CSS (as required by most email clients).

## Functionalities

### Generate Email Summary Payload

#### Definition
Takes the raw `AutomationLog` parameters and prepares the final payload required by the n8n webhook, specifically generating the HTML body and joining the recipient list.

#### Current Implementation
Massively violates boundaries by being embedded directly inside `AutomationService.triggerWebhook()`. It manually constructs the HTML string inside the webhook dispatch loop and queries `Workspace` members inside `meetingController.endMeeting()`.

#### Ideal Implementation
Implemented as a dedicated `CommunicationService.dispatchEmailSummary(meetingId, summaryData, overrideRecipients)`. It handles resolving the recipients, applying an HTML template, and then calling an internal `WebhookClient`.

#### Inputs
* `meetingId` (string)
* `summaryData` (object)
* `overrideRecipients` (array, optional)

#### Outputs
* Success confirmation or throws Error.

#### Side Effects
* Network request to n8n.

#### State Mutations
* None.

#### Dependencies
* M11 (Workspace & Identity) - to resolve default members.
* X1 (Configuration) - to get webhook URL.

#### Failure Conditions
* No recipients found.
* Webhook URL not configured.
* Webhook returns 5xx error.

#### Operational Considerations
* Webhooks can be slow. This should be executed asynchronously so it doesn't block the UI thread during automation approval.

#### Coupling Notes
* Currently trapped inside `AutomationService`. It needs to be extracted so the Orchestrator can just say "execute email intent" and let this module handle the details.

### Dispatch Webhook

#### Definition
A generic internal adapter for sending data to n8n or other webhook listeners.

#### Current Implementation
Also embedded in `AutomationService.triggerWebhook`.

#### Ideal Implementation
`WebhookClient.dispatch(url, payload)`. Handles the HTTP mechanics, retries, and error parsing.

#### Inputs
* `url` (string)
* `payload` (object)

#### Outputs
* `responseData` (object)

## Workflow Participation
* **W3 (Automation Approval Pipeline)**: The final step of the pipeline when an `email_summary` intent is approved.

## Direct Dependencies
* M11 (Workspace & Identity)
* X1 (Configuration)

## Allowed Dependencies
* None.

## Forbidden Dependencies
* M4 (Automation Orchestrator) - The orchestrator calls this module; this module does not call the orchestrator.
* M1 (Meeting Lifecycle) - Should not query the meeting directly; data should be passed in.

## Encapsulation Boundaries
Owns all HTML email templates and the mechanics of sending webhooks.

## Public Interface Surface
* `dispatchEmailSummary(meetingId, summary, recipients)`
* `dispatchWebhook(url, payload)`
* (Future) `sendNotification(userId, message)`

## Internal Implementation Details
Currently uses `fetch` for HTTP requests and string interpolation for HTML generation.

## Reusability Potential
Medium. Webhook dispatch is highly reusable. The email templates are specific to the meeting domain.

## Extractability Potential
High. Could easily be an independent microservice responsible for formatting and queueing emails (e.g., integrating directly with SendGrid or AWS SES instead of n8n).

## Scalability Considerations
If moved from n8n to direct email sending (SMTP/SendGrid), a message queue (RabbitMQ/SQS) is required to handle high volumes without dropping emails.

## Operational Responsibilities
Monitoring webhook delivery success rates and investigating HTML rendering issues in various email clients.

## Current Architectural Problems
* **Severe Coupling**: Email composition and recipient resolution are currently scattered across `AutomationService` and `meetingController`.

## Technical Debt Impact
High. Changing the email template requires modifying the core automation orchestration service.

## Future Expansion Opportunities
* **Slack/Teams Integrations**: Adding new intent handlers for `send_slack_message`.
* **Direct Email Integration**: Bypassing n8n and using SendGrid/Mailgun directly for better deliverability tracking.
* **Notification Preferences**: Allowing users to opt-out of certain types of emails.

## Ownership Violations in Current Implementation
* `AutomationService` owns email HTML composition (Violation V2).
* `meetingController` owns recipient fallback resolution.

## Recommended Refactoring Directions
1. Create a `CommunicationService`.
2. Move the HTML template logic out of `AutomationService` into a dedicated template file owned by `CommunicationService`.
3. Move the recipient resolution logic from `meetingController` into `CommunicationService`.
4. Update `AutomationOrchestrator` to call `CommunicationService.dispatchEmailSummary` when the appropriate intent is approved.


# 11. Workspace & Identity

## Purpose
To manage team organization, grouping of users into collaborative units (workspaces), and serving as the foundational module for future authentication, authorization, and multi-tenancy requirements.

## Core Responsibility
Maintain the source of truth for who belongs to which workspace. It provides the directory of members that other modules (like Communication) use to resolve default recipients, and provides the boundaries for data isolation (e.g., ensuring users only see meetings from their workspace).

## Owned Domain Concepts
* **Workspace**: A logical grouping of users and their associated data (meetings, visual artifacts).
* **Workspace Member**: An individual belonging to a workspace, characterized currently by a name and email.
* (Future) **User Identity**: The authenticated entity accessing the system.
* (Future) **Role/Permission**: The level of access a member has within a workspace.

## Owned State
* `Workspace` entity records (in MongoDB).
  * `name` (String)
  * `members` (Array of `{name, email}`)
  * `createdAt` (Date)
  * `updatedAt` (Date)

## Responsibilities

* **Workspace Management**
  * Definition: Creating, updating, and deleting workspace records.
  * Owned behaviors: Managing the metadata and member lists of a workspace.
  * Ownership scope: The `Workspace` collection schema and CRUD operations.
  * Workflow participation: UI settings/configuration.

* **Member Resolution**
  * Definition: Providing a list of members associated with a specific workspace ID.
  * Owned behaviors: Querying the database to retrieve member emails.
  * Ownership scope: Member directory access.
  * Workflow participation: W2 (Post-Meeting Automation - used for email recipient fallback).

* **Data Isolation (Future)**
  * Definition: Ensuring all queries for meetings, insights, and automations are scoped to the current user's workspace.
  * Owned behaviors: Providing authorization middleware.
  * Ownership scope: Access control logic.

## Requirements

* **Referential Integrity**
  * Definition: Workspaces are referenced by other entities (like `Meeting`).
  * Constraints: If a workspace is deleted, associated meetings should theoretically be deleted or archived. (Currently not implemented, but a future invariant).
  * Validation expectations: Workspace creation requires at least a name.

* **Security Boundary (Future)**
  * Definition: This module must protect data across tenants.
  * Constraints: Every API endpoint must eventually validate the request against the Workspace identity.

## Functionalities

### Workspace CRUD Operations

#### Definition
Standard endpoints for managing workspaces and their members.

#### Current Implementation
`workspaceController.js` implements basic REST endpoints (`createWorkspace`, `getWorkspaces`, `updateWorkspace`, `deleteWorkspace`) interacting with the Mongoose `Workspace` model.

#### Ideal Implementation
Exposes both external REST endpoints (for UI management) and internal service methods (e.g., `WorkspaceService.getMembers(id)`) for other modules to consume securely without making HTTP requests.

#### Inputs
* `name`
* `members` array

#### Outputs
* `Workspace` object.

#### Side Effects
* Mutates MongoDB.

#### State Mutations
* Inserts/Updates/Deletes `Workspace` records.

#### Dependencies
* Database Driver.

#### Failure Conditions
* Database failure.
* Invalid input formats.

#### Coupling Notes
* Currently well encapsulated as a distinct controller and model.

### Resolve Workspace Members

#### Definition
A utility function for other modules to retrieve the default list of people who should be notified about activity in a workspace.

#### Current Implementation
Currently, `meetingController.endMeeting` directly imports the `Workspace` model and performs the query `await Workspace.findById(meeting.workspaceId)` to get the members for the email summary.

#### Ideal Implementation
Implemented as an internal method: `WorkspaceService.getWorkspaceMembers(workspaceId)`. The Communication module calls this method to retrieve the default recipients if none were explicitly provided.

#### Inputs
* `workspaceId` (string)

#### Outputs
* Array of member objects `{name, email}`.

#### Dependencies
* Database.

#### Coupling Notes
* The current direct model access from `meetingController` breaks encapsulation.

## Workflow Participation
* **W2 (Post-Meeting Automation)**: Acts as a data provider to resolve default email recipients.

## Direct Dependencies
* X1 (Configuration)
* Database Driver

## Allowed Dependencies
* None. This is a foundational data module.

## Forbidden Dependencies
* M1, M2, M4, M6, M10. The Identity module should not depend on business domain modules.

## Encapsulation Boundaries
Strictly owns the `Workspace` collection. Other modules must ask this module for workspace data, rather than querying the database directly.

## Public Interface Surface
* `POST /api/workspaces`
* `GET /api/workspaces`
* `PUT /api/workspaces/:id`
* `DELETE /api/workspaces/:id`
* (Internal) `getWorkspaceMembers(id)`

## Internal Implementation Details
Uses Mongoose and a standard Express controller structure.

## Reusability Potential
High. Workspace/Tenant management is a universal requirement for B2B SaaS applications.

## Extractability Potential
High. Could easily be extracted into an Identity and Access Management (IAM) microservice.

## Scalability Considerations
Read-heavy, especially when (in the future) every request requires workspace authorization. Caching workspace data (e.g., in Redis) is critical for scaling multi-tenant authorization.

## Operational Responsibilities
None currently, beyond standard database uptime.

## Current Architectural Problems
* **Underdeveloped**: Currently lacks true authentication or user identity; it simply manages a list of names/emails.
* **Encapsulation Breach**: `meetingController` directly queries the `Workspace` collection.

## Technical Debt Impact
Low currently, but will become critical when true multi-tenancy and authentication are required. Adding Auth later requires touching almost every endpoint if not abstracted early.

## Future Expansion Opportunities
* **Authentication**: Integrating OAuth (Google, Microsoft) or standard JWT-based login.
* **Role-Based Access Control (RBAC)**: Assigning users as 'Admin', 'Editor', or 'Viewer' within a workspace to restrict who can approve automations or end meetings.
* **Billing/Quotas**: Tracking LLM API usage at the workspace level for SaaS billing.

## Ownership Violations in Current Implementation
* `meetingController.endMeeting` queries the `Workspace` collection directly instead of using a service method.

## Recommended Refactoring Directions
1. Create a `WorkspaceService` to encapsulate database queries.
2. Update `meetingController` (or ideally `CommunicationService`, as per M10 refactoring) to call `WorkspaceService.getWorkspaceMembers` instead of querying the model directly.


# 12. Presentation Application

## Purpose
To provide the interactive user interface for the NeuroNotes system. It handles user inputs, renders complex data visualizations, streams real-time meeting updates, and provides the conversational chat and voice interfaces.

## Core Responsibility
Manage client-side application state, orchestrate communication with the backend APIs, compose reusable UI components into cohesive views, and deliver a "wow-factor" visual experience (glassmorphism, animations) that aligns with the product's premium aesthetic goals.

## Owned Domain Concepts
* **Application State**: The ephemeral, client-side representation of the current view, active meetings, and user inputs.
* **Component Library**: Reusable React components (Charts, Modals, Indicators).
* **View Composition**: The layout and assembly of components into pages (Dashboard, Live Meeting, Insights).
* **Client-Side API Orchestration**: Fetching data, managing polling intervals, and handling network errors.

## Owned State
* `AppContext` State (React Context/Reducer).
  * `activeRoute`, `activeMeetingId`, `isLive`, `elapsedTime`
  * `meetings`, `chatHistory`, `pendingAutomations`
  * UI state flags (`sidebarCollapsed`, `isNewMeetingModalOpen`, `commandBarFocused`)

## Responsibilities

* **State Management (M12a)**
  * Definition: Managing the single source of truth for the frontend UI.
  * Owned behaviors: Defining state shape, exposing actions (e.g., `setActiveMeeting`, `addChatMessage`), reducing state transitions.
  * Ownership scope: `AppContext.tsx` and related hooks.
  * Workflow participation: Drives all frontend reactivity.

* **API Client (M12b)**
  * Definition: Handling network communication with the backend.
  * Owned behaviors: Executing HTTP requests, managing the polling loop for live transcript/automation updates, centralizing the API base URL.
  * Ownership scope: Network layer.
  * Workflow participation: Acts as the consumer for W1-W7 outputs.

* **Component Library (M12c)**
  * Definition: The primitive UI building blocks.
  * Owned behaviors: Rendering specific data structures (like Chart.js rendering VisualArtifact data), handling local component state (like hover effects or voice visualizer animations).
  * Ownership scope: `client/src/components/*`.
  * Workflow participation: Presentation layer.

* **View Composition (M12d)**
  * Definition: Assembling components into logical pages.
  * Owned behaviors: Connecting components to `AppContext`, managing layout, handling view-level transitions.
  * Ownership scope: `client/src/views/*`.
  * Workflow participation: User navigation.

## Requirements

* **Real-time Reactivity**
  * Definition: The UI must reflect the live state of a meeting without requiring manual refreshes.
  * Constraints: Currently implemented via polling (fetching data every X seconds). Must not overwhelm the server.
  * Future expectation: Transition to WebSockets for push-based updates.

* **Premium Aesthetics**
  * Definition: The application must adhere to the high-end, dynamic design specification.
  * Constraints: Must use predefined CSS tokens, glassmorphism effects, smooth transitions, and vibrant colors (as defined in `index.css`).

## Functionalities

### Live Meeting View (M12d)

#### Definition
The primary view during an active session, displaying the transcript, active visualizations, and pending automations in real-time.

#### Current Implementation
`LiveMeeting.tsx` relies heavily on `AppContext` for state. It renders the `TranscriptView`, `LiveIndicator`, and `VisualIntelligence` sections. It triggers polling mechanisms located inside `AppContext.tsx`.

#### Ideal Implementation
The view focuses entirely on layout. Polling logic is extracted to a dedicated `useMeetingPolling` hook or a specific API client layer, cleanly separating network orchestration from view rendering.

#### Inputs
* `activeMeetingId` (from state)

#### Outputs
* Rendered DOM.

#### Dependencies
* M12a (State), M12c (Components).

### Application State Management (M12a)

#### Definition
The centralized store for data shared across multiple views.

#### Current Implementation
`AppContext.tsx` contains the state definition, the actions, AND the `fetch` API calls (e.g., `fetchMeetings`, `pollData`). It mixes pure state transition logic with asynchronous side-effects.

#### Ideal Implementation
State management (React Context/Redux) contains *only* pure state transitions (reducers). All asynchronous API calls and polling loops are moved to a separate API/Service layer (or hooks like React Query), which dispatches results to the state store.

#### Side Effects
* Currently performs network requests (violation).

#### Coupling Notes
* State transitions and API calls are tightly coupled in the same file.

### Backend Communication (M12b)

#### Definition
The configuration and execution of network requests to the NeuroNotes backend.

#### Current Implementation
API endpoints are hardcoded throughout the app as `fetch('http://localhost:5000/api/...')`. There are over 22 instances of this hardcoded string.

#### Ideal Implementation
A centralized API client (e.g., Axios instance or centralized fetch wrapper) that reads the base URL from environment variables (`import.meta.env.VITE_API_BASE_URL`). This client handles authentication headers (future), global error catching, and response normalization.

#### Coupling Notes
* Currently highly decentralized and brittle. Changing the backend port requires finding and replacing strings in dozens of files.

## Workflow Participation
* Participates as the initiator or consumer of all system workflows. It is the boundary between the human user and the system.

## Direct Dependencies
* All Backend Modules (consumed via HTTP APIs).

## Allowed Dependencies
* N/A (Frontend boundaries apply).

## Forbidden Dependencies
* Direct database access (must go through backend).

## Encapsulation Boundaries
Strictly encapsulates UI rendering and client-side interactions.

## Public Interface Surface
* N/A (It is a client application, it exposes a UI to the user, not APIs to other systems).

## Internal Implementation Details
Built with React, TypeScript, and vanilla CSS. Uses Chart.js for visualizations.

## Reusability Potential
Low. The presentation application is highly specific to the NeuroNotes product. However, individual components within M12c (like `LiveIndicator`) are reusable within the app.

## Extractability Potential
High. The frontend is already a separate package (`/client`) and can be deployed independently to a CDN or static hosting provider (e.g., Vercel, Netlify).

## Scalability Considerations
The primary scalability concern is the polling mechanism. As concurrent users scale, polling 10+ endpoints every 2 seconds will crush the backend. A migration to WebSockets or Server-Sent Events (SSE) is mandatory for scale.

## Operational Responsibilities
Ensuring the application loads quickly (bundle optimization) and gracefully handles backend outages (e.g., showing a "Connecting..." banner instead of crashing).

## Current Architectural Problems
* **Hardcoded API URLs**: 22+ instances of `http://localhost:5000`.
* **State/Effect Mixing**: `AppContext` is bloated with network requests and polling timers.
* **Polling Loop**: Using `setInterval` in React effects is notoriously prone to memory leaks and race conditions if cleanup functions aren't perfect.

## Technical Debt Impact
High. The hardcoded URLs mean the app cannot be deployed to production without manual code changes. The mixed AppContext makes it difficult to test state transitions without mocking network requests.

## Future Expansion Opportunities
* **WebSockets Integration**: Replacing polling with real-time event listeners.
* **Progressive Web App (PWA)**: Allowing the app to be installed locally and work offline (caching meeting history).
* **Responsive Design**: Expanding the layout to support mobile devices for on-the-go meeting review.

## Ownership Violations in Current Implementation
* `AppContext` acts as both the state store AND the API client (Violation V6).

## Recommended Refactoring Directions
1. Create a centralized `apiClient.ts` that uses environment variables for the base URL. Replace all `fetch('http://localhost:5000...')` calls with this client.
2. Extract all data fetching logic from `AppContext.tsx` into custom hooks (e.g., `useMeetings`, `useLiveTranscript`).
3. Refactor `AppContext` to only contain pure state transitions and expose a clean `dispatch` mechanism.


# 13. Configuration & Environment

## Purpose
To provide a centralized, secure, and predictable mechanism for managing environment variables, external API keys, feature flags, and database connection strings across the entire system.

## Core Responsibility
Act as the single source of truth for all application configuration, ensuring that no domain module directly reads from `process.env`. It parses, validates, and exposes configuration values.

## Owned Domain Concepts
* **Environment Variables**: System-level configuration injected at runtime.
* **Feature Flags**: Toggles that enable or disable specific application behaviors (e.g., `DEMO_MODE`).
* **Secrets Management**: The secure handling of API keys (Groq, ElevenLabs, Firebase) to prevent accidental leakage.

## Owned State
* **Configuration Singleton** (In-memory representation of validated environment variables).

## Responsibilities

* **Environment Loading & Validation**
  * Definition: Reading raw variables and ensuring required values are present.
  * Owned behaviors: Parsing `.env` files, verifying non-null constraints on critical keys before application startup.
  * Ownership scope: Application initialization phase.
  * Workflow participation: System Startup.

* **Configuration Access**
  * Definition: Providing a type-safe interface for other modules to access config.
  * Owned behaviors: Exposing getter methods for API keys, ports, and database URIs.
  * Ownership scope: `config` export object.
  * Workflow participation: Consulted by M2, M5, M9, M10.

* **Feature Flag Evaluation**
  * Definition: Determining if a specific feature or mock behavior should be active.
  * Owned behaviors: Evaluating the boolean state of `DEMO_MODE`.
  * Ownership scope: Feature flag resolution logic.
  * Workflow participation: Consulted by M5, M2.

## Requirements

* **Fail-Fast Initialization**
  * Definition: The system should not start if critical configuration is missing.
  * Constraints: If `MONGODB_URI` or `GROK_API_KEY` is missing (and not in demo mode), the process must exit immediately.
  * Invariants: Once loaded, configuration values should be immutable during runtime.
  * Validation expectations: Type checking (e.g., converting "true" string to boolean).
  * Operational expectations: Configuration errors must be logged clearly before process exit.

* **Secret Isolation**
  * Definition: Sensitive values must be protected.
  * Constraints: Configuration objects must never be logged in their entirety.

## Functionalities

### Load and Validate Configuration

#### Definition
The startup routine that reads environment variables and constructs the config object.

#### Current Implementation
Scattered. `server/src/config/env.js` loads some variables, `config/db.js` loads others directly using `process.env`, and `config/firebase.js` does the same.

#### Ideal Implementation
A single `ConfigService` that executes before any other module loads. It uses a schema validation library (like Joi or Zod) to parse `process.env`, throw errors for missing values, and export an immutable object.

#### Inputs
* `process.env`

#### Outputs
* Validated `Config` object.

#### Side Effects
* Throws fatal error on process if validation fails.

#### State Mutations
* Initializes the in-memory singleton.

#### Dependencies
* `dotenv` (or similar environment loader).

#### Failure Conditions
* Missing required environment variables.

#### Operational Considerations
* Must support different `.env` files based on `NODE_ENV` (development vs. production).

#### Scalability Considerations
* N/A (Runs once at startup).

#### Coupling Notes
* Currently, modules like `firebase.js` depend on `process.env` directly instead of a centralized config module.

#### Security Considerations
* Prevents silent failures where an API key is missing and the app runs but fails unpredictably at runtime.

#### Testability Considerations
* Makes unit testing easier by allowing mock configurations to be injected into services instead of hacking `process.env`.

## Workflow Participation
* Participates implicitly in almost all workflows by providing the foundational configuration.

## Direct Dependencies
* None.

## Allowed Dependencies
* None.

## Forbidden Dependencies
* All domain modules.

## Encapsulation Boundaries
Strictly encapsulates the reading of OS-level environment variables.

## Public Interface Surface
* `getConfig()`
* `isDemoMode()`

## Internal Implementation Details
Currently uses `dotenv` across multiple files.

## Reusability Potential
Extremely High. A generic config loader is a standard pattern in all backend apps.

## Extractability Potential
High. Could integrate with an external Secret Manager (AWS Secrets Manager, HashiCorp Vault) without changing downstream code.

## Scalability Considerations
In a distributed environment, configuration might need to be fetched from a centralized configuration server rather than local `.env` files.

## Operational Responsibilities
Managing the rotation of API keys across environments.

## Current Architectural Problems
* Configuration loading is decentralized. `process.env` is read directly inside files like `db.js` and `firebase.js`.

## Technical Debt Impact
Medium. Makes it difficult to know exactly which environment variables are required to run the project.

## Future Expansion Opportunities
* **Remote Configuration**: Fetching config from a central server at startup.
* **Dynamic Feature Flags**: Fetching feature flag states from a service like LaunchDarkly without requiring a restart.

## Ownership Violations in Current Implementation
* Various files (`db.js`, `firebase.js`) bypass the config module and access `process.env` directly.

## Recommended Refactoring Directions
1. Consolidate `env.js`, `db.js` env reads, and `firebase.js` env reads into a single `config/index.js`.
2. Apply strict validation.
3. Update all modules to `require('../config')` instead of `process.env`.


# 14. Observability

## Purpose
To provide visibility into the system's runtime behavior, health, and performance. It standardizes how errors are caught, classified, and reported, and how operational events are logged for debugging and audit purposes.

## Core Responsibility
Expose interfaces for structured logging, capture unhandled exceptions, provide system health check endpoints, and lay the foundation for future metrics and distributed tracing.

## Owned Domain Concepts
* **Structured Logging**: Emitting logs in a consistent, machine-readable format (e.g., JSON) with appropriate severity levels (INFO, WARN, ERROR).
* **Error Classification**: Categorizing errors (e.g., Validation Error, Network Error, Database Error) to determine appropriate HTTP response codes and alerting urgency.
* **Health Check**: An endpoint to verify the system is alive and connected to its dependencies.

## Owned State
* **Log Streams** (Emitted to stdout/stderr or a file).
* **Health Status** (Ephemeral).

## Responsibilities

* **Structured Logging**
  * Definition: Providing a centralized utility for emitting log messages.
  * Owned behaviors: Formatting log strings, appending timestamps, attaching correlation IDs.
  * Ownership scope: `Logger` utility.
  * Workflow participation: Used by all modules.

* **Error Handling & Normalization**
  * Definition: Catching errors before they crash the process and formatting them for the client.
  * Owned behaviors: Express error middleware, converting raw exceptions into standardized API error responses `{ error: { code, message } }`.
  * Ownership scope: `utils/errorHandler.js`.
  * Workflow participation: Request lifecycle.

* **Health Monitoring**
  * Definition: Providing a probe for load balancers or orchestrators (like Kubernetes) to check system viability.
  * Owned behaviors: Pinging MongoDB and Firebase to ensure connections are active.
  * Ownership scope: `/api/health` endpoints.
  * Workflow participation: Operational checks.

## Requirements

* **No Silent Failures**
  * Definition: All caught exceptions must be logged with a stack trace.
  * Constraints: Controllers must pass errors to the centralized `next(err)` middleware rather than just logging and returning generic 500s.
  * Validation expectations: Unhandled promise rejections must be caught at the process level.

* **Machine Readability**
  * Definition: Logs must be parseable by external systems (like Datadog, ELK stack).
  * Constraints: Use JSON formatting instead of raw strings for complex objects.

## Functionalities

### Centralized Error Middleware

#### Definition
Catches all errors thrown within Express route handlers.

#### Current Implementation
Exists partially as `utils/errorHandler.js` but is inconsistently applied. Many controllers use `try { ... } catch(err) { console.error(err); res.status(500).json({error}) }`.

#### Ideal Implementation
A global Express middleware `app.use(errorHandler)`. Controllers throw or pass errors to `next()`. The middleware logs the error structurally and formats a safe JSON response for the client, masking internal stack traces from the public API.

#### Inputs
* `err`, `req`, `res`, `next`

#### Outputs
* HTTP Response (4xx or 5xx).

#### Side Effects
* Emits to log stream.

#### State Mutations
* None.

#### Dependencies
* Express framework.

#### Operational Considerations
* Must mask sensitive data (like DB connection strings or tokens) if they appear in error messages.

#### Coupling Notes
* Designed to be highly coupled to the web framework (Express) but decoupled from domain logic.

### Structured Logging

#### Definition
A wrapper around console output to enforce consistent formatting.

#### Current Implementation
Ad-hoc `console.log()` and `console.error()` calls scattered throughout the codebase.

#### Ideal Implementation
A singleton `Logger` (e.g., using Winston or Pino) that enforces levels (`logger.info`, `logger.warn`, `logger.error`).

#### Inputs
* `message` (string)
* `context` (object)

#### Outputs
* Formatted log string to stdout.

#### Operational Considerations
* Critical for diagnosing issues in production where debuggers cannot be attached.

## Workflow Participation
* Participates implicitly across all workflows by observing their execution.

## Direct Dependencies
* None.

## Allowed Dependencies
* None.

## Forbidden Dependencies
* All domain modules.

## Encapsulation Boundaries
Strictly encapsulates the formatting of output streams and the HTTP error response structure.

## Public Interface Surface
* `GET /api/health`
* (Internal) `logger.info()`, `logger.error()`
* (Internal) `errorHandler` middleware

## Internal Implementation Details
Currently mostly native `console` methods.

## Reusability Potential
High. Generic error and logging middleware is standard in all Node.js projects.

## Extractability Potential
High. Could be extracted into a shared library used across multiple microservices.

## Scalability Considerations
Writing logs synchronously to a file can block the Node.js event loop. Logs should be written to stdout and captured by a separate process (like Fluentd or Docker logs driver).

## Operational Responsibilities
Integrating with PagerDuty or Slack for critical error alerts.

## Current Architectural Problems
* **Inconsistent Error Handling**: Controllers handle their own try/catch blocks and response formatting, leading to duplicated logic and inconsistent API responses.
* **Unstructured Logs**: `console.log` makes it difficult to search for specific errors or correlate logs across a single request.

## Technical Debt Impact
Medium. Makes debugging production issues significantly harder and slower.

## Future Expansion Opportunities
* **Distributed Tracing**: Injecting correlation IDs into incoming requests and passing them to all downstream API calls (e.g., to M5 LLM API) to trace a request end-to-end.
* **Metrics**: Recording API latency and request counts for Prometheus/Grafana dashboards.

## Ownership Violations in Current Implementation
* Controllers owning the formatting of 500 error responses.

## Recommended Refactoring Directions
1. Implement a structured logger (like Pino).
2. Replace all `console.log` with `logger.info`.
3. Standardize the `utils/errorHandler.js` and enforce its use across all controllers by removing manual `res.status(500)` calls in catch blocks.


