import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'url';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));
/** @type { import("eslint").Linter.Config } */
export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		// See more details at: https://typescript-eslint.io/packages/parser/
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'], // Add support for additional file extensions, such as .svelte
				parser: ts.parser,
				// Specify a parser for each language, if needed:
				// parser: {
				//   ts: ts.parser,
				//   js: espree,    // Use espree for .js files (add: import espree from 'espree')
				//   typescript: ts.parser
				// },

				// We recommend importing and specifying svelte.config.js.
				// By doing so, some rules in eslint-plugin-svelte will automatically read the configuration and adjust their behavior accordingly.
				// While certain Svelte settings may be statically loaded from svelte.config.js even if you don’t specify it,
				// explicitly specifying it ensures better compatibility and functionality.
				//
				// If non-serializable properties are included, running ESLint with the --cache flag will fail.
				// In that case, please remove the non-serializable properties. (e.g. `svelteConfig: { ...svelteConfig, kit: { ...svelteConfig.kit, typescript: undefined }}`)
				svelteConfig,
			},
		},
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/rule-name': 'error'
		rules: {
			'svelte/no-at-html-tags': 'off',
			'array-bracket-newline': ['error', 'consistent'],
			'array-bracket-spacing': ['error', 'never'],
			'array-element-newline': ['error', 'consistent'],
			'arrow-parens': ['error', 'as-needed'],
			'arrow-spacing': 'error',
			'block-spacing': ['error', 'always'],
			'brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'comma-dangle': ['error', 'always-multiline'],
			'comma-spacing': ['error', { before: false, after: true }],
			'comma-style': ['error', 'last'],
			'computed-property-spacing': ['error', 'never'],
			'dot-location': ['error', 'property'],
			'eol-last': ['error', 'always'],
			'func-call-spacing': ['error', 'never'],
			'function-call-argument-newline': ['error', 'consistent'],
			'function-paren-newline': ['error', 'consistent'],
			'generator-star-spacing': ['error', { before: false, after: true }],
			'implicit-arrow-linebreak': ['error', 'beside'],
			'indent': ['error', 'tab'],
			'jsx-quotes': ['error', 'prefer-double'],
			'key-spacing': ['error', { beforeColon: false, afterColon: true }],
			'keyword-spacing': ['error', { before: true, after: true }],
			'linebreak-style': ['error', 'unix'],
			'lines-between-class-members': ['error', 'always'],
			'new-parens': ['error', 'never'],
			'no-extra-parens': ['error', 'all', { nestedBinaryExpressions: false }],
			'no-mixed-spaces-and-tabs': 'error',
			'no-multi-spaces': 'error',
			'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
			'no-trailing-spaces': 'error',
			'no-whitespace-before-property': 'error',
			'nonblock-statement-body-position': ['error', 'beside'],
			'object-curly-newline': ['error', { multiline: true, consistent: true }],
			'object-curly-spacing': ['error', 'always'],
			'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
			'operator-linebreak': ['error', 'after'],
			'padded-blocks': ['error', 'never'],
			'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
			'rest-spread-spacing': ['error', 'never'],
			'semi': ['error', 'always'],
			'semi-spacing': ['error', { 'before': false, 'after': true }],
			'semi-style': ['error', 'last'],
			'space-before-blocks': ['error', 'always'],
			'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
			'space-in-parens': ['error', 'never'],
			'space-infix-ops': 'error',
			'space-unary-ops': ['error', { words: true, nonwords: false }],
			'switch-colon-spacing': ['error', { after: true, before: false }],
			'template-curly-spacing': ['error', 'never'],
			'template-tag-spacing': ['error', 'never'],
			'wrap-iife': ['error', 'inside'],
			'yield-star-spacing': ['error', { before: false, after: true }],
			'svelte/indent': ['error', { 'indent': 'tab' }],
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
		},
	},
	{
		files: ['**/*.svelte'],
		rules: {
			// Disable the regular indent rule for Svelte files to avoid conflicts
			'indent': 'off',
		},
	},
	{
		// Note: there should be no other properties in this object
		ignores: ['build/**', 'docs/**', '.svelte-kit/**'],
	},
);
