# Objective

## Available Skills & Tools
- @discovered-/Users/jkneen/.claude/skills/agent-browser/SKILL.md — "Automates browser interactions for web testing, form filling, screenshots, and data extraction via the agent-browser CLI."
- @discovered-/Users/jkneen/.claude/skills/housekeeping/SKILL.md — "Clean up, audit, and optimize Claude configuration folders (~/.claude or .claude). Analyzes hooks, scripts, plugins, commands, and storage for token waste, redundancy, and optimization opportunities, then produces a prioritized action plan with before/after benefits."
- @discovered-/Users/jkneen/.claude/skills/lazar-openclicky/SKILL.md — "Use Lazar (self-evolving AI agent) via MCP and OpenClicky (visual screen pointer) to show, explain, and annotate anything on screen. Lazar exposes skills/memory/research/status as MCP tools. OpenClicky moves a pointer, places captions, and speaks. Use for demos, walkthroughs, debugging sessions, and guided screen tours."
- @discovered-/Users/jkneen/.claude/commands/analyze-risks.md — Comprehensive risk analysis for the product
- @discovered-/Users/jkneen/.claude/skills/ascii-art/SKILL.md — Converts text, images, or video to ASCII art with multiple styles and export formats. Use when the user asks to create ASCII art, convert images/videos to text art, or mentions ascii-art, braille art, or block art.
- @discovered-/Users/jkneen/.claude/skills/autoplan/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/benchmark/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/benchmark-models/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/browse/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/build-ai-agents/SKILL.md — Build AI agents with Vercel AI SDK from scratch through shipping. Full lifecycle - build, debug, test, optimize, ship. Covers streamText, generateText, useChat, AI Elements, multi-turn tool calling, and agent loops.
- @discovered-/Users/jkneen/.claude/commands/build-product.md — Master workflow that orchestrates the entire product development lifecycle
- @discovered-/Users/jkneen/.claude/skills/canary/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/careful/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/chain-of-verification/SKILL.md — Reduce factual hallucinations by generating a draft answer, planning verification questions, executing those checks independently in factored form, then revising the final response using only supported facts. Use for factual Q&A, long-form explanations, dates/numbers, ranked claims, or when asked to verify/fact-check.
- @discovered-/Users/jkneen/.claude/skills/clawuth-spaces/SKILL.md — Use when working with X/Twitter Spaces via the clawuth library — hosting an AI-driven Space, listening to a live Space for keyword alerts, transcribing audio, managing TTS backends (Voice Lab / ElevenLabs), or wiring up the low-level Periscope/HLS/RTMP APIs. Covers both the CLI and the programmatic JavaScript API.
- @discovered-/Users/jkneen/.claude/skills/clonereact/SKILL.md — Extract React components visually from any website using Electron selector. Use when user wants to clone components, extract React code, recreate UI from websites, copy component designs, or visually select elements to turn into React components.
- @discovered-/Users/jkneen/.claude/skills/cluso-inspector/SKILL.md — Visual element selector for extracting HTML, screenshots, and context from web pages. Use when you need to see what the user is referring to, when clarification is needed about UI elements, or when the user offers to show you something visually.
- @discovered-/Users/jkneen/.claude/skills/cluso-widget/SKILL.md — Install and integrate the cluso-widget into an app. Use when an agent needs to add the Cluso floating annotation toolbar to a React/Vite/Next.js project OR to a plain static HTML/single-file app via the prebuilt dist bundle.
- @discovered-/Users/jkneen/.claude/skills/codesurf-extension/SKILL.md — "Build CodeSurf (contex) extensions — self-contained tile-based plugins with manifest, optional Node.js backend, and HTML tile UI. TRIGGER when: user asks to build/create/make an extension, plugin, or tile for CodeSurf/contex/codesurf; user asks to add a new panel, widget, or tool tile; user references extension.json, main.js with activate(), or window.contex bridge; user wants to wrap a CLI tool, API, or system feature as a canvas tile. Also trigger when editing or debugging existing extensions."
- @discovered-/Users/jkneen/.claude/skills/codex/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/collab-canvas/SKILL.md — From /Users/jkneen/.claude/skills
- @discovered-/Users/jkneen/.claude/skills/context-restore/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/context-save/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/contract-execution/SKILL.md — Use this skill whenever the user asks Claude to execute a substantive instructional task — writing code, building a system, producing a document, doing analysis — where reliability matters more than speed. This skill enforces a contract-style protocol with five gates (comprehend, plan, plan-review, execute-with-per-task-verification, final-review) and produces written artifacts at each gate. Trigger this for any multi-step task, especially when the user mentions "carefully," "make sure," "high reliability," "don't miss anything," "do this properly," when working on something the user has flagged as important, or any time a single-shot answer would risk drift, hallucination, or incomplete coverage. Also trigger when the user explicitly asks for plan-execute-verify loops, generator/critic patterns, or contract-based agent execution.
- @discovered-/Users/jkneen/.claude/skills/conversation-history/SKILL.md — "Master skill for querying, analyzing, and learning from Claude Code conversation history"
- @discovered-/Users/jkneen/.claude/skills/cso/SKILL.md — |
- @discovered-/Users/jkneen/.claude/commands/debug.md — Debug and fix issues in the current project
- @discovered-/Users/jkneen/.claude/commands/deploy-application.md — Deploy application to production
- @discovered-/Users/jkneen/.claude/commands/design-architecture.md — Design complete system architecture based on requirements and constraints
- @discovered-/Users/jkneen/.claude/skills/design-consultation/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/design-html/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/design-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/design-shotgun/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/devex-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/diagnosing-stop-hook-hijack/SKILL.md — Use when the user reports "Claude isn't responding", "Claude only replies with a meta-message", "I keep seeing 'no novel insights to capture'", "every reply is about skills", "Claude's answers got replaced", or any symptom where Claude's actual turn output is missing/replaced by hook-injected text. Also triggers on phrases like "stop hook", "skill-reminder", "decision block", or when investigating why short/greeting sessions produce only a compliance sentence.
- @discovered-/Users/jkneen/.claude/commands/dispatch.md — Run a command in dispatch mode (background, notified on completion)
- @discovered-/Users/jkneen/.claude/skills/document-release/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/env-vars/SKILL.md — Look up API keys and environment variables from ~/.env and shell profiles. Use when you need to find what services and credentials are configured for the current user.
- @discovered-/Users/jkneen/.claude/commands/explore-plan-code-test.md — "Explore codebase, plan implementation, code features, and test thoroughly"
- @discovered-/Users/jkneen/.claude/skills/expo-ios-build-troubleshooting/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/find-env-keys/SKILL.md — Look up which env vars, API keys, and service URLs are used by which projects in ~/Documents/GitHub. Use when an agent needs to find where a key like ANTHROPIC_API_KEY or a service like Convex/Stripe/Supabase is configured, or which projects share credentials.
- @discovered-/Users/jkneen/.claude/skills/freeze/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/frontend-design-toolkit/SKILL.md — Curated catalog of Claude Code skills, plugins, and MCP servers for building better-looking frontends. Trigger when the user asks for recommendations on frontend/UI/UX skills, design plugins, theming systems (OKLCH, Tailwind v4 @theme, design tokens), animation libraries (GSAP, Framer Motion), Figma integration, browser testing (Playwright, Chrome DevTools), CLAUDE.md aesthetic theme blocks (cyberpunk, brutalist, solarpunk, etc.), or which combo of skills/MCPs to install for a frontend stack. Read references/toolkit.md for the full list, then point the user to specific tools matching their need.
- @discovered-/Users/jkneen/.claude/commands/generate-project.md — Generate complete project structure and initial code
- @discovered-/Users/jkneen/.claude/skills/gstack-upgrade/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/guard/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/hatch-pet/SKILL.md — Create, repair, validate, preview, and package Codex-compatible animated pet spritesheets from character art, screenshots, generated images, or visual references. Use when a user wants to hatch a Codex pet, create a custom animated pet, or build a built-in pet asset with an 8x9 atlas, transparent unused cells, row-by-row animation prompts, QA contact sheets, preview videos, and pet.json packaging. This skill composes the installed $imagegen system skill for visual generation and uses bundled scripts for deterministic spritesheet assembly.
- @discovered-/Users/jkneen/.claude/skills/health/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/helmor-cli/SKILL.md — Use the Helmor CLI to remote-control Helmor from the terminal. Use when the user asks to inspect Helmor data/settings, manage repositories/workspaces/sessions/files, send prompts to agents, list models, use GitHub integration, inspect scripts, migrate from Conductor, run Helmor as an MCP server, generate shell completions, quit a running app, check/install/update the Helmor CLI beta, install/update Helmor skills through the beta app flow, or needs the Helmor command reference.
- @discovered-/Users/jkneen/.claude/commands/implement-features.md — Implement features based on requirements and architecture
- @discovered-/Users/jkneen/.claude/commands/infinitty-widget.md — From /Users/jkneen/.claude/commands
- @discovered-/Users/jkneen/.claude/skills/investigate/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/ios-simulator-headless/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/land-and-deploy/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/lazar/SKILL.md — Interact with lazar — the self-evolving AI agent at ~/lazar. Use when you need lazar's memory, skills, heartbeat, research, or todo list. Exposes MCP tools and direct CLI access.
- @discovered-/Users/jkneen/.claude/skills/learn/SKILL.md — |
- @discovered-/Users/jkneen/.claude/commands/learn-from-history.md — From /Users/jkneen/.claude/commands
- @discovered-/Users/jkneen/.claude/skills/llm-tldr/SKILL.md — Code analysis for AI agents via 5-layer semantic indexing. Use when exploring codebases, finding functions by behavior, analyzing call graphs, tracing data flow, debugging with program slices, or preparing LLM-ready context. Triggers on "find code that does X", "what calls this", "trace this variable", "analyze this function", "code structure", "impact analysis".
- @discovered-/Users/jkneen/.claude/skills/macos-dev/SKILL.md — macOS developer skill for code signing, notarization, GitHub Actions CI/CD, Electron packaging, and Apple Developer Program workflows. Use when working with Xcode certificates, provisioning, notarytool, or shipping macOS apps.
- @discovered-/Users/jkneen/.claude/skills/make-pdf/SKILL.md — |
- @discovered-/Users/jkneen/.claude/commands/multi-step-workflow.md — Multi-step workflow with sequential reasoning, validation, critique, and task orchestration
- @discovered-/Users/jkneen/.claude/commands/observe-state.md — "Observe and analyze the current state after command execution"
- @discovered-/Users/jkneen/.claude/skills/office-hours/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/ooda-loop/SKILL.md — >
- @discovered-/Users/jkneen/.claude/skills/connect-chrome/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/opentui/SKILL.md — "A skill for working with OpenTUI, a TypeScript library for building terminal user interfaces (TUIs)"
- @discovered-/Users/jkneen/.claude/commands/swarm.md — Master multi-agent orchestration using Claude Code's TeammateTool and Task system. Use when coordinating multiple agents, running parallel code reviews, creating pipeline workflows with dependencies, building self-organizing task queues, or any task benefiting from divide-and-conquer patterns.
- @discovered-/Users/jkneen/.claude/skills/package-electron/skill.md — Package Electron apps for npm/npx distribution. Handles electron-builder, electron-forge, npm wrapper packages, and cross-platform binary distribution.
- @discovered-/Users/jkneen/.claude/skills/package-tauri/skill.md — Package Tauri apps for npm/npx distribution. Handles cargo-tauri builds, npm wrapper packages, cross-platform binary distribution, and GitHub Actions CI.
- @discovered-/Users/jkneen/.claude/skills/pair-agent/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/parlant/SKILL.md — Python framework for building LLM agents with guaranteed behavioral compliance using journeys, guidelines, and structured tool integration
- @discovered-/Users/jkneen/.claude/skills/pinokio/SKILL.md — Discover, launch, and use apps and tools for the current task.
- @discovered-/Users/jkneen/.claude/skills/plan-ceo-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/plan-design-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/plan-devex-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/plan-eng-review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/plan-tune/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/potato-hunter/SKILL.md — Analyze Claude conversation transcripts for repeated misunderstandings, frustration patterns, and inefficient failure loops, then produce a structured report.
- @discovered-/Users/jkneen/.claude/skills/qa/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/qa-only/SKILL.md — |
- @discovered-/Users/jkneen/.claude/commands/repo-analysis.md — "Comprehensive repository analysis using Gemini CLI for codebase understanding"
- @discovered-/Users/jkneen/.claude/skills/retro/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/review/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/setup-browser-cookies/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/setup-deploy/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/ship/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/skill-creator/SKILL.md — Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, update or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
- @discovered-/Users/jkneen/.claude/commands/steering.md — "Create comprehensive steering documents for a development project"
- @discovered-/Users/jkneen/.claude/skills/termcast/SKILL.md — >
- @discovered-/Users/jkneen/.claude/skills/ui-skills/SKILL.md — Opinionated constraints for building better interfaces with agents.
- @discovered-/Users/jkneen/.claude/commands/understand-idea.md — Takes a vague product idea and extracts concrete requirements through analysis
- @discovered-/Users/jkneen/.claude/skills/unfreeze/SKILL.md — |
- @discovered-/Users/jkneen/.claude/skills/visual-explainer/SKILL.md — Generate beautiful, self-contained HTML pages that visually explain systems, code changes, plans, and data. Use when the user asks for a diagram, architecture overview, diff review, plan review, project recap, comparison table, or any visual explanation of technical concepts. Also use proactively when you are about to render a complex ASCII table (4+ rows or 3+ columns) — present it as a styled HTML page instead.
- @discovered-/Users/jkneen/.claude/skills/web-design-guidelines/SKILL.md — Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
- @discovered-/Users/jkneen/.claude/commands/web-interface-guidelines.md — Review UI code for Vercel Web Interface Guidelines compliance
- @discovered-/Users/jkneen/.claude/skills/webtest/SKILL.md — Test web applications with Playwright MCP tools by navigating pages, interacting with UI, checking console output, and verifying backend behavior.
- @command:/clear — Clear conversation
- @command:/compact — Compact conversation
- @command:/export-notes — Copy all attached block notes to the clipboard
- @command:/help — Show help
- @command:/init — Initialize workspace
- @command:/mode — Switch mode (plan, build, etc.)
- @command:/model — Switch model

## Communication Protocol
Use these MCP tools to report progress:

| Tool | When |
|------|------|
| update_task(channel, task_id, status) | Update task status |
| create_task(channel, title) | Create a new task |
| reload_objective(tile_id) | Get latest objective |
| pause_task(channel, task_id, reason) | Pause a task |
| get_context(tile_id) | Read context files |
| notify(channel, message) | Send notification |

Your tile channel: tile:tile-1779176041759

## Rules
1. Re-read this file when you receive a reload signal
2. Update task status via MCP tools as you work
3. Call notify when you need human attention

Generated: 2026-05-19T07:34:02.984Z