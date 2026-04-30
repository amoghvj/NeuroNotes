# Summary Clone — AI Meeting & Lecture Note Taker
## Architecture & Implementation Plan

---

## 1. Product Vision & Core Problem

### Product Vision
**Summary Clone** is a meeting intelligence platform that transforms any audio or transcript source into structured, actionable meeting notes. It automatically generates transcripts with speaker timestamps, TLDR summaries, bullet points, key decisions, and action items — all while supporting export to Notion/Google Docs and automation workflows.

### Core User Problem
Meeting participants waste 15-30 minutes per meeting just taking notes. After the meeting, they spend additional time synthesizing decisions and action items. Summary Clone eliminates this overhead by:
- **Real-time transcription** with speaker identification
- **AI-generated summaries** that capture key points, decisions, and actions
- **Structured data** that can be exported, searched, and integrated with other tools
- **Automation** that handles follow-ups, calendar scheduling, and email alerts

### Target Users
- **Team leads** who need to track decisions and action items
- **Engineers** who want to review technical discussions
- **Sales teams** who need to capture deal-critical information
- **Students** who want to review lecture content
- **Remote teams** who need asynchronous meeting documentation

---

## 2. Major Modules Breakdown

### Module 1: Transcript Ingestion
**Purpose**: Accept transcripts from various sources (live recording, uploaded audio, browser extension)

**Key Components**:
- `TranscriptController` - REST endpoints for chunk-based ingestion
- `AudioProcessor` - Convert audio files to text (using Whisper API)
- `ExtensionBridge` - Handle browser extension webhook payloads

**Data Flow**:
```
Source → API Endpoint → Transcript Chunk → Minute Window → Real-time Listener Update
```

### Module 2: AI Processing Engine
**Purpose**: Extract insights from transcripts using LLM

**Key Components**:
- `LLMService` - Groq/Grok API integration for summarization
- `InsightExtractor` - Parse LLM output into structured data
- `VisualEngine` - Generate chart configurations from transcript data

**Output Structure**:
```json
{
  "keyPoints": ["Point 1", "Point 2"],
  "decisions": [{"content": "...", "confidence": 0.9}],
  "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
  "opportunities": [...],
  "risks": [...],
  "visuals": [{"type": "bar", "data": {...}}]
}
```

### Module 3: Data Persistence Layer
**Purpose**: Store and retrieve meeting data with Firestore/MongoDB

**Key Components**:
- `MeetingRepository` - CRUD operations for meetings
- `MinuteRepository` - Transcript chunk storage with segment support
- `InsightRepository` - Action items and decisions storage
- `VisualRepository` - Chart data storage

### Module 4: Automation Engine
**Purpose**: Handle post-meeting workflows via n8n webhooks

**Key Components**:
- `AutomationService` - Intent detection and workflow orchestration
- `AutomationLog` - Track pending/approved/rejected automations
- `WebhookTrigger` - Send data to n8n for external integrations

### Module 5: Export Engine
**Purpose**: Export meeting data to external platforms

**Key Components**:
- `NotionExporter` - Export to Notion pages
- `GoogleDocsExporter` - Export to Google Docs
- `MarkdownExporter` - Export as markdown files

### Module 6: Voice Layer
**Purpose**: Enable voice-based interaction and text-to-speech

**Key Components**:
- `VoiceService` - ElevenLabs TTS integration
- `VoiceController` - REST endpoints for audio generation
- `VoiceUI` - Frontend component for voice playback

### Module 7: Search & History
**Purpose**: Enable meeting history search and retrieval

**Key Components**:
- `SearchService` - Full-text search across meetings
- `HistoryController` - List and filter meetings

---

## 3. Backend Architecture

