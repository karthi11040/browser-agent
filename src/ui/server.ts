import 'dotenv/config';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { BrowserManager } from '../browser/BrowserManager.js';
import { OpenRouterClient } from '../llm/OpenRouterClient.js';
import { SecurityPolicy } from '../security/SecurityPolicy.js';
import { AgentLoop, type AgentStepRecord, type AgentRunResult } from '../agent/AgentLoop.js';
import { getDashboardHtml } from './dashboard.js';
import {
  saveChatSession,
  getChatSession,
  listChatSessions,
  initializeDefaultChat,
  type ChatSession,
} from './chatStorage.js';

export interface ServerOptions {
  port?: number;
  openBrowser?: boolean;
}

export function startDashboardServer(options: ServerOptions = {}): http.Server {
  const port = options.port || 3000;
  const openBrowser = options.openBrowser ?? true;

  initializeDefaultChat();

  let activeAgentLoop: AgentLoop | null = null;
  let activeBrowserManager: BrowserManager | null = null;
  let currentRunningSession: ChatSession | null = null;
  let isRunning = false;
  let liveCaptureInterval: ReturnType<typeof setInterval> | null = null;
  const sseClients: http.ServerResponse[] = [];

  function startLiveCapture() {
    if (liveCaptureInterval) return;
    liveCaptureInterval = setInterval(async () => {
      if (!activeBrowserManager || !isRunning) return;
      const framePath = await activeBrowserManager.captureFrameJpeg('live').catch(() => null);
      if (framePath) {
        broadcastSSE('frame', {
          screenshotUrl: `/screenshots/${path.basename(framePath)}`,
        });
      }
    }, 800);
  }

  function stopLiveCapture() {
    if (liveCaptureInterval) {
      clearInterval(liveCaptureInterval);
      liveCaptureInterval = null;
    }
  }

  function broadcastSSE(eventType: string, data: any) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        // client disconnected
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://localhost:${port}`);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. SSE Stream
    if (pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`event: status\ndata: ${JSON.stringify({ isRunning })}\n\n`);
      sseClients.push(res);

      req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
      });
      return;
    }

    // 2. Serve Screenshots (PNG and JPEG)
    if (pathname.startsWith('/screenshots/')) {
      const filename = path.basename(pathname);
      const filePath = path.resolve(process.cwd(), 'screenshots', filename);
      if (fs.existsSync(filePath)) {
        const contentType = filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    // 3. API: Get Models
    if (pathname === '/api/models' && req.method === 'GET') {
      const models = [
        { id: 'deepseek/deepseek-v4-flash-0731:free', name: 'DeepSeek V4 Flash (Free - Default)', free: true },
        { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B (Free)', free: true },
        { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4 26B (Free)', free: true },
        { id: 'nex-agi/nex-n2.5-mini:free', name: 'Nex AGI N2.5 Mini (Free)', free: true },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', free: false },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', free: false },
        { id: 'mistralai/mistral-large', name: 'Mistral Large', free: false },
        { id: 'microsoft/wizardlm-2-8x22b', name: 'WizardLM-2 8x22B', free: false },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', free: false },
        { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', free: false },
        { id: 'anthropic/claude-sonnet-4', name: 'Anthropic Claude Sonnet 4', free: false },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models, defaultModel: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731:free' }));
      return;
    }

    // 4. API: List Saved Chats
    if (pathname === '/api/chats' && req.method === 'GET') {
      const chats = listChatSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ chats }));
      return;
    }

    // 5. API: Get Single Chat Session by ID
    if (pathname.startsWith('/api/chats/') && req.method === 'GET') {
      const chatId = pathname.replace('/api/chats/', '').trim();
      const session = getChatSession(chatId);
      if (session) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(session));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Chat not found' }));
      }
      return;
    }

    // 6. API: Stop Run
    if (pathname === '/api/stop' && req.method === 'POST') {
      if (activeBrowserManager) {
        await activeBrowserManager.close().catch(() => {});
      }
      isRunning = false;
      if (currentRunningSession) {
        currentRunningSession.status = 'stopped';
        currentRunningSession.updatedAt = new Date().toISOString();
        saveChatSession(currentRunningSession);
      }
      broadcastSSE('status', { isRunning: false, message: 'Execution stopped by user.' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Agent execution halted.' }));
      return;
    }

    // 5. API: Run Agent
    if (pathname === '/api/run' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          if (isRunning) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Another agent task is currently running.' }));
            return;
          }

          const params = JSON.parse(body || '{}');
          const goal = params.goal?.trim();
          if (!goal) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Goal prompt is required.' }));
            return;
          }

          const initialUrl = params.url?.trim() || undefined;
          const model = params.model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731:free';
          const headless = params.headless !== undefined ? params.headless : (process.env.HEADLESS === 'false' ? false : true);
          const maxSteps = params.maxSteps ? parseInt(params.maxSteps, 10) : 25;

          const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY;
          if (!apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured.' }));
            return;
          }

          const chatId = params.chatId || randomUUID();

          const currentSession: ChatSession = {
            id: chatId,
            goal,
            initialUrl,
            model,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'running',
            steps: [],
          };
          saveChatSession(currentSession);
          currentRunningSession = currentSession;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, chatId, message: 'Agent run initiated.' }));

          // Begin background execution
          isRunning = true;
          broadcastSSE('start', { chatId, goal, initialUrl, model, headless });

          const securityPolicy = new SecurityPolicy({
            allowedDomains: params.allowedDomains || '*',
            maskSensitiveData: true,
          });

          const customSlowMo = params.slowMo !== undefined ? parseInt(params.slowMo, 10) : (headless ? 0 : (process.env.SLOW_MO_MS ? parseInt(process.env.SLOW_MO_MS, 10) : 50));

          const browserManager = new BrowserManager({
            headless,
            slowMo: customSlowMo,
          });
          activeBrowserManager = browserManager;
          startLiveCapture();

          const openRouterClient = new OpenRouterClient({
            apiKey,
            model,
          });

          const agent = new AgentLoop(browserManager, openRouterClient, securityPolicy);
          activeAgentLoop = agent;

          try {
            const result: AgentRunResult = await agent.run({
              goal,
              initialUrl,
              maxSteps,
              takeScreenshots: true,
              onFrame: (frame) => {
                const screenshotUrl = `/screenshots/${path.basename(frame.screenshotPath)}`;
                broadcastSSE('frame', {
                  screenshotUrl,
                  url: frame.url,
                  title: frame.title,
                });
              },
              onStep: (step: AgentStepRecord) => {
                const snapshot = agent.getSnapshotEngine().getLatestSnapshot();
                const screenshotUrl = step.screenshotPath ? `/screenshots/${path.basename(step.screenshotPath)}` : undefined;

                currentSession.steps.push(step);
                currentSession.updatedAt = new Date().toISOString();
                if (snapshot?.treeText) {
                  currentSession.snapshotTree = snapshot.treeText;
                }
                saveChatSession(currentSession);

                broadcastSSE('step', {
                  ...step,
                  screenshotUrl,
                  snapshotTree: snapshot?.treeText,
                });
              },
            });

            currentSession.status = 'completed';
            currentSession.finalAnswer = result.finalAnswer;
            currentSession.summary = result.summary;
            currentSession.totalTokens = result.totalTokens;
            currentSession.durationMs = result.durationMs;
            currentSession.updatedAt = new Date().toISOString();
            saveChatSession(currentSession);

            broadcastSSE('done', { ...result, chatId });
          } catch (err: any) {
            currentSession.status = 'failed';
            currentSession.error = err?.message || String(err);
            currentSession.updatedAt = new Date().toISOString();
            saveChatSession(currentSession);

            broadcastSSE('error', { message: err?.message || String(err), chatId });
          } finally {
            stopLiveCapture();
            isRunning = false;
            await browserManager.close().catch(() => {});
            activeBrowserManager = null;
            activeAgentLoop = null;
            currentRunningSession = null;
          }
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e?.message || 'Server error' }));
        }
      });
      return;
    }

    // 7. Serve Frontend Dashboard HTML (Root & /chat/agent/:id)
    if (pathname === '/' || pathname === '/index.html' || pathname.startsWith('/chat/agent/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHtml());
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(chalk.bold.cyan(`\n🌐 BrowserAgent Web Dashboard running at: ${chalk.underline.white(url)}`));
    console.log(chalk.gray(`Active Model: ${chalk.magenta(process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731:free')}\n`));

    if (openBrowser) {
      const openCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      exec(openCmd, () => {});
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`\n✖ Port ${port} is currently in use. Specify another port using --port <port> or wait for the port to release.\n`));
    } else {
      console.error(chalk.red(`\n✖ Server error: ${err.message}\n`));
    }
  });

  return server;
}
