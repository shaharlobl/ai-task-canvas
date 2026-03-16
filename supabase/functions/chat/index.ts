import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the Kanban board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          status: { type: "string", enum: ["todo", "in_progress", "completed"], description: "Task status column" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
          category: { type: "string", description: "Task category/tag" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task's properties",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "completed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string" },
          category: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task by ID",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID to delete" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_tasks",
      description: "Move one or more tasks to a different status column",
      parameters: {
        type: "object",
        properties: {
          task_ids: { type: "array", items: { type: "string" }, description: "Array of task UUIDs to move" },
          status: { type: "string", enum: ["todo", "in_progress", "completed"], description: "Target status" },
        },
        required: ["task_ids", "status"],
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const supabase = getSupabase();

  switch (name) {
    case "create_task": {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: args.title as string,
          description: (args.description as string) || "",
          status: (args.status as string) || "todo",
          priority: (args.priority as string) || "medium",
          due_date: (args.due_date as string) || null,
          category: (args.category as string) || "",
          position: 0,
        })
        .select()
        .single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, task: data });
    }
    case "update_task": {
      const { id, ...updates } = args;
      const cleanUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) cleanUpdates[k] = v;
      }
      const { error } = await supabase.from("tasks").update(cleanUpdates).eq("id", id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true });
    }
    case "delete_task": {
      const { error } = await supabase.from("tasks").delete().eq("id", args.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true });
    }
    case "move_tasks": {
      const ids = args.task_ids as string[];
      const status = args.status as string;
      for (const id of ids) {
        await supabase.from("tasks").update({ status }).eq("id", id);
      }
      return JSON.stringify({ success: true, moved: ids.length });
    }
    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, tasks } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build board context
    const boardSummary = tasks && tasks.length > 0
      ? `Current board state:\n${JSON.stringify(tasks, null, 2)}`
      : "The board is currently empty.";

    const systemPrompt = `You are an AI Kanban board agent. You help users manage their tasks.

${boardSummary}

You can:
- Create, update, delete, and move tasks using the provided tools
- Answer questions about the board state
- Give productivity advice and prioritization suggestions

When the user asks you to create/move/update/delete tasks, use the appropriate tool. After using tools, briefly confirm what you did.
Keep responses concise and helpful. Use markdown formatting.`;

    let aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Loop for tool calling
    let maxIterations = 5;
    while (maxIterations-- > 0) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const t = await response.text();
        console.error("AI gateway error:", status, t);
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) break;

      aiMessages.push(assistantMsg);

      // If the model wants to call tools
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const tc of assistantMsg.tool_calls) {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
          const toolResult = await executeTool(tc.function.name, args);
          aiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        continue; // Let the model process tool results
      }

      // No tool calls — stream the final response
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        // Fall back to the non-streamed content
        const content = assistantMsg.content || "Done.";
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }
        );
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Fallback
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Done!" } }] })}\n\ndata: [DONE]\n\n`,
      { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
