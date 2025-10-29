// place files you want to import through the `$lib` alias in this folder.

import type { ModelMessage } from 'ai';

export type WSMessage = {
  type: 'history'
  messages: ModelMessage[];
  currentMessage: string | null;
}|{
  type: 'partial',
  message: string;
}| {
  type: 'end',
} | {
  type: 'error',
  error: 'already generating';
}| {
  type: 'user',
  message: string;
}|{
	type: 'userInfo';
	count: number;
}

export type UserWSMessage = {
	type: 'message'
	content: string;
}
