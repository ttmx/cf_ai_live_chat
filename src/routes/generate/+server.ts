import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async event => {
	const url = new URL(event.request.url);
	const prompt = url.searchParams.get('prompt') || 'Hello, World!';

	// Simulate some processing based on the prompt
	const generatedContent = `Generated content for prompt: "${prompt}"`;

	return new Response(JSON.stringify({ content: generatedContent }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
