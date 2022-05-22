const valueParser = require('postcss-value-parser');
module.exports = function(options) {
	var plugin = options.plugin;
	var css = options.id;
	var imports = options.imports;
	return {
		postcssPlugin: 'postcss-rollup-import',
		AtRule: {
			import(atRule, { result }) {
				if(atRule.name == 'import') {
					var value = valueParser(atRule.params);
					var nodes = value.nodes;
					if(nodes.length > 1) {
						plugin.warn('Unsupport @import media query.');
					} else {
						var node = nodes[0];
						if(node.type == 'string') {
							imports.add(node.value);
						} else if(node.type == 'function') {
							nodes = node.nodes;
							if(nodes && nodes.length) {
								node = nodes[0];
								if(node.type == 'string') {
									imports.add(node.value);
								}
							}
						}
						atRule.remove();
					}
				}
			}
		}
	};
};
