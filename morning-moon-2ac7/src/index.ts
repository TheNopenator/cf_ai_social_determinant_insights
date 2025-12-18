import { UserContextDO } from "./memory";

const SYSTEM_PROMPT = `You are a medical insight assistant specializing in social determinants of health.
Use the user's history and risk context when responding.
Always be clear, explain mechanisms, and avoid giving medical advice.`;

function getCORSHeaders(): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};
}

function withCORS(response: Response): Response {
	const newResponse = new Response(response.body, response);
	Object.entries(getCORSHeaders()).forEach(([key, value]) => {
		newResponse.headers.set(key, value);
	});
	return newResponse;
}

export { UserContextDO };

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;

		if (method === "OPTIONS") {
			return new Response(null, { status: 204, headers: getCORSHeaders() });
		}

		try {
			if (method === "POST" && pathname === "/chat") {
				return withCORS(await handleChat(request, env));
			}
			if (method === "POST" && pathname === "/risk") {
				return withCORS(await handleRisk(request, env));
			}
			if (method === "GET" && pathname === "/context") {
				return withCORS(await handleGetContext(request, env));
			}
			if (method === "GET" && pathname === "/analytics") {
				return withCORS(await handleGetAnalytics(request, env));
			}

			return withCORS(new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } }));
		} catch (error) {
			console.error("Error:", error);
			return withCORS(new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } }));
		}
	},
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env): Promise<Response> {
	const { userId, message } = (await request.json()) as { userId: string; message: string };
	if (!userId || !message) throw new Error("Missing userId or message");

	const id = env.USER_CONTEXT.idFromName(userId);
	const stub = env.USER_CONTEXT.get(id);
	const memReq = new Request("http://localhost/memory", { method: "GET" });
	const memRes = await stub.fetch(memReq);
	const memory = await memRes.json();

	const updateReq = new Request("http://localhost/memory", {
		method: "POST",
		body: JSON.stringify({ conversation: { recentQuestions: [...(memory.conversation?.recentQuestions || []), message] } }),
	});
	const updateRes = await stub.fetch(updateReq);
	const updatedMemory = await updateRes.json();

	// Generate response using AI model
	const responseText = await generateMedicalInsight(message, updatedMemory, env);
	const aiResponse = { response: responseText };

	await stub.fetch(new Request("http://localhost/memory", {
		method: "POST",
		body: JSON.stringify({ conversation: { keyInsights: [...(updatedMemory.conversation?.keyInsights || []), aiResponse.response.substring(0, 150)] } }),
	}));

	return new Response(JSON.stringify({
		userId,
		userMessage: message,
		aiResponse: aiResponse.response,
		context: { riskFactors: updatedMemory.profile.riskFactors, conditions: updatedMemory.profile.conditions },
	}), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleRisk(request: Request, env: Env): Promise<Response> {
	const { userId, riskFactors, conditions } = (await request.json()) as { userId: string; riskFactors?: string[]; conditions?: string[] };
	if (!userId) throw new Error("Missing userId");

	const id = env.USER_CONTEXT.idFromName(userId);
	const stub = env.USER_CONTEXT.get(id);
	const res = await stub.fetch(new Request("http://localhost/memory", {
		method: "POST",
		body: JSON.stringify({ profile: { riskFactors: riskFactors || [], conditions: conditions || [] } }),
	}));
	const updatedMemory = await res.json();

	return new Response(JSON.stringify({ userId, message: "Updated", profile: updatedMemory.profile }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleGetContext(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const userId = url.searchParams.get("userId");
	if (!userId) throw new Error("Missing userId");

	const id = env.USER_CONTEXT.idFromName(userId);
	const stub = env.USER_CONTEXT.get(id);
	const res = await stub.fetch(new Request("http://localhost/memory", { method: "GET" }));
	const memory = await res.json();

	return new Response(JSON.stringify({ userId, memory }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleGetAnalytics(request?: Request, env?: Env): Promise<Response> {
	return new Response(JSON.stringify({ timestamp: Date.now(), status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
}


async function generateMedicalInsight(question: string, memory: any, env: Env): Promise<string> {
	try {
		const prompt = buildAIPrompt(question, memory);
		
		const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			prompt: prompt,
			max_tokens: 512,
			temperature: 0.7,
		}) as { response: string };
		
		return response.response || "I could not generate a response at this time. Please try again.";
	} catch (error) {
		console.error("AI generation error:", error);
		// Fallback to basic response if AI fails
		return `I encountered an issue generating a detailed response. Here's what I can tell you:

Your question was about: ${question}

${memory.profile.riskFactors.length > 0 ? `**Your Risk Factors:** ${memory.profile.riskFactors.join(", ")}` : ""}
${memory.profile.conditions.length > 0 ? `**Your Conditions:** ${memory.profile.conditions.join(", ")}` : ""}

Please try rephrasing your question or ask about a specific health topic. I specialize in social determinants of health, lifestyle factors, and preventive care.`;
	}
}

function buildAIPrompt(question: string, memory: any): string {
	let prompt = `${SYSTEM_PROMPT}

User Context:
${memory.profile.riskFactors.length > 0 ? `Risk Factors: ${memory.profile.riskFactors.join(", ")}` : "No known risk factors"}
${memory.profile.conditions.length > 0 ? `Existing Conditions: ${memory.profile.conditions.join(", ")}` : "No conditions reported"}

${memory.conversation?.recentQuestions?.length > 0 ? `Previous questions: ${memory.conversation.recentQuestions.slice(-3).join(", ")}` : ""}

User Question: ${question}

Please provide a clear, evidence-based response about health and social determinants. Format your response with markdown where appropriate (**bold** for emphasis, bullet points for lists). Be specific and practical.`;

	return prompt;
}