### Folder Structure
```
server/
├── src/
│   ├── config/
│   │   ├── env.js              # Environment variables
│   │   ├── firebase.js         # Firebase Admin SDK (if using Firebase)
│   │   └── db.js               # MongoDB connection (if using MongoDB)
│   │
│   ├── controllers/
│   │   ├── ingestController.js     # Transcript ingestion
│   │   ├── meetingController.js    # Meeting CRUD
│   │   ├── insightsController.js   # Action items/decisions
│   │   ├── exportController.js     # Export endpoints
│   │   ├── voiceController.js      # Voice/TTS endpoints
│   │   └── searchController.js     # Search endpoints
│   │
│   ├── services/
│   │   ├── LLMService.js           # Groq/Grok integration
│   │   ├── AutomationService.js    # n8n workflow orchestration
│   │   ├── VoiceService.js         # ElevenLabs TTS
│   │   ├── VisualEngine.js         # Chart generation
│   │   ├── ExportService.js        # Notion/Google Docs export
│   │   └── SearchService.js        # Full-text search
│   │
│   ├── repositories/
│   │   ├── meetingRepository.js    # Meeting CRUD
│   │   ├── minuteRepository.js     # Transcript chunks
│   │   ├── insightRepository.js    # Actions/decisions
│   │   └── visualRepository.js     # Charts
│   │
│   ├── models/
│   │   ├── Meeting.js              # Meeting schema
│   │   ├── Minute.js               # Transcript chunk schema
│   │   ├── Action.js               # Action item schema
│   │   ├── Decision.js             # Decision schema
│   │   ├── Visual.js               # Chart schema
│   │   ├── AutomationLog.js        # Automation workflow log
│   │   └── Workspace.js            # Team/workspace schema
│   │
│   ├── routes/
│   │   ├── ingest.routes.js
│   │   ├── meeting.routes.js
│   │   ├── insights.routes.js
│   │   ├── export.routes.js
│   │   ├── voice.routes.js
│   │   └── search.routes.js
│   │
│   ├── utils/
│   │   ├── transformers.js         # Data transformation
│   │   ├── errorHandler.js         # Error handling
│   │   └── validators.js           # Request validation
│   │
│   └── app.js                      # Express app setup
│
├── scripts/
│   └── seed-demo-data.js           # Demo data seeding
│
├── package.json
└── server.js                       # Entry point
```

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (for MVP) or Firebase Firestore (for production scale)
- **LLM**: Groq API (Grok model) for fast, reliable inference
- **Real-time**: Firestore onSnapshot listeners (or Socket.IO for MVP)
- **Audio**: Whisper API for transcription, ElevenLabs for TTS
- **Automation**: n8n webhooks
- **Export**: Notion SDK, Google Docs API

---

## 4. Database Entities & Relationships

### Core Entities

#### Meeting
```javascript
{
  _id: ObjectId,
  title: String,
  status: "live" | "completed" | "scheduled",
  meetingLink: String,
  startTime: Date,
  endTime: Date,
  participants: [String],
  workspaceId: ObjectId (ref: Workspace),
  selectedRecipients: [{name: String, email: String}],
  summary: {
    keyPoints: [String],
    decisions: [{
      content: String,
      timestamp: Date,
      participants: [String]
    }],
    actionItems: [{
      content: String,
      assignee: String,
      dueDate: Date,
      status: "pending" | "in_progress" | "completed"
    }],
    opportunities: [String],
    risks: [String],
    eligibility: [String],
    questions: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Minute (Transcript Chunk)
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (ref: Meeting),
  minuteIndex: Number,
  segments: [{
    speaker: String,
    text: String,
    timestamp: Date
  }],
  transcript: String (legacy, for backward compatibility),
  startTime: Date,
  processed: Boolean,
  createdAt: Date
}
```

#### Action Item
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (ref: Meeting),
  content: String,
  assignee: String,
  status: "pending" | "in_progress" | "completed",
  sourceWindowId: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Decision
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (ref: Meeting),
  content: String,
  confidence: Number (0-1),
  sourceWindowId: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Visual Artifact
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (ref: Meeting),
  type: "bar" | "line" | "pie" | "timeline",
  title: String,
  description: String,
  data: {
    labels: [String],
    values: [Number],
    units: String
  },
  insight: String (LLM-generated insight about the chart),
  confidence: Number,
  sourceWindowId: String,
  createdAt: Date
}
```

#### Automation Log
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (ref: Meeting),
  triggerText: String,
  intent: "schedule_meeting" | "create_ticket" | "send_email" | "email_summary" | "create_visualization",
  parameters: Object,
  editedParameters: Object,
  status: "pending" | "approved" | "rejected" | "completed" | "failed",
  confidenceScore: Number (0-1),
  externalId: String,
  error: String,
  approvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Workspace
```javascript
{
  _id: ObjectId,
  name: String,
  members: [{name: String, email: String}],
  createdAt: Date,
  updatedAt: Date
}
```

### Entity Relationships
```
Workspace
  └── has many → Meetings
        └── has many → Minutes (transcript chunks)
        └── has many → Action Items
        └── has many → Decisions
        └── has many → Visual Artifacts
        └── has many → Automation Logs
