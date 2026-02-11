export interface TranscriptSegment {
  id?: string;
  speaker: string;
  timestamp: string;
  text: string;
}

export interface Transcript {
  id: string; // filename
  title: string;
  headers: string[]; // Metadata lines (Date, Duration, etc.)
  segments: TranscriptSegment[];
  rawContent: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string; // The raw text extracted
  type: 'project_spec' | 'guideline' | 'persona_context' | 'other';
  fileName: string;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  description?: string; // Added for DB compatibility
  avatar?: string; // Added for DB compatibility
  role: string;
  company?: string;
  source?: 'ai' | 'real'; // 'ai' = Generated, 'real' = From Actual Interview
  sourceId?: string; // If real, the Interview ID
  background: string;
  psychographics: {
    motivations: string[];
    painPoints: string[];
    values: string[];
  };
  // New Deep Psychology Fields
  mbti?: string;
  socialRelationships?: string; // Influence and relationships
  linguisticTraits?: string; // Verbal habits and attitude
  emotionalNeeds?: {
    deficiencies: string[];
    desires: string[];
  };

  behavioral: {
    communicationStyle: string;
    decisionMakingProcess: string;
  };
  // New Enhanced Fields
  basis?: string; // Why this persona was created / distinct characteristics
  lifestyle?: string; // Daily patterns
  interviewGuide?: {
    checkPoints: string[]; // Things to verify with this user
    communicationTips: string[]; // How to talk to them
  };
  documents?: KnowledgeDocument[]; // Added context documents
  interviewIds?: string[]; // IDs of interviews linked to this persona
}

export type ProjectStatus = 'planning' | 'simulation' | 'execution' | 'completed';

export interface Project {
  id: string;
  title: string;
  description: string;
  goal: string;        // Project Purpose
  exitCriteria: string; // Definition of Done
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  order?: number;
  documents?: KnowledgeDocument[]; // Project-level knowledge (Specs, Guidelines)
  chatSessions?: ChatSession[]; // Strategic AI Chat History
}

export type ResearchMethodology = 'idp' | 'survey' | 'ut' | 'unknown';

export interface ResearchPlan {
  id: string;
  purpose: string;
  verificationGoals: string[];
  methodology: ResearchMethodology;
  recommendedMethodology?: string; // AI Reason
}

export interface Hypothesis {
  id: string;
  projectId: string;
  statement: string;
  tags: string[];
}

export interface DiscussionGuide {
  projectId: string;
  questions: string[];
}

// 6-Section Plan
export interface StudyPlan {
  background: string;     // 1. Why we are doing this
  purpose: string;        // 2. What we want to know (One sentence)
  target: string;         // 3. Who (Target Persona/Context)
  utilization: string;    // 4. How result will be used
  researchQuestions: string[]; // 5. Key questions (P1, P2...)
  methodology: {          // 6. Methodology
    type: ResearchMethodology;
    reason: string;
  };
  hypothesisVerifications?: Record<string, { // Key: Research Question Index
    status: 'supported' | 'refuted' | 'partial' | 'inconclusive' | 'pending';
    evidence: string;
  }>;
}


export interface WeeklyReport {
  id: string;
  createdAt: string;
  title: string;
  interviewIds: string[]; // List of interview IDs used
  content: string; // The markdown report
}

export interface GuideBlock {
  id: string;
  type: 'question' | 'script' | 'section'; // script = greeting, instruction, transition
  content: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  type: 'plan' | 'guide';
  summary: string; // e.g. "Modified Research Purpose", "Added 3 questions"
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: {
    role: 'user' | 'model';
    text: string;
    attachments?: {
      name: string;
      type: 'image' | 'file';
      url?: string; // If persisted
      data?: string; // Base64 for ephemeral/sending
      mimeType?: string;
    }[];
  }[];
  selectedContextIds?: string[]; // IDs of studies or documents selected as context
}

export interface ResearchStudy {
  id: string;
  projectId: string;
  title: string;
  description?: string; // Added for DB compatibility
  createdAt: string;
  updatedAt: string;
  status: 'planning' | 'recruiting' | 'fieldwork' | 'analysis' | 'done';
  plan: StudyPlan;
  sessions: RealInterview[]; // Actual interviews
  simulationSessions?: SimulationSession[]; // AI Simulation sessions
  chatSessions?: ChatSession[]; // AI Helper Chat History
  participantIds: string[]; // IDs of Personas cast for this study
  discussionGuide: GuideBlock[]; // The list of questions for the interview
  changeLogs: ChangeLogEntry[];
  reports?: WeeklyReport[];
}

export interface StructuredInsight {
  id: string;
  sourceSegmentId?: string; // Reference to specific part of transcript for Grounding
  type: 'fact' | 'insight' | 'action';
  source?: 'ai' | 'user'; // Distinguish between AI-generated and User-added
  content: string;
  meaning?: string;       // For 'Why'
  recommendation?: string; // For 'Next Step'
  researchQuestion?: string; // The specific research question this insight answers
  evidence?: string; // Added for DB
  importance?: string; // Added for DB
}

export interface SimulationSession {
  id: string;
  personaId: string;
  createdAt: string;
  messages: {
    id: string;
    role: 'interviewer' | 'persona';
    text: string;
  }[];
  insights?: string; // Kept for backward compatibility (markdown fallback)
  summary?: string;
  structuredData?: StructuredInsight[];
}

export interface RealInterview {
  id: string;
  projectId: string; // Keep for query convenience
  studyId?: string; // Link to specific study
  title: string;
  transcriptId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  structuredData: StructuredInsight[];
  summary?: string; // High-level summary of the interview
  interviewerFeedback?: string; // Critique of the interviewer's performance
  participantId?: string; // Link to specific persona if applicable
  participants?: any; // Added for DB compatibility (jsonb)
  content?: string; // Transcript text
  segments?: TranscriptSegment[]; // Structured Transcript Data
  audioUrl?: string; // URL of the audio recording
  videoUrl?: string; // For uploaded videos or Loom links
  duration?: number; // Duration in seconds
  speakers?: { id: string; name: string; role: 'interviewer' | 'participant' }[];
  note?: Record<string, string>; // Live interview notes (BlockId -> Content)
  hypothesisReviews?: Record<string, { // Key: Research Question Index (e.g. "0", "1")
    status: 'supported' | 'refuted' | 'partial' | 'inconclusive' | 'pending';
    comment: string;
  }>;
}

// Duplicate Project interface removed. Use the one defined above.

export interface ProjectData {
  project: Project;
  studies: ResearchStudy[];
  personas: Persona[]; // The Project-Level Persona Pool
}
