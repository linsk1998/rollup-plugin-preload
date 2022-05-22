const valueParser = require('postcss-value-parser');
const MagicString = require('magic-string');
const path = require('path');
const fs = require('fs');
module.exports = function(options) {
	var plugin = options.plugin;
	var assets = options.assets;
	var deps = options.deps;
	var css = options.id;
	return {
		postcssPlugin: 'postcss-rollup-url',
		Declaration: async (decl, { result, postcss }) => {
			var nodeUrl = new Map();
			var value = valueParser(decl.value);
			var magicString = new MagicString(decl.value);
			walkTree(value, {
				enter(node, parent) {
					if(node.type == "function" && node.value == "url") {
						let nodes = node.nodes;
						if(nodes && nodes.length === 1) {
							let urlNode = nodes[0];
							if(urlNode.type == 'word' || urlNode.type == 'string') {
								let url = urlNode.value;
								nodeUrl.set(node, url);
							}
						}
					}
				}
			});
			for(let [node, url] of nodeUrl) {
				let { id, external } = await plugin.resolve(url, css);
				if(external) {
					continue;
				}
				let assetId = assets.get(id);
				if(!assetId) {
					assetId = plugin.emitFile({
						type: 'asset',
						name: path.basename(id),
						source: fs.readFileSync(id)
					});
					assets.set(id, assetId);
				}
				deps.add(id);
				magicString.overwrite(node.sourceIndex, node.sourceEndIndex, `asset(${JSON.stringify(assetId)})`);
			}
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
