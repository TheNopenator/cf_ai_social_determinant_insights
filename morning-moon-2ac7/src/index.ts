import { DurableObject } from "cloudflare:workers";
import { UserContextDO } from "../src/memory";

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

// Export UserContextDO for Durable Object binding
export { UserContextDO };

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject<Env> {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param name - The name provided to a Durable Object instance from a Worker
	 * @returns The greeting to be sent back to the Worker
	 */
	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;

		try {
			// Route: POST /chat - Main chat endpoint
			if (method === "POST" && pathname === "/chat") {
				return await handleChat(request, env);
			}

			// Route: POST /risk - Enter numeric risk factors
			if (method === "POST" && pathname === "/risk") {
				return await handleRisk(request, env);
			}

			// Route: GET /context - Returns current Durable Object state
			if (method === "GET" && pathname === "/context") {
				return await handleGetContext(request, env);
			}

			// Route: GET /analytics - Admin view with JSON stats
			if (method === "GET" && pathname === "/analytics") {
				return await handleGetAnalytics(request, env);
			}

			// Default: Route not found
			return new Response(JSON.stringify({ error: "Route not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("Worker error:", error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	},
} satisfies ExportedHandler<Env>;

const SYSTEM_PROMPT = `You are a medical insight assistant specializing in social determinants of health.
Use the user's history and risk context when responding.
Always be clear, explain mechanisms, and avoid giving medical advice.`;

/**
 * Handle POST /chat - Main chat endpoint for interacting with AI
 * Expects: { userId: string, message: string }
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
	try {
		const { userId, message } = (await request.json()) as { userId: string; message: string };

		if (!userId || !message) {
			return new Response(JSON.stringify({ error: "Missing userId or message" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get or create Durable Object instance for this user
		const stub = env.USER_CONTEXT.get(userId);

		// Get current user memory context
		const contextResponse = await stub.fetch(new Request(new URL("http://localhost/memory"), { method: "GET" }));
		const memory = await contextResponse.json();

		// Add the new question to memory
		const updateResponse = await stub.fetch(
			new Request(new URL("http://localhost/memory"), {
				method: "POST",
				body: JSON.stringify({
					conversation: {
						recentQuestions: [...(memory.conversation?.recentQuestions || []), message],
					},
				}),
			})
		);
		const updatedMemory = await updateResponse.json();

		// Build comprehensive prompt for Llama
		const prompt = buildLlamaPrompt(message, updatedMemory);

		// Call Llama 3.3 via Cloudflare Workers AI
		const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8", {
			messages: [
				{
					role: "system",
					content: SYSTEM_PROMPT,
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 300,
		}) as { response: string };

		// Update memory with the insight from AI response
		await stub.fetch(
			new Request(new URL("http://localhost/memory"), {
				method: "POST",
				body: JSON.stringify({
					conversation: {
						keyInsights: [...(updatedMemory.conversation?.keyInsights || []), aiResponse.response.substring(0, 150)],
					},
				}),
			})
		);

		// Log analytics to KV
		await logAnalytics(env.ANALYTICS, {
			event: "chat",
			userId,
			timestamp: Date.now(),
			messageLength: message.length,
			responseLength: aiResponse.response.length,
			riskFactorsCount: updatedMemory.profile.riskFactors?.length || 0,
		});

		return new Response(
			JSON.stringify({
				userId,
				userMessage: message,
				aiResponse: aiResponse.response,
				context: {
					riskFactors: updatedMemory.profile.riskFactors,
					conditions: updatedMemory.profile.conditions,
					recentQuestions: updatedMemory.conversation.recentQuestions.slice(-3),
				},
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		console.error("Chat handler error:", error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Handle POST /risk - Enter numeric risk factors
 * Expects: { userId: string, riskFactors: string[], conditions: string[] }
 */
async function handleRisk(request: Request, env: Env): Promise<Response> {
	try {
		const { userId, riskFactors, conditions } = (await request.json()) as {
			userId: string;
			riskFactors?: string[];
			conditions?: string[];
		};

		if (!userId) {
			return new Response(JSON.stringify({ error: "Missing userId" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get or create Durable Object instance for this user
		const stub = env.USER_CONTEXT.get(userId);

		// Update the user's risk factors and conditions in the Durable Object
		const memoryResponse = await stub.fetch(
			new Request(new URL("http://localhost/memory"), {
				method: "POST",
				body: JSON.stringify({
					profile: {
						riskFactors: riskFactors || [],
						conditions: conditions || [],
					},
				}),
			})
		);

		const updatedMemory = await memoryResponse.json();

		// Log analytics to KV
		await logAnalytics(env.ANALYTICS, {
			event: "risk_update",
			userId,
			timestamp: Date.now(),
			riskFactorsCount: riskFactors?.length || 0,
			conditionsCount: conditions?.length || 0,
		});

		return new Response(
			JSON.stringify({
				userId,
				message: "Risk factors updated successfully",
				profile: updatedMemory.profile,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Handle GET /context - Returns current Durable Object state
 * Query params: userId (required)
 */
async function handleGetContext(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const userId = url.searchParams.get("userId");

		if (!userId) {
			return new Response(JSON.stringify({ error: "Missing userId query parameter" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get the Durable Object instance for this user
		const stub = env.USER_CONTEXT.get(userId);

		// Fetch the current memory state
		const memoryResponse = await stub.fetch(new Request(new URL("http://localhost/memory"), { method: "GET" }));
		const memory = await memoryResponse.json();

		return new Response(JSON.stringify({ userId, memory }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Build a comprehensive prompt for Llama 3.3 including:
 * - User question
 * - DO summary (previous insights)
 * - Risk factors dictionary
 * - Chat history summary
 */
function buildLlamaPrompt(userQuestion: string, memory: any): string {
	const parts: string[] = [];

	// Risk Factors Dictionary
	if (memory.profile.riskFactors?.length > 0) {
		parts.push(`## Risk Factors: ${memory.profile.riskFactors.join(", ")}`);
	}

	// Known Conditions
	if (memory.profile.conditions?.length > 0) {
		parts.push(`## Known Conditions: ${memory.profile.conditions.join(", ")}`);
	}

	// DO Summary (Key Insights)
	if (memory.conversation.keyInsights?.length > 0) {
		parts.push(`## Previous Insights Summary:\n${memory.conversation.keyInsights.slice(-2).join("\n")}`);
	}

	// Chat History Summary (brief - last 3 questions)
	if (memory.conversation.recentQuestions?.length > 0) {
		const recentQuestions = memory.conversation.recentQuestions.slice(-3);
		parts.push(`## Recent Questions:\n- ${recentQuestions.join("\n- ")}`);
	}

	// Current User Question
	parts.push(`## Current Question:\n${userQuestion}`);

	return parts.join("\n\n");
}

/**
 * Build a formatted context string from user memory for AI consumption
 */
function buildUserContext(memory: any): string {
	const parts: string[] = [];

	if (memory.profile.riskFactors?.length > 0) {
		parts.push(`Risk Factors: ${memory.profile.riskFactors.join(", ")}`);
	}

	if (memory.profile.conditions?.length > 0) {
		parts.push(`Known Conditions: ${memory.profile.conditions.join(", ")}`);
	}

	if (memory.profile.interests?.length > 0) {
		parts.push(`Interests: ${memory.profile.interests.join(", ")}`);
	}

	if (memory.conversation.keyInsights?.length > 0) {
		parts.push(`Previous Insights: ${memory.conversation.keyInsights.slice(-3).join("; ")}`);
	}

	return parts.length > 0 ? parts.join("\n") : "No prior context available";
}

/**
 * Log an analytics event to KV
 */
async function logAnalytics(kv: KVNamespace, event: Record<string, any>): Promise<void> {
	try {
		// Create a unique key with timestamp
		const timestamp = Date.now();
		const key = `analytics:${event.event}:${timestamp}`;

		// Store the event
		await kv.put(key, JSON.stringify(event), { expirationTtl: 7 * 24 * 60 * 60 }); // 7 days

		// Update aggregate counters
		const countKey = `count:${event.event}`;
		const currentCount = await kv.get(countKey);
		const newCount = currentCount ? JSON.parse(currentCount).count + 1 : 1;
		await kv.put(countKey, JSON.stringify({ count: newCount, lastUpdated: timestamp }), { expirationTtl: 30 * 24 * 60 * 60 }); // 30 days
	} catch (error) {
		console.error("Failed to log analytics:", error);
	}
}

/**
 * Handle GET /analytics - Returns analytics stats
 */
async function handleGetAnalytics(request: Request, env: Env): Promise<Response> {
	try {
		const stats = {
			timestamp: Date.now(),
			events: {} as Record<string, any>,
		};

		// Fetch event counters
		const chatCount = await env.ANALYTICS.get("count:chat");
		const riskUpdateCount = await env.ANALYTICS.get("count:risk_update");

		if (chatCount) {
			const data = JSON.parse(chatCount);
			stats.events.chat = {
				count: data.count,
				lastUpdated: data.lastUpdated,
			};
		}

		if (riskUpdateCount) {
			const data = JSON.parse(riskUpdateCount);
			stats.events.risk_update = {
				count: data.count,
				lastUpdated: data.lastUpdated,
			};
		}

		// Calculate totals
		const totalEvents = (stats.events.chat?.count || 0) + (stats.events.risk_update?.count || 0);
		stats.events.total = totalEvents;

		return new Response(JSON.stringify(stats, null, 2), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Analytics retrieval error:", error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
