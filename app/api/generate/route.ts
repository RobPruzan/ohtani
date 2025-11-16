import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const runtime = "edge";

interface GenerateRequest {
  goal: string;
  customInstructions?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { goal, customInstructions } = (await req.json()) as GenerateRequest;

    if (!goal || typeof goal !== "string") {
      return new Response(JSON.stringify({ error: "Goal is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_API_KEY environment variable is not set",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Step 1: Send the goal immediately
          send({ type: "goal", goal });

          // Step 2: Generate 8 pillars using structured output
          const pillarsPrompt = `You are a world-class life coach and goal planner using the Harada Method.

The Harada Method was created by Takashi Harada, a Japanese coach who used it to take a last-place team to #1 in their region.

Your task: Analyze the user's main goal and generate 8 critical, high-level categories or supporting pillars required to achieve it.

Main Goal: "${goal}"
${customInstructions ? `\nAdditional Instructions: ${customInstructions}` : ''}

Generate exactly 8 unique, concise pillar titles. These should be fundamental areas that support achieving the goal.

For reference, when Shohei Ohtani used this method for "Be the #1 draft pick for 8 NPB teams", his 8 pillars were:
• Body
• Control
• Sharpness
• Speed
• Pitch Variance
• Personality
• Karma/Luck
• Mental Toughness`;

          let pillarsResponse;
          let retries = 0;
          const maxRetries = 3;

          while (retries < maxRetries) {
            try {
              pillarsResponse = await generateObject({
                model: anthropic("claude-sonnet-4-5-20250929"),
                prompt: pillarsPrompt,
                schema: z.object({
                  pillars: z.array(z.string()).length(8),
                }),
              });
              break; // Success, exit retry loop
            } catch (error) {
              retries++;
              if (retries >= maxRetries) {
                throw new Error(`Failed to generate pillars after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          const pillarTitles = pillarsResponse.object.pillars;

          // Send each pillar as it's available
          for (let i = 0; i < pillarTitles.length; i++) {
            send({ type: "pillar", index: i, title: pillarTitles[i] });
          }

          // Step 3: Generate tasks for each pillar sequentially
          for (let i = 0; i < pillarTitles.length; i++) {
            const pillarTitle = pillarTitles[i];

            // Signal that we're starting to generate tasks for this pillar
            send({ type: 'generating_tasks', pillarIndex: i });

            const tasksPrompt = `You are an expert action planner using the Harada Method.

Main Goal: "${goal}"
Pillar: "${pillarTitle}"
${customInstructions ? `\nAdditional Instructions: ${customInstructions}` : ''}

Generate 8 concrete, daily, and immediately actionable tasks or routines for this pillar.

Important:
- Focus on measurable, small steps
- These should be daily habits or regular actions
- Be specific and practical
- The Harada Method emphasizes service to others and humility

For example, for Shohei Ohtani's "Karma/Luck" pillar, his tasks included:
• Picking up trash
• Showing respect to umpires
• Being positive
• Being someone people want to support`;

            let tasksResponse;
            let taskRetries = 0;
            const taskMaxRetries = 3;

            while (taskRetries < taskMaxRetries) {
              try {
                tasksResponse = await generateObject({
                  model: anthropic("claude-sonnet-4-5-20250929"),
                  prompt: tasksPrompt,
                  schema: z.object({
                    tasks: z.array(z.string()).length(8),
                  }),
                });
                break; // Success, exit retry loop
              } catch (error) {
                taskRetries++;
                if (taskRetries >= taskMaxRetries) {
                  throw new Error(`Failed to generate tasks for pillar "${pillarTitle}" after ${taskMaxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }

            send({ type: "tasks", pillarIndex: i, tasks: tasksResponse!.object.tasks });
          }

          // Send completion
          send({ type: "complete" });
          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate plan",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
