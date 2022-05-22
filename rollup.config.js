const path = require('path');
const alias = require('@rollup/plugin-alias');
const del = require('rollup-plugin-delete');
const preload = require('./index');

console.log(new Date().toLocaleString());
export default {
	input: ['src/entry.js'],
	output: {
		dir: "dist",
		format: 'esm',
		interop: false,
		strict: false,
		assetFileNames: "assets/[name].[hash][extname]",
		chunkFileNames: "assets/[name].[hash].js",
		entryFileNames: "[name].js",
	},
	plugins: [
		alias({
			entries: {
				'@': path.resolve(__dirname, './src')
			}
		}),
		del({ targets: 'dist/*' }),
		preload({
			dynamicImportFunction: "__rollup_dynamic_import__",
			baseURIVariable: "__rollup_baseURI__",
			publicPath: "/",
			css: {
				// minify: true,
				sass: {
					additionalData(id) {
						if(id.endsWith(".scss")) {
							return `$primary:blue;`;
						} else {
							return `$primary: blue\n`;
						}
					}
				}
			}
		})
	],
};
