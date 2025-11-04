import { OpenAPIRoute, Str } from 'chanfana';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { type AppContext } from '../types';
import { start } from 'repl';

export class ListRoute extends OpenAPIRoute {
	schema = {
		tags: ['LLM'],
		summary: 'List all chats',
		request: {
		},
		responses: {
			'200': {
				description: 'List of all chats',
				content: {
					'application/json': {
						schema: z.array(Str({
							description: 'ID of the chat',
						})),
					},
				},
			},
		},
	};

	async handle(_c: AppContext) {
		// Get validated data
		const { keys } = await env.KV.list();

		let chats =  keys.map(k => {
			const metadata = k.metadata;
			if (typeof metadata !== 'object' || metadata === null) return null;
			if (!('startText' in metadata)) return null;
			if (!('startDateMs' in metadata)) return null;

			return {
				chatId: k.name,
				startText: metadata.startText,
				startDateMs: metadata.startDateMs,
			};
		}).filter(v => v !== null).sort((a, b) => {
			return (b!.startDateMs as number) - (a!.startDateMs as number);
		});
		console.log('Listing chats:', chats);
		return chats;
	}
}
