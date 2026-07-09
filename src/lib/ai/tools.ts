import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

// Tool definitions sent to Claude, plus the server-side functions that
// execute them. Keeping this as a fixed, named set (rather than something
// like a generic SQL or code-execution tool) means every query the model can
// run against user data is one we've explicitly reviewed.

export const AI_CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_users",
    description:
      "Search the unified user directory by name or email substring. Returns basic identifying info for matches so you can look one up in more detail with get_amplitude_profile or get_custom_fields.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or email substring to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_amplitude_profile",
    description:
      "Get a user's Amplitude activity profile (last seen, session counts, goal/partner-invite counts, etc). Call search_users first to find the userId if you don't already have it.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The internal user id (from search_users)" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_custom_fields",
    description:
      "Get the admin-defined custom field values (labels, notes, links, etc) an admin has set on a user's page.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The internal user id (from search_users)" },
      },
      required: ["userId"],
    },
  },
  {
    name: "render_chart",
    description:
      "Display a simple bar or line chart to the admin in the chat panel. Use this when a visual comparison (e.g. session counts across a few users) would be clearer than a text table. Only the most recent call in a turn is shown.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bar", "line"] },
        title: { type: "string" },
        data: {
          type: "array",
          description: "Data points to plot, in order",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "number" },
            },
            required: ["label", "value"],
          },
        },
      },
      required: ["type", "title", "data"],
    },
  },
];

type ToolResult = { toolUseId: string; content: string; isError?: boolean };

export async function runTool(name: string, input: any, toolUseId: string): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_users": {
        const query = String(input?.query ?? "").trim();
        if (!query) return { toolUseId, content: "query is required", isError: true };

        const users = await db.user.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, email: true },
          take: 20,
        });
        return { toolUseId, content: JSON.stringify(users) };
      }

      case "get_amplitude_profile": {
        const userId = String(input?.userId ?? "");
        if (!userId) return { toolUseId, content: "userId is required", isError: true };

        const profile = await db.amplitudeProfile.findUnique({
          where: { userId },
          select: {
            lastSeenAt: true,
            firstSeenAt: true,
            totalEvents: true,
            sessionCount: true,
            goalCompletedCount: true,
            goalSharedCount: true,
            partnerInvitedCount: true,
            partnerAcceptedAt: true,
            deviceType: true,
            platform: true,
          },
        });
        if (!profile) {
          return { toolUseId, content: "No Amplitude profile found for this user." };
        }
        return { toolUseId, content: JSON.stringify(profile) };
      }

      case "get_custom_fields": {
        const userId = String(input?.userId ?? "");
        if (!userId) return { toolUseId, content: "userId is required", isError: true };

        const values = await db.customFieldValue.findMany({
          where: { userId },
          select: {
            value: true,
            labelValues: true,
            field: { select: { name: true, type: true } },
          },
        });
        return { toolUseId, content: JSON.stringify(values) };
      }

      case "render_chart": {
        // Nothing to execute server-side — the chart spec is picked up
        // client-side from the tool_use block itself. Just acknowledge it
        // so the tool-use loop can continue.
        return { toolUseId, content: "Chart displayed to the admin." };
      }

      default:
        return { toolUseId, content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return {
      toolUseId,
      content: err instanceof Error ? err.message : "Tool execution failed",
      isError: true,
    };
  }
}
