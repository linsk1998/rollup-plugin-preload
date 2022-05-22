const valueParser = require('postcss-value-parser');
const MagicString = require('magic-string');

module.exports = function(options) {
	var plugin = options.plugin;
	var publicPath = options.publicPath;
	return {
		postcssPlugin: 'postcss-rollup-asset',
		Declaration: async (decl, { result, postcss }) => {
			var value = valueParser(decl.value);
			var magicString = new MagicString(decl.value);
			walkTree(value, {
				enter(node, parent) {
					if(node.type == "function" && node.value == "asset") {
						let nodes = node.nodes;
						if(nodes && nodes.length === 1) {
							let urlNode = nodes[0];
							if(urlNode.type == 'string') {
								let assetId = urlNode.value;
								magicString.overwrite(node.sourceIndex, node.sourceEndIndex, `url(${JSON.stringify(publicPath + plugin.getFileName(assetId))})`);
							}
						}
					}
				}
			});
			decl.value = magicString.toString();
		},
	};
};


function walkTree(node, walker, parent) {
	var enter = walker.enter;
	if(enter) {
		enter(node, parent);
	}
	var nodes = node.nodes;
	if(nodes && nodes.length) {
		var arr = Array.from(nodes);
		arr.forEach((child) => {
			walkTree(child, walker, node);
		});
	}
	var leave = walker.leave;
	if(leave) {
		leave(node, this);
	}
}
