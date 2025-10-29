import { OpenAPIRoute, Str } from 'chanfana';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { type AppContext } from '../types';

export class NewRoute extends OpenAPIRoute {
	schema = {
		tags: ['LLM'],
		summary: 'Create a new chat, return it\'s ID',
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							message: Str({
								description: 'Initial message to start the chat with',
							}),
						}),
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'Chat created successfully',
				content: {
					'application/json': {
						schema: z.object({
							chatId: Str({
								description: 'ID of the newly created chat',
							}),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve the validated body
		const { message } = data.body;

		const uuid = crypto.randomUUID();
		const hibernationDO = env.WEBSOCKET_HIBERNATION_SERVER.getByName(uuid);
		hibernationDO.submitUserMessage(message);

		return { chatId: uuid };
	}
}
