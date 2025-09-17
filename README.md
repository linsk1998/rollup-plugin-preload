# rollup-plugin-preload

Preload chunk when it is dynamically imported

### Config Example

```javascript
const preload = require('rollup-plugin-preload');

module.exports = {
	plugins: [
		preload()
	]
}
```

### input

```javascript
import('./lib.js');
```

### output

```javascript
(
	/* preload */ import('./dependency-1.js'),
	/* preload */ import('./dependency-2.js'),
	import('./lib.js');
);
```
