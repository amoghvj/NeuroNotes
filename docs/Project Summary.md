# System Overview

## Purpose

NeuroNotes is an intelligent meeting assistant application designed to automatically capture, analyze, and extract value from live meeting conversations. It solves the problem of manual note-taking, lost action items, and subjective meeting analysis by providing real-time transcripts, AI-generated summaries, data visualizations driven by voice, and interactive conversational interfaces (chat and voice) to query meeting context.

## Primary Users

*   **Meeting Hosts / Team Leads**: Utilize the platform to run structured meetings, manage workspaces, review aggregated meeting analytics (engagement, sentiment, topics), and ensure outcomes (action items, decisions) are automatically captured and distributed via email.
*   **Meeting Participants**: Benefit from live transcript tracking, the ability to issue voice commands (e.g., scheduling follow-ups, requesting visualizations), and interacting with the AI via chat or voice to query meeting details on demand.
*   **Developers / Demo Presenters**: Utilize features like Meeting Simulation and Demo Mode to test and showcase the application without requiring live audio or external AI API connections.

## Core Capabilities

The system provides 16 documented core features:

*   **Core Entity Management**: Meeting Management (F01) handles the lifecycle of meeting sessions, while Workspace & Team Management (F14) groups users and meetings into collaborative units.
*   **Data Ingestion**: Live Transcript Capture (F02) processes real-time speech-to-text data via webhooks. Meeting Simulation (F03) provides a testing alternative by injecting scripted transcripts.
*   **Real-time Interaction**: Voice Command Detection (F04) allows users to trigger actions verbally ("Hey NeuroNotes..."). Live Visualization Generation (F09) dynamically creates charts from spoken data during the meeting.
*   **Post-Meeting Intelligence**: Post-Meeting Summary Generation (F06) and Action Item & Decision Extraction (F07) automatically process the full transcript to produce structured records of the discussion. Meeting Analytics & Insights Dashboard (F08) provides quantitative and qualitative metrics (speaker stats, sentiment, topics).
*   **Automation & Dispatch**: The Automation Approval Workflow (F05) provides a human-in-the-loop safety mechanism before executing intents like Email Summary Dispatch (F12) and Meeting Scheduling via Voice (F13).
*   **Conversational Interfaces**: Users can interrogate meeting data via an AI Chat Assistant (F10) or hands-free Voice AI Interaction (F11).
*   **Overview & Presentation**: Dashboard & Meeting History (F16) provides an aggregated view of past meetings, while Demo Mode (F15) allows the entire system to run using mock AI responses.

## Major Workflows

The features interact through several distinct, sequential workflows:

1.  **Ingestion & Real-time Command Pipeline**: Live audio is transcribed externally and sent to the backend as transcript batches (F02). As data flows in, it is simultaneously saved to the database (for the UI) and scanned for voice commands (F04). Detected intents (e.g., scheduling a meeting, generating a chart) are refined by the LLM and passed to the Automation Orchestrator.
2.  **Automation & Approval Cycle**: Detected intents are queued as pending tasks (F05). The user reviews the extracted parameters in the UI. Upon approval, the system executes the corresponding action (e.g., creating a new meeting entity for F13, or dispatching an email via n8n for F12).
3.  **Post-Meeting Processing**: When a meeting concludes (F01), an asynchronous process fetches the complete transcript. It calls the LLM to generate a comprehensive summary (F06), extract action items and decisions (F07), and compute analytics and sentiment (F08). This output is then queued as an email automation (F12).
4.  **Interactive Querying**: At any time during or after a meeting, users can submit text (F10) or voice (F11) queries. The system retrieves the relevant transcript context, constructs a grounded LLM prompt, and returns a formatted response (text or synthesized audio).

## System Scope

The system is scoped to:
*   Manage basic meeting and workspace metadata.
*   Ingest, time-window, and store text-based transcript data.
*   Detect specific keywords ("Hey NeuroNotes") to trigger predefined intent classification.
*   Prompt LLMs to extract parameters, summarize text, extract decisions/action items, categorize topics, and evaluate sentiment.
*   Provide a human-in-the-loop approval mechanism for automated actions.
*   Generate chart configurations from spoken numbers.
*   Answer natural language questions strictly grounded in the context of a single meeting's transcript.
*   Synthesize audio responses using external TTS providers.
*   Dispatch webhook payloads to trigger external email delivery.

## Out Of Scope

The system explicitly does *not* handle:
*   **Direct Audio Processing**: It does not record audio or perform Speech-to-Text (STT) natively; it relies on an external Chrome extension for STT.
*   **Authentication & Access Control**: There is no login system, password management, or role-based access control. Any user can access any workspace or meeting.
*   **Native Email Delivery**: It does not send emails directly via SMTP; it relies on an external n8n webhook integration.
*   **Calendar Integration**: Scheduled meetings are stored only within the application's database, with no synchronization to Google Calendar or Outlook.
*   **Cross-Meeting Context**: AI querying and analytics are strictly isolated to single meetings. The system cannot answer questions across multiple meetings (e.g., "What did we discuss in all meetings this month?").
*   **Multi-Series Visualizations**: Charts are limited to single datasets; complex, grouped visualizations are not supported.

## Documentation Coverage

The current documentation provides a strong, high-level structural understanding of the system based entirely on existing design artifacts (`Modules.md`, `ModuleMap.md`).

**Fully Documented Areas:**
*   Module boundaries, ownership, and allowed dependencies.
*   High-level workflow routing and feature definitions.
*   The intended purpose and capabilities of each user-facing feature.
*   Conceptual limitations and recognized architectural problems (e.g., coupling in the Orchestrator, hardcoded URLs in the frontend).

**Areas Requiring Additional Investigation (Codebase Inspection Needed):**
*   **Exact Data Models**: The precise schema definitions for MongoDB (Mongoose models) and Firestore structures are not fully detailed.
*   **LLM Prompts**: The actual text of the system prompts used for summarization, extraction, and chat grounding is unknown.
*   **Client-Side Implementation**: The specific React component tree, state management patterns (inside `AppContext`), and Chart.js configurations need code-level review.
*   **Error Handling Paths**: How the system behaves when the LLM hallucinates data, when the TTS API rate-limits, or when the external n8n webhook times out.
*   **Real-time Syncing Details**: The exact mechanisms and polling intervals used to keep the frontend synchronized with backend transcript and automation state.
