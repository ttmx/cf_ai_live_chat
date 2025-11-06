# cf_ai_chat
This project is a collaborative AI chat demo, like ChatGPT, but where multiple users can interact with the session at the same time, seeing other's edits to the input field and to the chat history and generation in real-time.
It uses Automerge for it's nice text CRDT implementation, Cloudflare Durable Objects and WebSockets for real-time scalable communication, Cloudflare Workers KV for conversation listing, Workers AI for actually generating the text, GitHub actions for CI and SvelteKit for the frontend.

It was nice to actually use Automerge and Durable Objects in a project, both of which I wanted to learn, but had no real use case for before.

The project is split into two services: the frontend web app and the Durable Object backend.

## Testing the deployed version
You can test the deployed version at https://chat.tteles.dev

## To run locally
To install dependencies:

```bash
npm install
```

To run:

```bash
npm run dev --workspace=packages/web & npm run dev --workspace=packages/durable-object
```

After setting up wrangler with your CF account, the web UI will be available at http://localhost:5173
This is necessary because of the LLM usage.


## Possible Improvements
There's a few things I would do if I had more time:
 - Using CF PubSub for broadcasting the new Rooms in real time (and perhaps the number of users in each room)
 - Using zod on all inputs
 - Separating types to a shared package