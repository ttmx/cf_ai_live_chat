import { env } from '$env/dynamic/private';

export const load = async ({ params }) => {
	const wsAddress = env.WS_URL;
	return {
		wsAddress: wsAddress,
	};
};
