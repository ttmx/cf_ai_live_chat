import { PUBLIC_BASE_URL } from '$env/static/public';
import type { WSMessage } from '$lib';

export const load = async ({fetch, params}) => {
  const historyRes = await fetch("http://" + PUBLIC_BASE_URL + '/history?convoId=' + params.convo_id);

  const history: WSMessage & { type: 'history' } = await historyRes.json();

  return {
    history
  };
};