import { NextRequest } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPT } from "@/lib/openai";
import { prepareDataForPrompt, type ParsedData } from "@/lib/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const { question, data, history } = (await request.json()) as {
      question: string;
      data: ParsedData;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!question || !data) {
      return new Response(
        JSON.stringify({ error: "Se requiere una pregunta y datos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const dataContext = prepareDataForPrompt(data);

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nDatos del usuario:\n${dataContext}`,
      },
    ];

    // Add conversation history (last 10 messages to keep context manageable)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    const openai = getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Chat API error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
