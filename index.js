function rollupPluginPreload() {
	return {
		name: 'preload',
		renderDynamicImport({ getTargetChunkImports }) {
			const transitiveImports = getTargetChunkImports();
			if(transitiveImports && transitiveImports.length > 0) {
				const preload = getTargetChunkImports()
					.map(
						chunk => `\t/* preload */ import(${chunk.resolvedImportPath})`
					)
					.join(',\n');
				return {
					left: `(\n${preload},\n\timport(`,
					right: `)\n)`
				};
			} else {
				return null;
			}
		}
	};
}

rollupPluginPreload.default = rollupPluginPreload;
module.exports = rollupPluginPreload;