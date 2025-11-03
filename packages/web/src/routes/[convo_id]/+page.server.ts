import { PUBLIC_BASE_URL } from '$env/static/public';
import type { WSMessage } from '$lib';

export const load = async ({ params, platform }) => {
	const historyRes = await platform?.env.WS.fetch(PUBLIC_BASE_URL + '/history?convoId=' + params.convo_id);
	if (!historyRes || !historyRes.ok) {
		console.error('Failed to fetch history:', historyRes);
		return { history: { type: 'history', messages: [], currentMessage: '' } };
	}

	const history: WSMessage & { type: 'history' } = await historyRes.json();

	return {
		history,
	};
};
