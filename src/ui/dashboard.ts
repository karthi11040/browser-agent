import * as path from 'node:path';

export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BrowserAgent — Autonomous Web Agent Studio</title>
  <link rel="icon" type="image/png" href="/logo.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            gpt: {
              dark: '#0d0d0e',
              darker: '#080809',
              card: '#141416',
              cardHover: '#1c1c20',
              border: 'rgba(255, 255, 255, 0.08)',
              text: '#ededed',
              muted: '#8e8e93',
              accent: '#ffffff',
              accentHover: '#f4f4f5',
            },
            light: {
              bg: '#FFFFFF',
              sidebar: '#F8FAFC',
              card: '#FFFFFF',
              cardHover: '#F1F5F9',
              border: '#E2E8F0',
              text: '#0F172A',
              muted: '#64748B',
            }
          }
        }
      }
    }
  </script>
  <style>
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.2); border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(150, 150, 150, 0.35); }

    html.dark { color-scheme: dark; background-color: #0d0d0e !important; color: #ededed !important; }
    html.dark body { background-color: #0d0d0e !important; color: #ededed !important; }

    html.dark aside, html.dark #sidebar { background-color: #080809 !important; border-color: rgba(255, 255, 255, 0.07) !important; }
    html.dark header { background-color: rgba(13, 13, 14, 0.85) !important; border-color: rgba(255, 255, 255, 0.07) !important; }
    html.dark #chatPane { background-color: #0d0d0e !important; border-color: rgba(255, 255, 255, 0.07) !important; }
    html.dark #browserPane { background-color: #09090b !important; border-color: rgba(255, 255, 255, 0.07) !important; }

    /* Exclude view-btn and canvas-tab from blanket dark background overrides so active states stand out */
    html.dark .bg-light-card:not(.view-btn):not(.canvas-tab),
    html.dark .bg-light-bg:not(.view-btn):not(.canvas-tab),
    html.dark [class*="dark:bg-gpt-card"]:not(.view-btn):not(.canvas-tab) {
      background-color: #141416 !important; border-color: rgba(255, 255, 255, 0.07) !important;
    }
    html.dark h1, html.dark h2, html.dark h3, html.dark strong, html.dark .font-semibold { color: #fafafa !important; }
    html.dark [class*="text-light-muted"], html.dark [class*="dark:text-gpt-muted"] { color: #88888e !important; }
    html.dark [class*="border-light-border"], html.dark [class*="dark:border-gpt-border"] { border-color: rgba(255, 255, 255, 0.07) !important; }

    /* Crisp Light and Dark styling for step output & strategy */
    .step-desc-full {
      font-size: 0.82rem;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
      background: #f8fafc;
      color: #0f172a;
      padding: 12px 16px;
      border-radius: 12px;
      margin-top: 6px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    html.dark .step-desc-full {
      background: rgba(255, 255, 255, 0.04) !important;
      color: #f1f5f9 !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: none;
    }

    .learn-badge {
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.25);
    }

    /* Active view mode button styling in light and dark (black screen) */
    .view-btn.active {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
    }
    html.dark .view-btn.active {
      background-color: rgba(16, 185, 129, 0.2) !important;
      color: #34d399 !important;
      border: 1px solid rgba(16, 185, 129, 0.45) !important;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.28) !important;
    }

    /* Active canvas tab styling */
    .canvas-tab.active {
      background-color: #ffffff !important;
      color: #0f172a !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
    }
    html.dark .canvas-tab.active {
      background-color: #27272a !important;
      color: #34d399 !important;
      border: 1px solid rgba(16, 185, 129, 0.3) !important;
    }

    /* Smooth animated transitions between View Modes */
    #chatPane, #browserPane {
      transition: flex-basis 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out;
    }
  </style>
</head>
<body class="bg-light-bg dark:bg-gpt-dark text-light-text dark:text-gpt-text font-sans antialiased h-screen overflow-hidden flex transition-colors duration-200">

  <!-- SIDEBAR -->
  <aside id="sidebar" class="w-64 flex-shrink-0 bg-light-sidebar dark:bg-gpt-darker border-r border-light-border dark:border-gpt-border flex flex-col justify-between transition-all duration-300 z-30 select-none">
    <div class="p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between px-2 py-1.5">
        <div class="flex items-center gap-2.5">
          <img src="/logo.png" alt="BrowserAgent Logo" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/25 flex-shrink-0">
          <div>
            <div class="font-semibold text-sm tracking-tight flex items-center gap-1.5">
              BrowserAgent
              <span class="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400">DeepSeek</span>
            </div>
            <div class="text-[11px] text-light-muted dark:text-gpt-muted">Autonomous Operator</div>
          </div>
        </div>
        <button type="button" id="collapseSidebarBtn" onclick="window.toggleSidebar(false)" class="p-1.5 rounded-lg text-light-muted dark:text-gpt-muted hover:bg-light-card dark:hover:bg-gpt-card transition-colors cursor-pointer" title="Close sidebar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </button>
      </div>

      <button type="button" id="newTaskBtn" onclick="window.prepareNewTask()" class="mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-light-border dark:border-gpt-border bg-light-bg dark:bg-gpt-card hover:bg-light-card dark:hover:bg-gpt-cardHover text-sm font-medium transition-all shadow-sm group cursor-pointer">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>New Browsing Task</span>
        </div>
        <span class="text-[10px] font-mono text-light-muted dark:text-gpt-muted px-1.5 py-0.5 rounded bg-light-card dark:bg-gpt-darker border border-light-border dark:border-gpt-border">⌘K</span>
      </button>
    </div>

    <!-- History List -->
    <div class="flex-1 overflow-y-auto px-2 py-1 space-y-4 text-xs">
      <div>
        <div class="px-3 py-1.5 font-semibold text-[11px] text-light-muted dark:text-gpt-muted uppercase tracking-wider">Recent Tasks</div>
        <div class="space-y-0.5" id="historyList">
          <button type="button" onclick="window.fillChip('search for tickets from chennai to vellore', 'https://www.google.com')" class="history-item cursor-pointer w-full flex items-center justify-between px-3 py-2 rounded-lg text-left bg-light-card/80 dark:bg-gpt-card font-medium text-emerald-600 dark:text-emerald-400 group">
            <div class="flex items-center gap-2 truncate">
              <span class="text-xs">🚌</span>
              <span class="truncate">Chennai to Vellore Bus Tickets</span>
            </div>
            <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
          </button>
          <button type="button" onclick="window.fillChip('Search Wikipedia for quantum computing and summarize key concepts', 'https://en.wikipedia.org/wiki/Quantum_computing')" class="history-item cursor-pointer w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-light-muted dark:text-gpt-muted hover:bg-light-card dark:hover:bg-gpt-card hover:text-light-text dark:hover:text-gpt-text transition-colors">
            <div class="flex items-center gap-2 truncate">
              <span class="text-xs">🔬</span>
              <span class="truncate">Wikipedia Quantum Computing</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Status Footer -->
    <div class="p-3 border-t border-light-border dark:border-gpt-border space-y-2">
      <div class="px-3 py-2 rounded-xl bg-light-card dark:bg-gpt-card flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs">
          <span id="agentStatusPulse" class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span id="agentStatusLabel" class="font-medium">Ready</span>
        </div>
        <span class="text-[11px] font-mono text-light-muted dark:text-gpt-muted">Web-v2</span>
      </div>
    </div>
  </aside>

  <!-- MAIN AREA -->
  <main class="flex-1 flex flex-col h-full overflow-hidden min-w-0">
    <!-- Header -->
    <header class="h-14 flex-shrink-0 border-b border-light-border dark:border-gpt-border px-4 flex items-center justify-between bg-light-bg/80 dark:bg-gpt-dark/80 backdrop-blur-md z-20">
      <div class="flex items-center gap-3">
        <button type="button" id="expandSidebarBtn" onclick="window.toggleSidebar(true)" class="hidden p-1.5 rounded-lg text-light-muted dark:text-gpt-muted hover:bg-light-card dark:hover:bg-gpt-card transition-colors cursor-pointer" title="Open sidebar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>

        <!-- Model Switcher -->
        <div class="relative">
          <button type="button" id="modelPickerBtn" onclick="window.toggleModelDropdown(event)" class="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-light-card dark:hover:bg-gpt-card text-sm font-semibold transition-colors border border-transparent hover:border-light-border dark:hover:border-gpt-border cursor-pointer">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span id="currentModelText">DeepSeek V4 Flash (0731)</span>
            </span>
            <svg class="w-4 h-4 text-light-muted dark:text-gpt-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          
          <div id="modelDropdown" class="hidden absolute left-0 top-full mt-1.5 w-72 max-h-96 overflow-y-auto rounded-2xl bg-light-bg dark:bg-gpt-card border border-light-border dark:border-gpt-border shadow-xl p-1.5 z-50 text-xs space-y-1">
            <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-light-muted dark:text-gpt-muted">Select Model</div>
            <div id="modelOptionsContainer" class="space-y-1"></div>
          </div>
        </div>
      </div>

      <!-- View Mode Pills -->
      <div class="hidden md:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gpt-card border border-slate-200 dark:border-gpt-border text-xs gap-1">
        <button type="button" id="viewSplitBtn" onclick="window.setViewMode('split')" class="view-btn active px-3 py-1.5 rounded-lg font-medium transition-all duration-200 cursor-pointer">Split View</button>
        <button type="button" id="viewBrowserBtn" onclick="window.setViewMode('browser')" class="view-btn px-3 py-1.5 rounded-lg font-medium text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text transition-all duration-200 cursor-pointer border border-transparent">Browser Focus</button>
        <button type="button" id="viewChatBtn" onclick="window.setViewMode('chat')" class="view-btn px-3 py-1.5 rounded-lg font-medium text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text transition-all duration-200 cursor-pointer border border-transparent">Agent Chat</button>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-light-card/80 dark:bg-gpt-card border border-light-border dark:border-gpt-border text-xs font-mono">
          <span class="flex items-center gap-1 text-light-muted dark:text-gpt-muted">
            <span class="text-emerald-500 font-bold">#</span>
            <span id="metricSteps">0</span> steps
          </span>
          <span class="text-light-border dark:text-gpt-border">|</span>
          <span class="flex items-center gap-1 text-light-muted dark:text-gpt-muted">
            <span id="metricElapsed">0.0s</span>
          </span>
        </div>

        <button type="button" id="themeToggleBtn" onclick="window.toggleTheme()" class="p-2 rounded-xl text-light-muted dark:text-gpt-muted hover:bg-light-card dark:hover:bg-gpt-card hover:text-light-text dark:hover:text-gpt-text transition-colors cursor-pointer" title="Toggle Theme">
          <svg class="w-4 h-4 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <svg class="w-4 h-4 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        </button>
      </div>
    </header>

    <!-- Workspace -->
    <div id="splitWorkspace" class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
      
      <!-- LEFT PANE: Chat & Actions -->
      <section id="chatPane" class="w-full lg:w-1/2 flex flex-col h-full border-r border-light-border dark:border-gpt-border bg-light-bg dark:bg-gpt-dark relative min-w-0 transition-all duration-300 ease-in-out">
        
        <div id="chatFeed" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col items-center">
          <div id="chatFeedInner" class="max-w-3xl mx-auto w-full space-y-6 transition-all duration-300">
            <!-- Welcome Prompt -->
            <div class="flex items-start gap-3.5 w-full">
              <img src="/logo.png" alt="BrowserAgent Logo" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/20 flex-shrink-0">
              <div class="flex-1 space-y-2 min-w-0">
                <div class="font-medium text-xs text-light-muted dark:text-gpt-muted">BrowserAgent Assistant</div>
                <div class="text-sm leading-relaxed p-4 rounded-2xl bg-light-card dark:bg-gpt-card text-light-text dark:text-gpt-text shadow-sm border border-light-border dark:border-gpt-border">
                  Welcome to <strong>BrowserAgent Studio</strong>. Enter any web task prompt below. The model will analyze & learn your prompt strategy first, then navigate the web autonomously.
                </div>
              </div>
            </div>

            <div id="dynamicChatSteps" class="space-y-4 w-full"></div>
          </div>
        </div>

        <!-- Input Bar Container with High Z-Index & Pointer-Events -->
        <div class="p-4 bg-light-bg dark:bg-gpt-dark border-t border-light-border dark:border-gpt-border relative z-30 flex-shrink-0">
          <div id="inputInner" class="max-w-3xl mx-auto space-y-2 relative z-30 transition-all duration-300">
            
            <!-- Quick Action Chips -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar relative z-30">
              <button type="button" class="quick-chip cursor-pointer relative z-30 whitespace-nowrap px-3 py-1.5 rounded-full border border-light-border dark:border-gpt-border bg-light-card dark:bg-gpt-card hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 text-light-muted dark:text-gpt-muted hover:text-emerald-400" onclick="window.fillChip('search for tickets from chennai to vellore', 'https://www.google.com')">
                <span>🚌</span> Chennai to Vellore Tickets
              </button>
              <button type="button" class="quick-chip cursor-pointer relative z-30 whitespace-nowrap px-3 py-1.5 rounded-full border border-light-border dark:border-gpt-border bg-light-card dark:bg-gpt-card hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 text-light-muted dark:text-gpt-muted hover:text-emerald-400" onclick="window.fillChip('Search Wikipedia for quantum computing and summarize key concepts', 'https://en.wikipedia.org/wiki/Quantum_computing')">
                <span>🔬</span> Quantum Computing Wiki
              </button>
            </div>

            <!-- Input Box Container -->
            <div class="relative z-30 rounded-[26px] border border-light-border dark:border-gpt-border bg-light-card dark:bg-gpt-card shadow-lg p-2 transition-all focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30">
              
              <div id="urlInputContainer" class="hidden px-3 pt-1 pb-2 flex items-center gap-2 border-b border-light-border/60 dark:border-gpt-border/50 relative z-30">
                <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">🌐 START URL:</span>
                <input id="startUrlInput" type="text" placeholder="https://..." class="flex-1 bg-transparent text-xs font-mono focus:outline-none text-light-text dark:text-gpt-text relative z-30">
                <button type="button" id="closeUrlInputBtn" onclick="window.toggleUrlContainer(false)" class="text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text relative z-30">✕</button>
              </div>

              <div class="flex items-end gap-2 px-2 pt-1 pb-1 relative z-30">
                <button type="button" id="toggleUrlBtn" onclick="window.toggleUrlContainer()" class="p-2 rounded-full text-light-muted dark:text-gpt-muted hover:bg-light-bg dark:hover:bg-gpt-cardHover transition-colors flex-shrink-0 relative z-30 cursor-pointer" title="Attach Start URL">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                </button>

                <textarea id="taskPromptInput" rows="2" placeholder="Instruct the agent to search, navigate, or summarize..." class="w-full resize-none bg-transparent py-1.5 text-sm focus:outline-none text-light-text dark:text-gpt-text placeholder:text-light-muted dark:placeholder:text-gpt-muted max-h-36 overflow-y-auto leading-relaxed relative z-30 cursor-text pointer-events-auto"></textarea>

                <div class="flex items-center gap-1 flex-shrink-0 relative z-30">
                  <button type="button" id="runAgentBtn" onclick="window.executeTaskRun()" class="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-all shadow-md cursor-pointer relative z-30" title="Run Agent">
                    <svg id="runIcon" class="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    <svg id="stopIcon" class="w-4 h-4 hidden" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- RIGHT PANE: Live Browser Canvas & Result Tabs -->
      <section id="browserPane" class="w-full lg:w-1/2 flex flex-col h-full bg-light-card/40 dark:bg-gpt-darker relative overflow-hidden min-w-0">
        
        <!-- Browser Chrome -->
        <div class="h-12 border-b border-light-border dark:border-gpt-border bg-light-bg/95 dark:bg-gpt-dark/95 px-3 flex items-center justify-between gap-3 z-20">
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 mr-1">
              <span class="w-3 h-3 rounded-full bg-[#FF5F56] inline-block"></span>
              <span class="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block"></span>
              <span class="w-3 h-3 rounded-full bg-[#27C93F] inline-block"></span>
            </div>
          </div>

          <!-- Address Bar -->
          <div class="flex-1 max-w-lg mx-auto">
            <div class="flex items-center justify-between px-3 py-1 rounded-xl bg-light-card dark:bg-gpt-card border border-light-border dark:border-gpt-border text-xs">
              <div class="flex items-center gap-2 truncate">
                <span class="text-emerald-500 font-bold">🔒</span>
                <span id="browserUrlDisplay" class="font-mono text-[11px] truncate text-light-text dark:text-gpt-text">about:blank</span>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <span id="livePulseDot" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span id="liveStatusText" class="text-[10px] font-mono text-light-muted dark:text-gpt-muted">800ms Feed</span>
              </div>
            </div>
          </div>

          <!-- Canvas View Mode Tabs -->
          <div class="flex items-center gap-1">
            <div class="flex items-center p-0.5 rounded-lg bg-light-card dark:bg-gpt-card text-xs">
              <button type="button" id="tabLiveBtn" onclick="window.switchCanvasTab('live')" class="canvas-tab px-2.5 py-1 rounded-md font-medium text-[11px] bg-light-bg dark:bg-gpt-darker shadow-sm text-light-text dark:text-gpt-text cursor-pointer">🌐 Live Web</button>
              <button type="button" id="tabResultBtn" onclick="window.switchCanvasTab('result')" class="canvas-tab px-2.5 py-1 rounded-md font-medium text-[11px] text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text cursor-pointer">✨ Final Result</button>
              <button type="button" id="tabDomBtn" onclick="window.switchCanvasTab('dom')" class="canvas-tab px-2.5 py-1 rounded-md font-medium text-[11px] text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text cursor-pointer">DOM</button>
              <button type="button" id="tabDataBtn" onclick="window.switchCanvasTab('data')" class="canvas-tab px-2.5 py-1 rounded-md font-medium text-[11px] text-light-muted dark:text-gpt-muted hover:text-light-text dark:hover:text-gpt-text cursor-pointer">Data</button>
            </div>
          </div>
        </div>

        <!-- Canvas Viewport -->
        <div class="flex-1 overflow-auto relative p-4 bg-zinc-900/10 dark:bg-black/30 flex items-center justify-center">
          
          <!-- TAB 1: Live Interactive Browser Screen -->
          <div id="viewLiveTab" class="w-full h-full max-w-4xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative">
            <div id="browserPlaceholder" class="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-zinc-500">
              <span class="text-4xl opacity-40">🌐</span>
              <strong class="text-sm font-semibold">Live Browser Viewport</strong>
              <p class="text-xs max-w-xs leading-relaxed">Start an agent task to stream the live browser screen. Updates every ~800ms.</p>
            </div>
            <img id="realLiveFrame" src="" alt="Live Browser View" class="w-full h-full object-contain hidden">
          </div>

          <!-- TAB 2: Final Result Card View -->
          <div id="viewResultTab" class="hidden w-full h-full max-w-4xl bg-light-bg dark:bg-gpt-dark text-light-text dark:text-gpt-text rounded-xl p-6 overflow-auto shadow-2xl border border-light-border dark:border-gpt-border flex flex-col gap-4">
            <div class="flex items-center justify-between pb-3 border-b border-light-border dark:border-gpt-border">
              <div>
                <span id="resBadge" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  ✅ Task Completed Successfully
                </span>
                <h2 id="resGoalTitle" class="text-base font-bold mt-2">No Task Executed Yet</h2>
                <div id="resMetaInfo" class="text-xs font-mono text-light-muted dark:text-gpt-muted mt-1">Start a task run to view final summary.</div>
              </div>
            </div>

            <div class="flex-1 bg-light-card dark:bg-gpt-card rounded-xl p-4 border border-light-border dark:border-gpt-border overflow-y-auto space-y-2">
              <div class="text-xs font-bold uppercase tracking-wider text-emerald-500">Extracted Answer & Summary</div>
              <div id="resTextContent" class="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                Run an agent task to view final answer output here. When complete, the live web session closes and the formatted results load automatically into this tab.
              </div>
            </div>
          </div>

          <!-- TAB 3: DOM Inspector -->
          <div id="viewDomTab" class="hidden w-full h-full max-w-4xl bg-[#101012] text-zinc-200 rounded-xl p-4 overflow-auto font-mono text-xs shadow-2xl border border-zinc-800">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-800 text-[11px] text-zinc-400">
              <span class="font-semibold text-emerald-400">DOM ACCESSIBILITY SNAPSHOT TREE</span>
            </div>
            <pre id="domTreeViewer" class="mt-3 text-zinc-300 leading-relaxed whitespace-pre-wrap">No DOM tree captured yet.</pre>
          </div>

          <!-- TAB 4: Extracted JSON Artifacts -->
          <div id="viewDataTab" class="hidden w-full h-full max-w-4xl bg-light-bg dark:bg-gpt-dark rounded-xl p-4 overflow-auto text-xs shadow-2xl border border-light-border dark:border-gpt-border font-mono">
            <div class="flex items-center justify-between pb-3 border-b border-light-border dark:border-gpt-border text-[11px]">
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">RUN ARTIFACTS & METRICS (JSON)</span>
              <button type="button" onclick="window.copyJsonData()" class="hover:underline text-light-muted dark:text-gpt-muted cursor-pointer">Copy JSON</button>
            </div>
            <pre id="jsonViewer" class="mt-3 text-light-text dark:text-gpt-text leading-relaxed whitespace-pre-wrap">{ "status": "idle" }</pre>
          </div>

        </div>

        <!-- Status Footer -->
        <div class="h-8 border-t border-light-border dark:border-gpt-border bg-light-bg dark:bg-gpt-dark px-3 flex items-center justify-between text-[11px] text-light-muted dark:text-gpt-muted z-20">
          <div class="flex items-center gap-3">
            <span>Viewport: <strong class="text-light-text dark:text-gpt-text font-mono">1280 × 800</strong></span>
            <span>DOM Latency: <strong class="text-light-text dark:text-gpt-text font-mono">18ms</strong></span>
          </div>
          <div class="flex items-center gap-2 font-mono">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Operator Connected</span>
          </div>
        </div>
      </section>

    </div>
  </main>

  <!-- Toast -->
  <div id="toast" class="fixed bottom-6 right-6 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-medium shadow-2xl border border-zinc-700">
    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
    <span id="toastMessage">Action completed</span>
  </div>

  <script>
    window.state = {
      isRunning: false,
      selectedModel: 'deepseek/deepseek-v4-flash-0731:free',
      selectedModelName: 'DeepSeek V4 Flash (0731)',
      currentView: 'split',
      activeCanvasTab: 'live',
      stepCount: 0,
      startTime: null,
      timerInterval: null,
      lastRunResult: null,
      sse: null
    };

    window.esc = function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    window.formatResultText = function(text) {
      if (!text) return '';
      var safe = window.esc(text);
      safe = safe.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      safe = safe.replace(/^[\\*\\-]\\s+(.*)$/gm, '• $1');
      return safe.replace(/\\n/g, '<br>');
    };


    window.showToast = function(msg) {
      try {
        var toast = document.getElementById('toast');
        var toastMsg = document.getElementById('toastMessage');
        if (toast && toastMsg) {
          toastMsg.textContent = msg;
          toast.classList.remove('translate-y-20', 'opacity-0');
          setTimeout(function() { toast.classList.add('translate-y-20', 'opacity-0'); }, 2600);
        }
      } catch (e) {}
    };

    window.toggleTheme = function() {
      document.documentElement.classList.toggle('dark');
      window.showToast(document.documentElement.classList.contains('dark') ? 'Dark theme active' : 'Light theme active');
    };

    window.toggleSidebar = function(open) {
      var sidebar = document.getElementById('sidebar');
      var expandBtn = document.getElementById('expandSidebarBtn');
      if (!sidebar) return;
      if (open === false || (open === undefined && !sidebar.classList.contains('-ml-64'))) {
        sidebar.classList.add('-ml-64');
        if (expandBtn) expandBtn.classList.remove('hidden');
      } else {
        sidebar.classList.remove('-ml-64');
        if (expandBtn) expandBtn.classList.add('hidden');
      }
    };

    window.toggleModelDropdown = function(e) {
      if (e) e.stopPropagation();
      var dropdown = document.getElementById('modelDropdown');
      if (dropdown) dropdown.classList.toggle('hidden');
    };

    window.fillChip = function(task, url) {
      var input = document.getElementById('taskPromptInput');
      var urlInput = document.getElementById('startUrlInput');
      if (input) input.value = task;
      if (urlInput) urlInput.value = url || '';
      var container = document.getElementById('urlInputContainer');
      if (container) {
        if (url) container.classList.remove('hidden');
        else container.classList.add('hidden');
      }
      window.executeTaskRun();
    };

    window.openChat = function(chatId) {
      if (!chatId) return;
      if (window.location.pathname !== '/chat/agent/' + chatId) {
        history.pushState({ chatId: chatId }, '', '/chat/agent/' + chatId);
      }
      window.loadChatSession(chatId);
    };

    window.loadRecentChats = function() {
      fetch('/api/chats')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data || !data.chats) return;
          var list = document.getElementById('historyList');
          if (!list) return;
          list.innerHTML = '';
          var curPath = window.location.pathname;
          var curId = curPath.indexOf('/chat/agent/') !== -1 ? curPath.split('/chat/agent/')[1].split('/')[0] : '';

          data.chats.forEach(function(chat) {
            var btn = document.createElement('button');
            btn.type = 'button';
            var isActive = (chat.id === curId);
            btn.className = 'history-item cursor-pointer w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors group ' +
              (isActive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-light-muted dark:text-gpt-muted hover:bg-light-card dark:hover:bg-gpt-card hover:text-light-text dark:hover:text-gpt-text');
            btn.innerHTML = '<div class="flex items-center gap-2 truncate">' +
              '<span class="text-xs">' + (chat.status === 'completed' ? '✅' : chat.status === 'running' ? '⏳' : '⚡') + '</span>' +
              '<span class="truncate">' + window.esc(chat.goal) + '</span>' +
              '</div>' +
              (isActive ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>' : '');
            btn.onclick = function() {
              window.openChat(chat.id);
            };
            list.appendChild(btn);
          });
        })
        .catch(function() {});
    };

    window.loadChatSession = function(chatId) {
      fetch('/api/chats/' + encodeURIComponent(chatId))
        .then(function(res) {
          if (!res.ok) throw new Error('Chat session not found');
          return res.json();
        })
        .then(function(session) {
          if (!session) return;
          window.state.currentChatId = session.id;

          var promptInput = document.getElementById('taskPromptInput');
          if (promptInput) promptInput.value = session.goal || '';

          var urlInput = document.getElementById('startUrlInput');
          var urlContainer = document.getElementById('urlInputContainer');
          if (urlInput && urlContainer) {
            if (session.initialUrl) {
              urlInput.value = session.initialUrl;
              urlContainer.classList.remove('hidden');
            } else {
              urlInput.value = '';
              urlContainer.classList.add('hidden');
            }
          }

          var stepMetric = document.getElementById('metricSteps');
          if (stepMetric) stepMetric.textContent = session.steps ? session.steps.length : '0';
          var elapsedMetric = document.getElementById('metricElapsed');
          if (elapsedMetric) {
            elapsedMetric.textContent = session.durationMs ? ((session.durationMs / 1000).toFixed(1) + 's') : '0.0s';
          }

          var container = document.getElementById('dynamicChatSteps');
          if (container) {
            container.innerHTML = '';

            var userBubble = document.createElement('div');
            userBubble.className = "flex items-start gap-3.5 w-full";
            userBubble.innerHTML =
              '<div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-semibold text-xs shadow-sm">U</div>' +
              '<div class="flex-1 space-y-2 min-w-0">' +
                '<div class="font-medium text-xs text-light-muted dark:text-gpt-muted">You</div>' +
                '<div class="text-sm leading-relaxed p-3.5 rounded-2xl bg-light-card dark:bg-gpt-card text-light-text dark:text-gpt-text shadow-sm border border-light-border dark:border-gpt-border">' + window.esc(session.goal) + '</div>' +
                (session.initialUrl ? '<div class="flex items-center gap-1.5 text-xs text-light-muted dark:text-gpt-muted"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-light-card dark:bg-gpt-card border border-light-border dark:border-gpt-border font-mono text-[11px] text-emerald-600 dark:text-emerald-400">🌐 ' + window.esc(session.initialUrl) + '</span></div>' : '') +
              '</div>';
            container.appendChild(userBubble);

            if (session.steps && session.steps.length) {
              session.steps.forEach(function(d, index) {
                var toolName = d.toolName || d.tool || 'Action';
                var isLearn = toolName === 'learn_prompt';

                var card = document.createElement('div');
                card.className = "flex items-start gap-3.5 w-full";

                var badgeHtml = isLearn
                  ? '<span class="learn-badge">🧠 Learn Prompt Strategy</span>'
                  : '<span class="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">#' + (d.stepNumber || (index + 1)) + ' ' + window.esc(toolName) + '</span>';

                var descHtml = isLearn
                  ? '<div class="step-desc-full">' + window.formatResultText((d.thought ? d.thought + '\\n\\n' : '') + (d.output || '')) + '</div>'
                  : '<div class="text-xs text-slate-700 dark:text-gpt-text font-medium mt-1">' + window.esc(d.thought || d.output || '') + '</div>';

                card.innerHTML =
                  '<img src="/logo.png" alt="BrowserAgent" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/20 flex-shrink-0">' +
                  '<div class="flex-1 space-y-1.5 min-w-0">' +
                    '<div class="flex items-center justify-between">' + badgeHtml + '<span class="text-[10px] font-mono text-light-muted dark:text-gpt-muted">' + (d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '') + '</span></div>' +
                    descHtml +
                  '</div>';
                container.appendChild(card);
              });
            }

            if (session.finalAnswer || session.summary) {
              var doneBubble = document.createElement('div');
              doneBubble.className = "flex items-start gap-3.5 w-full";
              doneBubble.innerHTML =
                '<img src="/logo.png" alt="BrowserAgent" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/20 flex-shrink-0">' +
                '<div class="flex-1 space-y-2 min-w-0">' +
                  '<div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Final Result</div>' +
                  '<div class="text-sm p-4 rounded-2xl bg-light-card dark:bg-gpt-card border border-light-border dark:border-gpt-border text-light-text dark:text-gpt-text leading-relaxed whitespace-pre-wrap shadow-sm">' + window.formatResultText(session.finalAnswer || session.summary) + '</div>' +
                '</div>';
              container.appendChild(doneBubble);
            }
          }

          var rb = document.getElementById('resBadge');
          if (rb) {
            if (session.status === 'completed') {
              rb.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
              rb.innerHTML = '✅ Task Completed Successfully';
            } else if (session.status === 'failed') {
              rb.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
              rb.innerHTML = '❌ Task Failed';
            }
          }
          var gt = document.getElementById('resGoalTitle');
          if (gt) gt.textContent = session.goal ? ('Goal: ' + session.goal) : 'Task Overview';
          var mi = document.getElementById('resMetaInfo');
          if (mi) mi.textContent = 'Total Steps: ' + (session.steps ? session.steps.length : 0) + ' | Duration: ' + Math.round((session.durationMs || 0)/1000) + 's';
          var tc = document.getElementById('resTextContent');
          if (tc) tc.innerHTML = window.formatResultText(session.finalAnswer || session.summary || 'Session recorded.');

          if (session.snapshotTree) {
            var domViewer = document.getElementById('domTreeViewer');
            if (domViewer) domViewer.textContent = session.snapshotTree;
          }

          var jv = document.getElementById('jsonViewer');
          if (jv) jv.textContent = JSON.stringify(session, null, 2);

          if (session.finalAnswer || session.summary) {
            window.switchCanvasTab('result');
          }

          window.loadRecentChats();
          window.showToast('Loaded chat session');
        })
        .catch(function(err) {
          window.showToast('Failed to load chat: ' + err.message);
        });
    };

    window.prepareNewTask = function() {
      if (window.location.pathname !== '/') {
        history.pushState(null, '', '/');
      }
      var input = document.getElementById('taskPromptInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      var urlInput = document.getElementById('startUrlInput');
      if (urlInput) urlInput.value = '';
      var container = document.getElementById('urlInputContainer');
      if (container) container.classList.add('hidden');

      var chatSteps = document.getElementById('dynamicChatSteps');
      if (chatSteps) chatSteps.innerHTML = '';

      var stepMetric = document.getElementById('metricSteps');
      if (stepMetric) stepMetric.textContent = '0';
      var elapsedMetric = document.getElementById('metricElapsed');
      if (elapsedMetric) elapsedMetric.textContent = '0.0s';

      window.switchCanvasTab('live');
      window.loadRecentChats();
      window.showToast('Ready for new task');
    };

    window.toggleUrlContainer = function(show) {
      var container = document.getElementById('urlInputContainer');
      if (!container) return;
      if (show === undefined) container.classList.toggle('hidden');
      else if (show) container.classList.remove('hidden');
      else container.classList.add('hidden');
    };

    window.copyJsonData = function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(window.state.lastRunResult || { status: "idle" }, null, 2))
          .then(function() { window.showToast('JSON copied to clipboard!'); });
      }
    };

    window.switchTab = function(tab) {
      window.switchCanvasTab(tab);
    };

    window.switchCanvasTab = function(tab) {
      window.state.activeCanvasTab = tab;
      var tabMap = [
        { id: 'live', btn: document.getElementById('tabLiveBtn'), view: document.getElementById('viewLiveTab') },
        { id: 'result', btn: document.getElementById('tabResultBtn'), view: document.getElementById('viewResultTab') },
        { id: 'dom', btn: document.getElementById('tabDomBtn'), view: document.getElementById('viewDomTab') },
        { id: 'data', btn: document.getElementById('tabDataBtn'), view: document.getElementById('viewDataTab') }
      ];

      tabMap.forEach(function(item) {
        if (item.btn) {
          if (item.id === tab) {
            item.btn.classList.add('active');
            item.btn.classList.remove('text-light-muted', 'dark:text-gpt-muted');
          } else {
            item.btn.classList.remove('active');
            item.btn.classList.add('text-light-muted', 'dark:text-gpt-muted');
          }
        }
        if (item.view) {
          if (item.id === tab) item.view.classList.remove('hidden');
          else item.view.classList.add('hidden');
        }
      });
    };

    window.setViewMode = function(mode) {
      window.state.currentView = mode;
      var chatPane = document.getElementById('chatPane');
      var browserPane = document.getElementById('browserPane');
      var chatFeedInner = document.getElementById('chatFeedInner');
      var inputInner = document.getElementById('inputInner');

      var btnMap = [
        { id: 'split', btn: document.getElementById('viewSplitBtn') },
        { id: 'browser', btn: document.getElementById('viewBrowserBtn') },
        { id: 'chat', btn: document.getElementById('viewChatBtn') }
      ];

      btnMap.forEach(function(item) {
        if (!item.btn) return;
        if (item.id === mode) {
          item.btn.classList.add('active');
          item.btn.classList.remove('text-light-muted', 'dark:text-gpt-muted');
        } else {
          item.btn.classList.remove('active');
          item.btn.classList.add('text-light-muted', 'dark:text-gpt-muted');
        }
      });

      if (!chatPane || !browserPane) return;

      if (mode === 'split') {
        chatPane.classList.remove('hidden');
        chatPane.className = "w-full lg:w-1/2 flex flex-col h-full border-r border-light-border dark:border-gpt-border bg-light-bg dark:bg-gpt-dark relative min-w-0 transition-all duration-300 ease-in-out";
        
        browserPane.classList.remove('hidden');
        browserPane.className = "w-full lg:w-1/2 flex flex-col h-full bg-light-card/40 dark:bg-gpt-darker relative overflow-hidden min-w-0 transition-all duration-300 ease-in-out";

        if (chatFeedInner) chatFeedInner.className = "max-w-3xl mx-auto w-full space-y-6 transition-all duration-300";
        if (inputInner) inputInner.className = "max-w-3xl mx-auto space-y-2 relative z-30 transition-all duration-300";
      } else if (mode === 'browser') {
        chatPane.classList.add('hidden');
        
        browserPane.classList.remove('hidden');
        browserPane.className = "w-full flex-1 flex flex-col h-full bg-light-card/40 dark:bg-gpt-darker relative overflow-hidden min-w-0 transition-all duration-300 ease-in-out";
      } else if (mode === 'chat') {
        browserPane.classList.add('hidden');
        
        chatPane.classList.remove('hidden');
        chatPane.className = "w-full flex-1 flex flex-col h-full border-r-0 bg-light-bg dark:bg-gpt-dark relative min-w-0 transition-all duration-300 ease-in-out";

        // Center the chat feed & prompt input cleanly on screen (ChatGPT / Gemini style)
        if (chatFeedInner) chatFeedInner.className = "max-w-3xl md:max-w-4xl mx-auto w-full space-y-6 transition-all duration-300";
        if (inputInner) inputInner.className = "max-w-3xl md:max-w-4xl mx-auto space-y-2 relative z-30 transition-all duration-300";
      }
    };

    window.loadModels = function() {
      fetch('/api/models')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data || !data.models) return;
          if (data.defaultModel) {
            window.state.selectedModel = data.defaultModel;
            var defM = data.models.find(function(m) { return m.id === data.defaultModel; });
            if (defM) {
              window.state.selectedModelName = defM.name;
              var curLabel = document.getElementById('currentModelText');
              if (curLabel) curLabel.textContent = defM.name;
            }
          }
          var container = document.getElementById('modelOptionsContainer');
          if (!container) return;
          container.innerHTML = '';
          data.models.forEach(function(m) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'model-option w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-light-card dark:hover:bg-gpt-cardHover cursor-pointer ' +
              (m.id === window.state.selectedModel ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium' : '');
            btn.innerHTML = '<div><div class="font-semibold text-xs">' + window.esc(m.name) + '</div><div class="text-[10px] opacity-60 font-mono">' + window.esc(m.id) + '</div></div>';
            btn.onclick = function() {
              window.state.selectedModel = m.id;
              window.state.selectedModelName = m.name;
              var cur = document.getElementById('currentModelText');
              if (cur) cur.textContent = m.name;
              var drop = document.getElementById('modelDropdown');
              if (drop) drop.classList.add('hidden');
              window.showToast('Switched model to ' + m.name);
            };
            container.appendChild(btn);
          });
        })
        .catch(function() {});
    };

    window.initSSE = function() {
      try {
        if (window.state.sse) window.state.sse.close();
        window.state.sse = new EventSource('/api/stream');

        window.state.sse.addEventListener('status', function(e) {
          try {
            var d = JSON.parse(e.data);
            if (d.isRunning) window.setRunningUI(true);
          } catch(err) {}
        });

        window.state.sse.addEventListener('start', function(e) {
          try {
            var d = JSON.parse(e.data);
            window.onRunStart(d);
          } catch(err) {}
        });

        window.state.sse.addEventListener('step', function(e) {
          try {
            var d = JSON.parse(e.data);
            window.onRunStep(d);
          } catch(err) {}
        });

        window.state.sse.addEventListener('frame', function(e) {
          try {
            var d = JSON.parse(e.data);
            window.onRunFrame(d);
          } catch(err) {}
        });

        window.state.sse.addEventListener('done', function(e) {
          try {
            var d = JSON.parse(e.data);
            window.onRunDone(d);
          } catch(err) {}
        });

        window.state.sse.addEventListener('error', function(e) {
          try { var d = JSON.parse(e.data); window.onRunError(d.message); } catch(ex) {}
        });

        window.state.sse.onerror = function() {
          if (window.state.sse && window.state.sse.readyState === 2) {
            setTimeout(function() { window.initSSE(); }, 2500);
          }
        };
      } catch (e) {}
    };

    window.setRunningUI = function(running) {
      window.state.isRunning = running;
      var btn = document.getElementById('runAgentBtn');
      var runIcon = document.getElementById('runIcon');
      var stopIcon = document.getElementById('stopIcon');
      var pulse = document.getElementById('agentStatusLabel');
      var pulseDot = document.getElementById('agentStatusPulse');

      if (!btn) return;
      if (running) {
        if (runIcon) runIcon.classList.add('hidden');
        if (stopIcon) stopIcon.classList.remove('hidden');
        btn.classList.remove('bg-emerald-500', 'hover:bg-emerald-400');
        btn.classList.add('bg-rose-500', 'hover:bg-rose-400');
        if (pulse) pulse.textContent = 'Running...';
        if (pulseDot) pulseDot.innerHTML = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>';
      } else {
        if (stopIcon) stopIcon.classList.add('hidden');
        if (runIcon) runIcon.classList.remove('hidden');
        btn.classList.remove('bg-rose-500', 'hover:bg-rose-400');
        btn.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
        if (pulse) pulse.textContent = 'Ready';
        if (pulseDot) pulseDot.innerHTML = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>';
        clearInterval(window.state.timerInterval);
      }
    };

    window.onRunStart = function(d) {
      window.setRunningUI(true);
      window.state.stepCount = 0;
      window.state.startTime = Date.now();
      window.addToHistory(d.goal, d.initialUrl);
      var st = document.getElementById('metricSteps'); if (st) st.textContent = '0';
      var el = document.getElementById('metricElapsed'); if (el) el.textContent = '0.0s';
      if (d.initialUrl) {
        var ur = document.getElementById('browserUrlDisplay');
        if (ur) ur.textContent = d.initialUrl;
      }

      window.state.timerInterval = setInterval(function() {
        var sec = ((Date.now() - window.state.startTime) / 1000).toFixed(1);
        var me = document.getElementById('metricElapsed');
        if (me) me.textContent = sec + 's';
      }, 100);

      var container = document.getElementById('dynamicChatSteps');
      if (container) {
        var userBubble = document.createElement('div');
        userBubble.className = "flex items-start gap-3.5 w-full animate-in fade-in";
        userBubble.innerHTML =
          '<div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-semibold text-xs shadow-sm">U</div>' +
          '<div class="flex-1 space-y-2 min-w-0">' +
            '<div class="font-medium text-xs text-light-muted dark:text-gpt-muted">You</div>' +
            '<div class="text-sm leading-relaxed p-3.5 rounded-2xl bg-light-card dark:bg-gpt-card text-light-text dark:text-gpt-text shadow-sm border border-light-border dark:border-gpt-border">' + window.esc(d.goal) + '</div>' +
            (d.initialUrl ? '<div class="flex items-center gap-1.5 text-xs text-light-muted dark:text-gpt-muted"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-light-card dark:bg-gpt-card border border-light-border dark:border-gpt-border font-mono text-[11px] text-emerald-600 dark:text-emerald-400">🌐 ' + window.esc(d.initialUrl) + '</span></div>' : '') +
          '</div>';
        container.appendChild(userBubble);
        var chatFeed = document.getElementById('chatFeed');
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      }

      window.switchCanvasTab('live');
    };

    window.onRunStep = function(d) {
      window.state.stepCount++;
      var st = document.getElementById('metricSteps');
      if (st) st.textContent = window.state.stepCount;

      var container = document.getElementById('dynamicChatSteps');
      if (container) {
        var toolName = d.toolName || d.tool || 'Action';
        var isLearn = toolName === 'learn_prompt';

        var card = document.createElement('div');
        card.className = "flex items-start gap-3.5 w-full animate-in fade-in";

        var badgeHtml = isLearn
          ? '<span class="learn-badge">🧠 Learn Prompt Strategy</span>'
          : '<span class="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">#' + window.state.stepCount + ' ' + window.esc(toolName) + '</span>';

        var descHtml = isLearn
          ? '<div class="step-desc-full">' + window.formatResultText((d.thought ? d.thought + '\\n\\n' : '') + (d.output || '')) + '</div>'
          : '<div class="text-xs text-slate-700 dark:text-gpt-text font-medium mt-1">' + window.esc(d.thought || d.output || '') + '</div>';

        card.innerHTML =
          '<img src="/logo.png" alt="BrowserAgent" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/20 flex-shrink-0">' +
          '<div class="flex-1 space-y-1.5 min-w-0">' +
            '<div class="flex items-center justify-between">' + badgeHtml + '<span class="text-[10px] font-mono text-light-muted dark:text-gpt-muted">' + new Date(d.timestamp || Date.now()).toLocaleTimeString() + '</span></div>' +
            descHtml +
          '</div>';

        container.appendChild(card);
        var chatFeed = document.getElementById('chatFeed');
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      }

      if (d.snapshotTree) {
        var domViewer = document.getElementById('domTreeViewer');
        if (domViewer) domViewer.textContent = d.snapshotTree;
      }
    };

    window.onRunFrame = function(d) {
      if (d.screenshotUrl) {
        var img = document.getElementById('realLiveFrame');
        var placeholder = document.getElementById('browserPlaceholder');
        if (img && placeholder) {
          img.src = d.screenshotUrl + '?t=' + Date.now();
          img.classList.remove('hidden');
          placeholder.classList.add('hidden');
        }
      }
      if (d.url) {
        var ur = document.getElementById('browserUrlDisplay');
        if (ur) ur.textContent = d.url;
      }
    };

    window.onRunDone = function(d) {
      window.setRunningUI(false);
      window.state.lastRunResult = d;

      var img = document.getElementById('realLiveFrame');
      var placeholder = document.getElementById('browserPlaceholder');
      if (img && placeholder) {
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.innerHTML = '<span class="text-4xl">✅</span><strong class="text-sm font-semibold">Browser Session Closed</strong><p class="text-xs max-w-xs leading-relaxed">Task completed cleanly. Output loaded in Final Result tab.</p>';
      }
      var ur = document.getElementById('browserUrlDisplay');
      if (ur) ur.textContent = 'Browser Session Closed';

      var rb = document.getElementById('resBadge');
      if (rb) {
        rb.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        rb.innerHTML = '✅ Task Completed Successfully';
      }
      var gt = document.getElementById('resGoalTitle'); if (gt) gt.textContent = d.goal ? ('Goal: ' + d.goal) : 'Task Completed';
      var mi = document.getElementById('resMetaInfo'); if (mi) mi.textContent = 'Total Steps: ' + (d.steps ? d.steps.length : window.state.stepCount) + ' | Duration: ' + Math.round((d.durationMs || 0)/1000) + 's';
      var tc = document.getElementById('resTextContent'); if (tc) tc.innerHTML = window.formatResultText(d.finalAnswer || d.summary || 'Task completed cleanly.');

      var jv = document.getElementById('jsonViewer'); if (jv) jv.textContent = JSON.stringify(d, null, 2);

      var container = document.getElementById('dynamicChatSteps');
      if (container) {
        var doneBubble = document.createElement('div');
        doneBubble.className = "flex items-start gap-3.5 w-full animate-in fade-in";
        doneBubble.innerHTML =
          '<img src="/logo.png" alt="BrowserAgent" class="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-emerald-500/20 flex-shrink-0">' +
          '<div class="flex-1 space-y-2 min-w-0">' +
            '<div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Final Result</div>' +
            '<div class="text-sm p-4 rounded-2xl bg-light-card dark:bg-gpt-card border border-light-border dark:border-gpt-border text-light-text dark:text-gpt-text leading-relaxed whitespace-pre-wrap shadow-sm">' + window.formatResultText(d.finalAnswer || d.summary || 'Completed.') + '</div>' +
          '</div>';
        container.appendChild(doneBubble);
        var chatFeed = document.getElementById('chatFeed');
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      }

      window.switchCanvasTab('result');
      window.showToast('Task complete!');
    };

    window.onRunError = function(msg) {
      window.setRunningUI(false);
      var ur = document.getElementById('browserUrlDisplay');
      if (ur) ur.textContent = 'Session Terminated (Error)';

      var rb = document.getElementById('resBadge');
      if (rb) {
        rb.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30';
        rb.innerHTML = '❌ Execution Error';
      }
      var gt = document.getElementById('resGoalTitle'); if (gt) gt.textContent = 'Task Error';
      var mi = document.getElementById('resMetaInfo'); if (mi) mi.textContent = 'Stopped after ' + window.state.stepCount + ' steps';
      var tc = document.getElementById('resTextContent'); if (tc) tc.textContent = msg || 'Execution error encountered.';

      window.switchCanvasTab('result');
      window.showToast('Run error: ' + (msg || 'Error'));
    };

    window.executeTaskRun = function() {
      if (window.state.isRunning) {
        fetch('/api/stop', { method: 'POST' })
          .then(function() { window.showToast('Stopping agent run...'); });
        return;
      }

      var promptInput = document.getElementById('taskPromptInput');
      if (!promptInput) return;
      var goal = promptInput.value.trim();
      if (!goal) {
        window.showToast('Please enter a task prompt goal.');
        return;
      }

      var startInput = document.getElementById('startUrlInput');
      var url = (startInput && startInput.value.trim()) ? startInput.value.trim() : undefined;

      fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal, url: url, model: window.state.selectedModel })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          window.showToast('Error: ' + data.error);
        } else if (data.chatId) {
          window.state.currentChatId = data.chatId;
          history.pushState({ chatId: data.chatId }, '', '/chat/agent/' + data.chatId);
          window.loadRecentChats();
        }
      })
      .catch(function(err) { window.showToast('Failed to start run.'); });
    };

    function initApp() {
      try { window.loadModels(); } catch (e) {}
      try { window.initSSE(); } catch (e) {}
      try { window.loadRecentChats(); } catch (e) {}

      var path = window.location.pathname;
      if (path.indexOf('/chat/agent/') !== -1) {
        var chatId = path.split('/chat/agent/')[1].split('/')[0];
        if (chatId) {
          window.loadChatSession(chatId);
        }
      }

      window.addEventListener('popstate', function() {
        var p = window.location.pathname;
        if (p.indexOf('/chat/agent/') !== -1) {
          var id = p.split('/chat/agent/')[1].split('/')[0];
          if (id) window.loadChatSession(id);
        } else {
          window.prepareNewTask();
        }
      });

      document.addEventListener('click', function(e) {
        var dropdown = document.getElementById('modelDropdown');
        var picker = document.getElementById('modelPickerBtn');
        if (dropdown && picker && !picker.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });

      window.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          var input = document.getElementById('taskPromptInput');
          if (input) input.focus();
        }
        var taskInput = document.getElementById('taskPromptInput');
        if (e.key === 'Enter' && !e.shiftKey && document.activeElement === taskInput) {
          e.preventDefault();
          window.executeTaskRun();
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  </script>
</body>
</html>`;
}
