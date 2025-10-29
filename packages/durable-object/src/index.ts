import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WSRoute } from './endpoints/ws';
import { WebSocketHibernationServer } from './lib/DO';
import { HistoryRoute } from './endpoints/history';
import { NewRoute } from './endpoints/new';

// Start a Hono app
const app = new Hono<{ Bindings: Env }>;

app.use('*', cors());

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: '/',
});

// Register OpenAPI endpoints
openapi.get('/ws', WSRoute);
openapi.get('/history', HistoryRoute);
openapi.post('/new', NewRoute);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;

export { WebSocketHibernationServer };
