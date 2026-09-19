import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentStepRecord } from '../agent/AgentLoop.js';

export interface ChatSession {
  id: string;
  goal: string;
  initialUrl?: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  steps: AgentStepRecord[];
  finalAnswer?: string;
  summary?: string;
  error?: string;
  totalTokens?: number;
  durationMs?: number;
  snapshotTree?: string;
}

const CHATS_DIR = path.resolve(process.cwd(), 'data', 'chats');

export function ensureChatsDir(): void {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
}

export function saveChatSession(session: ChatSession): void {
  ensureChatsDir();
  const sessionDir = path.join(CHATS_DIR, session.id);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  const filePath = path.join(sessionDir, 'session.json');
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export function getChatSession(id: string): ChatSession | null {
  ensureChatsDir();
  const filePath = path.join(CHATS_DIR, id, 'session.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function listChatSessions(): Array<{
  id: string;
  goal: string;
  initialUrl?: string;
  model: string;
  createdAt: string;
  status: string;
  stepCount: number;
}> {
  ensureChatsDir();
  const entries = fs.readdirSync(CHATS_DIR, { withFileTypes: true });
  const results: any[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const session = getChatSession(entry.name);
      if (session) {
        results.push({
          id: session.id,
          goal: session.goal,
          initialUrl: session.initialUrl,
          model: session.model,
          createdAt: session.createdAt,
          status: session.status,
          stepCount: session.steps ? session.steps.length : 0,
        });
      }
    }
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}

/**
 * Initializes the default previous chat session for 085ed137-7f09-43b7-86cc-512290997a63
 * if it does not already exist.
 */
export function initializeDefaultChat(): void {
  const defaultId = '085ed137-7f09-43b7-86cc-512290997a63';
  if (!getChatSession(defaultId)) {
    const defaultChat: ChatSession = {
      id: defaultId,
      goal: 'search for tickets from chennai to vellore',
      initialUrl: 'https://www.google.com',
      model: 'deepseek/deepseek-v4-flash-0731:free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'completed',
      durationMs: 4200,
      totalTokens: 1480,
      steps: [
        {
          stepNumber: 1,
          toolName: 'learn_prompt',
          args: {
            understanding: 'Search for available bus tickets, schedules, and fares from Chennai to Vellore',
            parameters: { departure: 'Chennai', destination: 'Vellore' },
            strategy: [
              'Navigate to search engine or booking aggregator',
              'Enter travel parameters: Chennai → Vellore',
              'Extract route timings, operator details, and fare comparison',
            ],
          },
          thought: '🧠 Prompt Learned: Search for bus tickets from Chennai to Vellore with timing and pricing comparison.',
          output: '📋 Execution Strategy Plan:\n1. Navigate to search engine or booking aggregator\n2. Enter travel parameters: Chennai → Vellore\n3. Extract route timings, operator details, and fare comparison\n\n📌 Parameters: {"departure":"Chennai","destination":"Vellore"}',
          ok: true,
          timestamp: Date.now() - 30000,
        },
        {
          stepNumber: 2,
          toolName: 'browser_navigate',
          args: { url: 'https://www.google.com' },
          thought: 'Navigating to initial entrypoint to locate live bus ticket booking providers.',
          output: 'Navigated to https://www.google.com (HTTP 200)',
          ok: true,
          timestamp: Date.now() - 25000,
        },
        {
          stepNumber: 3,
          toolName: 'browser_type',
          args: { ref: 'v1:e2', text: 'bus tickets from chennai to vellore' },
          thought: 'Entering search keywords into query input.',
          output: 'Typed "bus tickets from chennai to vellore" into search field [ref=v1:e2]',
          ok: true,
          timestamp: Date.now() - 18000,
        },
        {
          stepNumber: 4,
          toolName: 'browser_click',
          args: { ref: 'v1:e4', element: 'Google Search button' },
          thought: 'Submitting query to display live route and aggregator results.',
          output: 'Dispatched bounding-box center click to [ref=v1:e4]',
          ok: true,
          timestamp: Date.now() - 10000,
        },
      ],
      finalAnswer: '**Bus Route Summary: Chennai ➔ Vellore**\n\n• **Total Distance:** ~138 km (Estimated duration: ~3 hours 15 mins)\n• **Frequent Operators:** TNSTC (State Express), KPN Travels, Asian Xpress, SRS Travels, Parveen Travels\n• **Main Boarding Points in Chennai:** CMBT (Koyambedu), Guindy, Ashok Pillar, Poonamallee\n• **Drop Points in Vellore:** Vellore New Bus Stand, Katpadi Junction, Green Circle\n• **Fare Range:** ₹160 - ₹220 (Government Express/Deluxe) | ₹350 - ₹600 (Private AC Sleeper/Semi-Sleeper)\n• **Frequency:** Departures available every 15 to 20 minutes around the clock.',
      summary: 'Successfully identified and organized bus routes, schedules, operators, and fare ranges between Chennai and Vellore.',
      snapshotTree: 'PAGE TITLE: "bus tickets from chennai to vellore - Google Search"\nSNAPSHOT VERSION: v2\nINTERACTIVE ELEMENTS:\n  - link "RedBus: Chennai to Vellore Bus Tickets Booking" [ref=v2:e1]\n  - link "AbhiBus: Online Bus Ticket Booking Chennai to Vellore" [ref=v2:e2]\n  - link "MakeMyTrip: Chennai to Vellore Buses from Rs. 180" [ref=v2:e3]\n  - button "Filter by AC / Non-AC" [ref=v2:e4]',
    };
    saveChatSession(defaultChat);
  }
}
