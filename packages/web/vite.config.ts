import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
	// https://github.com/automerge/automerge/blob/main/javascript/examples/vite/vite.config.js + sveltekit
	plugins: [
		topLevelAwait(),
		wasm(),
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	],
	optimizeDeps: {
		// This is necessary because otherwise `vite dev` includes two separate
		// versions of the JS wrapper. This causes problems because the JS
		// wrapper has a module level variable to track JS side heap
		// allocations, initializing this twice causes horrible breakage
		exclude: ['@automerge/automerge-wasm'],
	},
});
