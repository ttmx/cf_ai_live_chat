import { OpenAPIRoute, Str } from 'chanfana';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { type AppContext } from '../types';

export class WSRoute extends OpenAPIRoute {
	schema = {
		tags: ['LLM'],
		summary: 'Return stream with prompt',
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

	async handle(c: AppContext) {
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve the validated parameters
		const { convoId } = data.query;
		const hibernationDOId = env.WEBSOCKET_HIBERNATION_SERVER.idFromString(convoId);
		const hibernationDO = env.WEBSOCKET_HIBERNATION_SERVER.get(hibernationDOId);

		const upgradeHeader = c.req.header('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Worker expected Upgrade: websocket', {
				status: 426,
			});
		}
		return hibernationDO.fetch(c.req.raw);
	}
}
