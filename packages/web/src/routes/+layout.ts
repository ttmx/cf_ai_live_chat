import { PUBLIC_BASE_URL } from '$env/static/public';

export const load = async ({fetch}) => {
  const res = await fetch("http://" + PUBLIC_BASE_URL + "/list");
  const data: {
    chatId: string;
    startText: string;
  }[] = await res.json();
  return { chats: data };
}