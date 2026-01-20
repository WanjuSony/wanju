export interface TranscriptSegment {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface Transcript {
  id: string; // filename
  title: string;
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
  role: string;
  company?: string;
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
}

export type ProjectStatus = 'planning' | 'simulation' | 'execution' | 'done';

export interface Project {
  id: string;
  title: string;
  description: string;
  goal: string;        // Project Purpose
  exitCriteria: string; // Definition of Done
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  documents?: KnowledgeDocument[]; // Project-level knowledge (Specs, Guidelines)
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
}

export interface ResearchStudy {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'planning' | 'recruiting' | 'fieldwork' | 'analysis' | 'done';
  plan: StudyPlan;
  sessions: RealInterview[]; // Actual interviews
  simulationSessions?: SimulationSession[]; // AI Simulation sessions
  participantIds: string[]; // IDs of Personas cast for this study
  discussionGuide: GuideBlock[]; // The list of questions for the interview
  changeLogs: ChangeLogEntry[];
}

export interface GuideBlock {
  id: string;
  type: 'question' | 'script'; // script = greeting, instruction, transition
  content: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  type: 'plan' | 'guide';
  summary: string; // e.g. "Modified Research Purpose", "Added 3 questions"
}

export interface StructuredInsight {
  id: string;
  sourceSegmentId?: string; // Reference to specific part of transcript for Grounding
  type: 'fact' | 'insight' | 'action';
  content: string;
  meaning?: string;       // For 'Why'
  recommendation?: string; // For 'Next Step'
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
  insights?: string; // AI generated analysis based on study goals
}

export interface RealInterview {
  id: string;
  projectId: string; // Keep for query convenience
  studyId?: string; // Link to specific study
  title: string;
  transcriptId: string;
  date: string;
  structuredData: StructuredInsight[];
  participantId?: string; // Link to specific persona if applicable
  content?: string; // Full transcript content
}

// Duplicate Project interface removed. Use the one defined above.

export interface ProjectData {
  project: Project;
  studies: ResearchStudy[];
  personas: Persona[]; // The Project-Level Persona Pool
}
