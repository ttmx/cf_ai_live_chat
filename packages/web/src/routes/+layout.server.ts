import { PUBLIC_BASE_URL } from '$env/static/public';

export const load = async ({ fetch, platform }) => {
	try {
		const res = await platform?.env.WS.fetch(PUBLIC_BASE_URL + '/list');
		if (!res) {
			console.error('platform unavailable', res);
			return { chats: [] };
		}
		const data: {
    chatId: string;
    startText: string;
  }[] = await res.json();
		return { chats: data };
	} catch (e) {
		console.error('Error fetching chat list:', e);
		return { chats: [] };
	}
};