```

---

## 5. API Endpoints Design

### Ingestion Endpoints

#### POST `/api/ingest/chunk`
Ingest a single transcript chunk.

**Request**:
```json
{
  "meetingId": "abc123",
  "text": "Hello everyone, welcome to the meeting.",
  "timestamp": "2026-05-01T10:00:00Z",
  "speaker": "Alice"
}
```

**Response**:
```json
{
  "success": true,
  "visualization": { "id": "vis123", "title": "Revenue Chart" },
  "automation": { "id": "auto456", "intent": "schedule_meeting", "status": "pending" }
}
```

#### POST `/api/ingest/webhook`
Handle batch transcript from browser extension.

**Request**:
```json
{
  "transcript": [
    {
      "personName": "Alice",
      "transcriptText": "Hello everyone",
      "timestamp": "2026-05-01T10:00:00Z"
    }
  ]
}
```

#### POST `/api/ingest/audio`
Upload and transcribe an audio file.

**Request** (multipart/form-data):
```
file: audio.mp3
meetingId: abc123
```

#### POST `/api/ingest/start-simulation`
Start a simulated meeting (for demos).

**Request**:
```json
{
  "title": "Demo Meeting"
}
```

### Meeting Endpoints

#### GET `/api/meetings`
List all meetings.

**Response**:
```json
[
  {
    "id": "abc123",
    "title": "Q4 Review",
    "status": "completed",
    "startTime": "2026-05-01T10:00:00Z",
    "endTime": "2026-05-01T11:00:00Z",
    "participants": ["Alice", "Bob"]
  }
]
```

#### GET `/api/meetings/:id`
Get meeting details.

#### GET `/api/meetings/:id/transcript`
Get full transcript with speaker timestamps.

#### GET `/api/meetings/:id/artifacts`
Get all actions, decisions, and visuals.

#### POST `/api/meetings/:id/end`
End a live meeting and trigger post-meeting automation.

#### POST `/api/meetings/:id/generate-summary`
Generate summary for a meeting.

### Automation Endpoints

#### GET `/api/automations`
List pending automations.

#### POST `/api/automations/:id/approve`
Approve an automation and trigger n8n webhook.

#### POST `/api/automations/:id/reject`
Reject an automation.

### Export Endpoints

#### POST `/api/export/notion`
Export meeting to Notion.

**Request**:
```json
{
  "meetingId": "abc123",
  "notionToken": "secret_xxx",
  "pageId": "page_xxx"
}
```

#### POST `/api/export/google-docs`
Export meeting to Google Docs.

**Request**:
```json
{
  "meetingId": "abc123",
  "folderId": "folder_xxx"
}
```

#### GET `/api/export/markdown/:id`
Download meeting as markdown file.

### Voice Endpoints

#### POST `/api/voice/speak`
Generate TTS audio.

**Request**:
```json
{
  "text": "Here are the key points from the meeting..."
}
```

**Response**:
```
[Binary MP3 audio]
```

#### POST `/api/voice/summarize`
Generate voice summary.

**Request**:
```json
{
  "meetingId": "abc123"
}
```

### Search Endpoints

#### GET `/api/search/meetings`
Search meetings by title, participants, or content.

**Query**:
```
?q=project&limit=10&offset=0
```

---

## 6. Transcript Storage & Processing Strategy

### Live Meeting Ingestion
1. **Chunk-based ingestion**: Frontend sends 15-60 second transcript chunks
2. **Minute window aggregation**: Group chunks by minute boundaries
3. **Segment storage**: Store each chunk as a segment within the minute window
4. **Real-time updates**: Firestore onSnapshot listeners push updates to frontend

### Uploaded Audio Processing
1. **Upload**: Frontend uploads audio file via multipart/form-data
2. **Transcription**: Backend calls Whisper API to convert audio to text
3. **Segmentation**: Split transcript into 60-second segments
4. **Speaker diarization**: Use Whisper's speaker labels or heuristic assignment
5. **Storage**: Store segments in Minute document

### Processing Pipeline
```
Transcript Chunk
    ↓
