# rollup-plugin-preload

Preload static imports of a chunk when it is dynamically imported

## Feature

* preload CSS
* preload image
* generate CSS chunk by js chunk
* sass
* postcss
* CSS modules
* CSS minify
* CSS use rollup resolve id
* asset use rollup asset

## Config Example

```javascript
const preload = require('rollup-plugin-preload');

preload({
	dynamicImportFunction: "__rollup_dynamic_import__",
	baseURIVariable: "__rollup_baseURI__",
	publicPath: "./",
	css: {
		// minify: true,
		sass: {
			additionalData(id) {
				if(id.endsWith(".scss")) {
					return `$primary: blue;`;
				} else {
					return `$primary: blue\n`;
				}
			}
		}
	}
})
```

## TODO

* less
* stylus
* sugarss
