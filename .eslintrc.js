module.exports = {
	env: {
		browser: true,
		es6: true,
		node: true
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended'
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12
	},
	plugins: [
		'@typescript-eslint'
	],
	rules: {
		indent: [
			'warn',
			'tab',
			{
				SwitchCase: 1,
				ignoredNodes: ['ConditionalExpression'],
			},
		],
		quotes: [
			'warn',
			'single',
			{ allowTemplateLiterals: true, avoidEscape: true  },
		],
		'prefer-rest-params': 'off',
		'linebreak-style': [
			'warn',
			'unix'
		],
		semi: [
			'warn',
			'always'
		],
		radix: [
			'error',
		],
		'@typescript-eslint/no-empty-interface': [
			'warn',
			{
			  'allowSingleExtends': true
			}
		],
		'no-trailing-spaces': 'warn',
		'no-unused-labels': 'error',
		'no-new-wrappers': 'error',
		'no-debugger': 'error',
		'no-eval': 'error',
		'no-redeclare': 'off',
		'no-underscore-dangle': 'off',
		'no-multiple-empty-lines': [
			'warn',
			{
				'max': 2
			}
		],
		'no-caller': 'error',
		'no-console': [
			'error',
			{
				'allow': [
					'log',
					'warn',
					'dir',
					'timeLog',
					'assert',
					'clear',
					'count',
					'countReset',
					'group',
					'groupEnd',
					'table',
					'dirxml',
					'error',
					'groupCollapsed',
					'Console',
					'profile',
					'profileEnd',
					'timeStamp',
					'context'
				]
			}
		],
		'eol-last': 'error',
		'eqeqeq': [
			'error',
			'smart'
		],
		'guard-for-in': 'error',
		'no-case-declarations': 'off',
		'no-sparse-arrays': 'off',
		'no-empty-pattern': 'off',
		'no-cond-assign': 'off',
		'no-unused-vars': 'off',
		'prefer-const': 'off',
		'id-denylist': 'off',
		'id-match': 'off',
		'no-empty': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/triple-slash-reference': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/no-var-requires': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/ban-types' : 'off',
		'no-mixed-spaces-and-tabs' : 'off',
		'no-constant-condition': 'off',
		'@typescript-eslint/no-unused-vars': [
			'warn',
			{ argsIgnorePattern: '^_' }
		],
	},
	ignorePatterns: [
		'build',
		'tools',
		'src/scripts',
		'src/ts/generated/',
		'node_modules'
	],
};
