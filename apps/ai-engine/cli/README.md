# AI Engine CLI 🚀

The **AI Engine CLI** is a powerful terminal-based interactive chat client designed for the Ignitic AI Engine. It provides a seamless way to interact with your AI agents directly from your terminal, supporting real-time streaming, tool-call visualization, and session management.

## 📋 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Integration with AI Engine](#integration-with-ai-engine)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
  - [Authentication](#authentication)
  - [Starting a Chat](#starting-a-chat)
  - [Configuration](#configuration)
- [Interactive Chat Commands](#interactive-chat-commands)
- [Troubleshooting](#troubleshooting)

---

## 🔍 Overview

The AI Engine CLI is built using [Typer](https://typer.tiangolo.com/) and [Rich](https://rich.readthedocs.io/), offering a polished and user-friendly command-line interface. Its primary purpose is to provide developers and power users with a fast, keyboard-centric way to test and interact with AI agents without needing to open a web browser.

## ✨ Key Features

- **Real-time Streaming**: Experience low-latency, character-by-character streaming of agent responses.
- **Tool-Call Visualization**: See exactly when an agent invokes a tool, including the parameters being passed.
- **Session Management**: Easily resume previous conversations or start fresh ones.
- **Agent Selection**: Target specific agents for your session or use the server's default orchestration.
- **Model Overrides**: Quickly switch between different LLM models (e.g., GPT-4, DeepSeek) via CLI flags.
- **History Summarization**: Visual notifications when the server performs context window management/summarization.
- **Robust Configuration**: Persist your server URL, authentication tokens, and default preferences locally.

## 🔗 Integration with AI Engine

The CLI acts as a thin client that communicates with the **AI Engine Backend** via:
1. **REST API**: Used for initial configuration and metadata retrieval.
2. **WebSockets**: The core chat experience happens over a persistent WebSocket connection (`/api/v1/chat/ws`), allowing for full-duplex communication and real-time event streaming (chunks, tool calls, status updates).

---

## 🚀 Usage Guide

### 1. Authentication
Before you can chat, you need to provide your JWT token. This token is used to identify you and your permissions.

```bash
ai-engine login
```
*You will be prompted to paste your JWT token. This is stored securely in `~/.ai-engine/config.json`.*

### 2. Starting a Chat
To enter the interactive chat mode:

```bash
ai-engine start
```

**Common Flags:**
- `-a, --agent`: Specify one or more agents (e.g., `ai-engine start -a researcher -a writer`).
- `-m, --model`: Override the default LLM model.
- `-r, --resume`: Continue your last active conversation.
- `--chat-id <id>`: Continue a specific historical chat session.
- `--org`: Use organization-level agents instead of personal ones.

### 3. Configuration
Manage your local environment settings:

- **View Config**: `ai-engine config show`
- **Set Server URL**: `ai-engine config set-server http://your-api-url:8010`
- **Set Default Model**: `ai-engine config set-model "model-id"`
- **Set Default Agents**: `ai-engine config set-agents agent-1 agent-2`
- **Reset Chat ID**: `ai-engine config reset-chat` (Forces the next session to be a new chat)

---

## ⌨️ Interactive Chat Commands

Once inside a chat session, you can use the following commands:

| Command | Description |
| :--- | :--- |
| `/quit` | Exit the chat session |
| `/clear` | Start a new chat (clears active chat ID) |
| `/agents` | Show or change the agent(s) currently in use |
| `/server` | Display the current server URL |
| `/help` | Show the help menu |

---

## 🛠️ Troubleshooting

- **Connection Refused**: Ensure the AI Engine backend is running and that your `server_url` is configured correctly using `ai-engine config set-server`.
- **Authentication Error**: Your token may have expired. Run `ai-engine login` again to update your JWT.
- **WebSocket Timeout**: If you are behind a proxy, ensure it supports long-lived WebSocket connections.

---

*Built with ❤️ by the Ignitic AI Team.*