[Validate & Normalize]
    ↓
[Store in Minute Window]
    ↓
[Trigger LLM Processing]
    ↓
[Extract Insights]
    ↓
[Store Actions/Decisions/Visuals]
    ↓
[Update Real-time Listeners]
```

### Minute Window Schema
```javascript
{
  meetingId: ObjectId,
  minuteIndex: Number,
  segments: [
    { speaker: "Alice", text: "Hello", timestamp: Date },
    { speaker: "Bob", text: "Hi there", timestamp: Date }
  ],
  startTime: Date,
  processed: Boolean
}
```

---

## 7. LLM-Powered Summary Generation

### Summary Generation Flow
```
Full Transcript
    ↓
[LLM Call to Groq API]
    ↓
[Parsed JSON Response]
    ↓
[Structured Output]
```

### LLM Prompt Structure
```javascript
const prompt = `Analyze the provided meeting transcript and generate a comprehensive briefing.

Transcript:
${transcript}

Produce strictly valid JSON with:
{
  "keyPoints": ["Detailed point 1...", "Detailed point 2..."],
  "decisions": [{"content": "...", "confidence": 0.9}],
  "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
  "opportunities": [...],
  "risks": [...],
  "questions": [...]
}`;
```

### Summary Fields
1. **Key Points**: 3-5 detailed points with context
2. **Decisions**: All decisions made with confidence scores
3. **Action Items**: Tasks with assignees and status
4. **Opportunities**: Strategic opportunities identified
5. **Risks**: Risks or concerns raised
6. **Questions**: Unresolved questions

### Demo Mode Fallback
If API key is missing or rate-limited:
- Return pre-defined mock data
- Log warning for debugging
- Ensure frontend doesn't crash

---

## 8. n8n Automation Integration

### Automation Workflow
```
User says "Hey Neuro, schedule a meeting"
    ↓
[Detect Intent: schedule_meeting]
    ↓
[LLM Refine Command]
    ↓
[Create Pending Automation Log]
    ↓
[User Approves in UI]
    ↓
[Trigger n8n Webhook]
    ↓
[n8n Creates Calendar Event]
```

### n8n Webhook Payload
```json
{
  "automationId": "auto123",
  "meetingId": "meeting456",
  "intent": "email_summary",
  "parameters": {
    "recipients": ["alice@example.com", "bob@example.com"],
    "emailBody": "<html>...</html>",
    "meetingTitle": "Q4 Review",
    "meetingDate": "2026-05-01T10:00:00Z"
  },
  "trigger": {
    "text": "Hey Neuro, send a summary email",
    "speaker": "Alice",
    "timestamp": "2026-05-01T11:00:00Z"
  }
}
```

### Supported Automations
1. **Email Summary**: Send meeting summary via email
2. **Schedule Meeting**: Create calendar event
3. **Create Ticket**: Create Jira/Linear ticket
4. **Slack Notification**: Post to Slack channel
5. **Notion Page**: Create Notion page from meeting

---

## 9. Voice Layer Implementation

### Text-to-Speech
```javascript
// VoiceService.js
async generateAudio(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    }
  );
  
  return await response.arrayBuffer();
}
```

### Voice UI Components
1. **Playback Component**: Audio player with waveform visualization
2. **Summary Voice**: "Read summary aloud" button
3. **Action Item Reader**: "Read action items aloud" button

---

## 10. Graph & Visual Generation

### Visual Generation Flow
```
Transcript Analysis
    ↓
[LLM Detects Data Pattern]
    ↓
