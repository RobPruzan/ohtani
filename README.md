# The Harada Method - 64-Cell Goal Planner

A Next.js application that helps you create a personalized 64-cell roadmap using the Harada Method, inspired by Shohei Ohtani's goal-setting framework.

## What is the Harada Method?

The Harada Method was created by Takashi Harada, a Japanese junior high track coach who transformed a last-place team into regional champions. The method uses a 9x9 grid structure:

- **1 Central Goal**: Your main objective (center of the grid)
- **8 Core Pillars**: Critical supporting categories surrounding your goal
- **64 Actionable Tasks**: 8 specific tasks for each pillar (8 pillars × 8 tasks = 64 cells)

When Shohei Ohtani was a high school freshman, he used this method to become the #1 draft pick, with pillars like Body, Control, Speed, Mental Toughness, and even Karma/Luck (which included actions like "picking up trash" and "showing respect to umpires").

## Features

- 🎯 AI-powered generation of personalized 8 pillars based on your goal
- 📋 Automatic creation of 64 actionable tasks (8 per pillar)
- 🎨 Beautiful 9x9 grid visualization
- 🤖 Powered by Anthropic's Claude Sonnet 4.5
- ⚡ Built with Next.js and AI SDK

## Setup

1. **Clone the repository**

2. **Install dependencies**

```bash
npm install
# or use ni (auto-detects package manager)
ni
```

3. **Set up your API key**

Create a `.env.local` file in the root directory:

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from [Anthropic Console](https://console.anthropic.com/)

4. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How It Works

1. Enter your main goal (e.g., "Launch a successful tech startup")
2. Click "Generate My 64-Cell Plan"
3. The AI analyzes your goal and generates:
   - 8 critical pillars needed to achieve your goal
   - 8 specific, actionable tasks for each pillar
4. View your complete plan in the 9×9 grid format

## Tech Stack

- **Next.js 16** - React framework
- **AI SDK** - Vercel's AI SDK for LLM integration
- **Anthropic Claude Sonnet 4.5** - AI model for generation
- **Tailwind CSS 4** - Styling
- **TypeScript** - Type safety

## Deploy

Deploy easily on [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add `ANTHROPIC_API_KEY` to environment variables
4. Deploy

## License

MIT
