import { OpenAPIRoute, Str } from 'chanfana';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { type AppContext } from '../types';

export class HistoryRoute extends OpenAPIRoute {
	schema = {
		tags: ['LLM'],
		summary: 'Return chat history',
		request: {
			query: z.object({
				convoId: Str({
					description: 'ID of the conversation to attach WS to',
				}),
			}),
		},
		responses: {
			'101': {
				description: 'Upgrades to WS connection',
			},
			'426': {
				description: 'Upgrade Required',
			},
		},
	};

	async handle(_c: AppContext) {
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		const { convoId } = data.query;
		try {
		// Retrieve the validated parameters
			const hibernationDOId = env.WEBSOCKET_HIBERNATION_SERVER.idFromString(convoId);

			const hibernationDO = env.WEBSOCKET_HIBERNATION_SERVER.get(hibernationDOId);

			return hibernationDO.getHistory();
		} catch (error) {
			console.error('Error fetching history for conversation ID:', convoId, error);
			return new Response('Internal Server Error', { status: 500 });
		}
	}
}