[VisualEngine Generates Chart Config]
    ↓
[Store in Visual Artifact]
```

### Chart Types
1. **Bar Chart**: Compare values across categories
2. **Line Chart**: Show trends over time
3. **Pie Chart**: Show distribution
4. **Timeline**: Show sequence of events

### Visual Schema
```javascript
{
  meetingId: ObjectId,
  type: "bar" | "line" | "pie" | "timeline",
  title: "Q1-Q4 Revenue",
  description: "Revenue by quarter",
  data: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [500, 750, 1200, 1500],
    units: "USD (thousands)"
  },
  insight: "Revenue grew 200% from Q1 to Q4",
  confidence: 0.95
}
```

---

## 11. MVP Scope

### Must-Have for MVP
1. **Transcript Ingestion**: Chunk-based API endpoint
2. **Meeting CRUD**: Create, list, get details
3. **LLM Summarization**: Groq API integration
4. **Action Items**: Extract and store action items
5. **Decisions**: Extract and store decisions
6. **Real-time Updates**: Firestore listeners or Socket.IO
7. **Export to Markdown**: Download meeting notes

### Can-Wait for v1.1
1. **Audio Upload**: Whisper API integration
2. **n8n Automation**: Email, calendar integrations
3. **Voice Layer**: TTS playback
4. **Notion Export**: Notion SDK integration
5. **Search**: Full-text search
6. **Workspace**: Multi-team support

### Cut for Now
1. **Google Docs Export**: Lower priority
2. **Live Recording**: Browser extension handles this
3. **Advanced Analytics**: Engagement metrics, sentiment
4. **Mobile App**: Web app first
5. **Custom Branding**: White-label for teams

---

## 12. Phased Build Plan

### Phase 1: Core MVP (Weeks 1-2)
**Goal**: Working transcript ingestion and summarization

**Tasks**:
1. Set up Express server with MongoDB
2. Implement meeting CRUD endpoints
3. Implement transcript chunk ingestion
4. Integrate Groq API for summarization
5. Store action items and decisions
6. Create frontend for meeting list and details

**Deliverable**: User can upload transcript, get summary with action items

### Phase 2: Real-time & Automation (Weeks 3-4)
**Goal**: Real-time updates and automation workflows

**Tasks**:
1. Implement Firestore listeners or Socket.IO
2. Set up n8n webhook integration
3. Implement automation approval flow
4. Add email summary automation
5. Add calendar scheduling automation

**Deliverable**: Real-time meeting notes with automated follow-ups

### Phase 3: Voice & Export (Weeks 5-6)
**Goal**: Voice interaction and external platform export

**Tasks**:
1. Integrate ElevenLabs TTS
2. Implement Notion export
3. Add markdown download
4. Create voice UI components
5. Add audio playback

**Deliverable**: Voice-enabled meeting notes with external export

### Phase 4: Search & Analytics (Weeks 7-8)
**Goal**: Search and analytics features

**Tasks**:
1. Implement full-text search
2. Add engagement metrics
3. Create insights dashboard
4. Add sentiment analysis
5. Optimize performance

**Deliverable**: Searchable meeting history with analytics

---

## 13. Failure Points & Edge Cases

### Technical Risks
1. **LLM Rate Limits**: Implement retry logic with exponential backoff
2. **API Key Rotation**: Store keys in environment variables, not code
3. **Transcript Length Limits**: Chunk long transcripts into multiple API calls
4. **Speaker Diarization**: Use heuristic fallback if Whisper doesn't provide labels
5. **Real-time Sync**: Implement reconnection logic for Firestore listeners

### Edge Cases
1. **Empty Transcript**: Return empty summary with warning
2. **Single Speaker**: Handle monologue-style meetings
3. **Noisy Audio**: Implement audio preprocessing
4. **Multiple Languages**: Use multilingual LLM model
5. **Concurrent Meetings**: Use meetingId to isolate data

### Error Handling
```javascript
// Centralized error handler
function handleError(error, context) {
  console.error(`[${context}]`, error.message);
  
  if (error.code === 'ECONNRESET') {
    return { error: 'Connection lost. Please try again.' };
  }
  
  if (error.message.includes('rate limit')) {
    return { error: 'Rate limit exceeded. Please try again later.' };
  }
  
  return { error: 'An unexpected error occurred. Please try again.' };
}
```

---

## 14. Recommended Folder Structure

```
summary-clone/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── firebase.js (if using Firebase)
│   │   │   └── db.js (if using MongoDB)
│   │   │
│   │   ├── controllers/
│   │   │   ├── ingestController.js
│   │   │   ├── meetingController.js
│   │   │   ├── insightsController.js
│   │   │   ├── exportController.js
│   │   │   ├── voiceController.js
│   │   │   └── searchController.js
│   │   │
│   │   ├── services/
│   │   │   ├── LLMService.js
│   │   │   ├── AutomationService.js
│   │   │   ├── VoiceService.js
│   │   │   ├── VisualEngine.js
│   │   │   ├── ExportService.js
│   │   │   └── SearchService.js
│   │   │
│   │   ├── repositories/
│   │   │   ├── meetingRepository.js
│   │   │   ├── minuteRepository.js
│   │   │   ├── insightRepository.js
│   │   │   └── visualRepository.js
│   │   │
│   │   ├── models/
│   │   │   ├── Meeting.js
│   │   │   ├── Minute.js
│   │   │   ├── Action.js
│   │   │   ├── Decision.js
│   │   │   ├── Visual.js
│   │   │   ├── AutomationLog.js
│   │   │   └── Workspace.js
│   │   │
│   │   ├── routes/
│   │   │   ├── ingest.routes.js
│   │   │   ├── meeting.routes.js
│   │   │   ├── insights.routes.js
│   │   │   ├── export.routes.js
│   │   │   ├── voice.routes.js
│   │   │   └── search.routes.js
│   │   │
│   │   ├── utils/
│   │   │   ├── transformers.js
│   │   │   ├── errorHandler.js
│   │   │   └── validators.js
│   │   │
│   │   └── app.js
│   │
│   ├── scripts/
│   │   └── seed-demo-data.js
│   │
│   ├── package.json
│   └── server.js
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── MeetingList/
│   │   │   ├── MeetingTimer/
│   │   │   ├── TranscriptView/
│   │   │   ├── Insights/
│   │   │   └── VisualIntelligence/
│   │   │
│   │   ├── context/
│   │   │   └── AppContext.js
│   │   │
│   │   ├── views/
│   │   │   ├── Dashboard/
│   │   │   ├── LiveMeeting/
│   │   │   ├── Insights/
│   │   │   └── MeetingsHistory/
│   │   │
│   │   ├── utils/
│   │   │   └── highlighting.ts
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── main.tsx
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── n8n/
│   └── workflows/
│       ├── email-summary.json
│       ├── schedule-meeting.json
│       └── create-ticket.json
│
└── README.md
```

---

## 15. MVP Summary

### Best MVP
**Feature Set**:
- Transcript ingestion via API
- Meeting CRUD operations
- LLM-powered summarization (Groq API)
- Action items and decisions extraction
- Real-time updates (Firestore listeners)
- Export to markdown

**Tech Stack**:
- Backend: Node.js + Express + MongoDB
- LLM: Groq API (Grok model)
- Real-time: Firestore onSnapshot
- Frontend: React + TypeScript + Vite

**Timeline**: 2 weeks

### v1.1 Milestone
**Add**:
- Audio upload with Whisper transcription
- n8n automation (email, calendar)
- Voice layer (ElevenLabs TTS)
- Notion export

**Timeline**: 4 weeks after MVP

---

## 16. Next Steps

1. **Review this architecture** and confirm it aligns with your vision
2. **Choose database**: MongoDB (MVP) vs Firebase (production)
3. **Set up LLM API**: Get Groq API key
4. **Create project structure**: Implement folder structure from Section 14
5. **Build Phase 1**: Implement core MVP features

### Questions to Confirm
- Do you want to use MongoDB or Firebase for the MVP?
- Do you have a Groq API key, or should I use demo mode?
- Should I start with the backend or frontend first?
- Do you want to keep the existing browser extension integration?
