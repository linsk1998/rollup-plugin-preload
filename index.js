const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const postcss = require('postcss');
const estreeWalker = require('estree-walker');
const MagicString = require('magic-string');
const pluginutils = require('@rollup/pluginutils');
const cssModules = require("postcss-modules");
const cssnano = require('cssnano');

const postcssRollupUrl = require("./css/postcss-rollup-url");
const postcssRollupAsset = require("./css/postcss-rollup-asset");
const postcssRollupImport = require("./css/postcss-rollup-import");

const PREFIX = "\0preload:";
const PRELOAD_CSS_PREFIX = "preload_css_";
const PRELOAD_ASSET_PREFIX = "preload_asset_";
const PRELOAD_MODULE_PREFIX = "preload_module_";

const PRIMARY_WOED = ['break', 'do', 'instanceof', 'typeof', 'case', 'else', 'new', 'var', 'catch', 'finally', 'return', 'void', 'continue', 'for', 'switch', 'while', 'debugger', 'function', 'this', 'with', 'default', 'if', 'throw', 'delete', 'in', 'try', 'enum', 'export', 'extends', 'super', 'class', 'const', 'debugger', 'import', 'class', 'enum', 'extends', 'const', 'export'];

function autoModules(id) {
	return /\.module\.\w+$/.test(id);
}

function preload(options) {
	if(!options) options = {};
	var { include, exclude, sourcemap } = options;
	var filter = pluginutils.createFilter(include, exclude);
	var sourceMap = options.sourceMap !== false && sourcemap !== false;
	var publicPath = options.publicPath || "";
	var dynamicImportFunction = options.dynamicImportFunction;
	if(!dynamicImportFunction) {
		throw new TypeError("rollup-plugin-preload: option `dynamicImportFunction` is required");
	}
	var baseURIVariable = options.baseURIVariable;
	if(!baseURIVariable) {
		throw new TypeError("rollup-plugin-preload: option `baseURIVariable` is required");
	}
	var isModules = options.autoModules || autoModules;
	var isModules = options.autoModules || autoModules;

	var css = options.css || {};
	var filterCSS = pluginutils.createFilter(css.include || ["**/*.{css,less,sass,scss,styl,stylus,pcss,postcss,sss}"], css.exclude);
	var postcssOptions = css.postcss || {};
	var postcssPlugins = postcssOptions.plugins || [];
	var cssModuleOptions = css.modules || {};
	var cssMinify = css.minify;
	var asset = options.asset || {};
	var filterAsset = pluginutils.createFilter(asset.include || ["**/*.{jpg,gif,png,svg,apng,webp,mp4,webm,mp3,ogg,swf}"], asset.exclude);

	/** path, css */
	var cssContents = new Map();
	var hashModule = new Map();
	var moduleHash = new Map();
	var moduleFile = new Map();
	var moduleAsset = new Map();

	var sass;

	return {
		name: "preload",
		resolveId(id, importer) {
			if(importer) {
				if(id == PREFIX) {
					return id;
				}
			}
		},
		async load(id) {
			if(id == PREFIX) {
				var js = fs.readFileSync(path.resolve(__dirname, "./runtime.js"));
				return js.toString('utf-8');
			} else if(filterCSS(id)) {
				var hash = moduleHash.get(id);
				if(!hash) {
					hash = getHash(id);
					moduleHash.set(id, hash);
					hashModule.set(hash, id);
				}
				var cssContent;
				if(/\.(scss|sass)$/.test(id)) {
					if(!sass) {
						sass = require("./css/preprocessor/sass")(Object.assign({}, css.sass, {
							plugin: this
						}));
					}
					let result = await sass(id);
					cssContent = result.code;
				} else {
					cssContent = fs.readFileSync(id);
				}
				var deps = new Set();
				var exports;
				var module = isModules(id);
				var plugins = [
					...postcssPlugins,
					postcssRollupUrl({
						id: id,
						plugin: this,
						assets: moduleAsset,
						deps: deps
					}),
					postcssRollupImport({
						id: id,
						plugin: this,
						imports: deps
					})
				];
				if(module) {
					plugins.push(
						cssModules({
							...cssModuleOptions,
							getJSON: function(cssFileName, json, outputFileName) {
								exports = json;
							},
						})
					);
				}
				var result = await postcss(plugins).process(cssContent, { from: id });
				cssContents.set(id, result.css);
				var s = [];
				deps.forEach((dep) => {
					s.push(`import ${JSON.stringify(dep)};`);
				});
				if(module) {
					for(let key in exports) {
						if(/^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key)) {
							if(!PRIMARY_WOED.includes(key)) {
								s.push(`export var ${key} = ${JSON.stringify(exports[key])};`);
							}
						}
					}
					s.push(`export default ${JSON.stringify(exports)};`);
				} else {
					s.push(`export default import.meta.${PRELOAD_CSS_PREFIX}${hash};`);
				}
				return s.join("\n");
			} else if(filterAsset(id)) {
				var assetId = moduleAsset.get(id);
				if(!assetId) {
					assetId = this.emitFile({
						type: 'asset',
						name: path.basename(id),
						source: fs.readFileSync(id)
					});
					moduleAsset.set(id, assetId);
				}
				return `export default import.meta.${PRELOAD_ASSET_PREFIX}${assetId};`;
			}
		},
		renderDynamicImport({ format, moduleId, targetModuleId, customResolution }) {
			var hash = moduleHash.get(targetModuleId);
			if(!hash) {
				hash = getHash(targetModuleId);
				moduleHash.set(targetModuleId, hash);
				hashModule.set(hash, targetModuleId);
			}
			return {
				left: `${dynamicImportFunction}(`,
				right: `,import.meta.url,import.meta.${PRELOAD_MODULE_PREFIX}${hash})`
			};
		},
		resolveImportMeta(property) {
			if(property.startsWith(PRELOAD_CSS_PREFIX)) {
				// 通过 import xxx from "xxxx.css";单独使用路径
				var hash = property.substring(PRELOAD_CSS_PREFIX.length);
				var moduleId = hashModule.get(hash);
				var assetFileName = moduleFile.get(hash);
				if(assetFileName) {
					return assetFileName;
				}
				var filename = path.basename(moduleId);
				filename = filename.replace(/\.[^\.]*$/, "");
				var assetId = this.emitFile({
					type: 'asset',
					name: filename + ".css",
					source: cssContents.get(moduleId)
				});
				assetFileName = JSON.stringify(publicPath + this.getFileName(assetId));
				moduleFile.set(moduleId, assetFileName);
				return assetFileName;
			}
			if(property.startsWith(PRELOAD_MODULE_PREFIX)) {
				return 'import.meta.' + property;
			}
			if(property.startsWith(PRELOAD_ASSET_PREFIX)) {
				var assetId = property.substring(PRELOAD_ASSET_PREFIX.length);
				return JSON.stringify(publicPath + this.getFileName(assetId));
			}
		},
		async generateBundle(options, bundle) {
			var independentCSS = new Map();
			var chunkDeps = new Map();

			var moduleChunk = new Map();
			var cssChunkIds = new Map();
			var chunkCSSIds = new Map();
			for(let chunkId in bundle) {
				let chunkInfo = bundle[chunkId];
				let modules = chunkInfo.modules;
				let setChunkDeps = (moduleId) => {
					moduleChunk.set(moduleId, chunkId);
					let module = this.getModuleInfo(moduleId);
					if(module) {
						let importedIds = module.importedIds;
						if(importedIds) {
							importedIds.forEach((id) => {
								// 通过地址引入的css不必预加载
								if(moduleFile.has(moduleId)) {
									return;
								}
								if(filterCSS(id)) {
									addMapSet(cssChunkIds, id, chunkId);
									addMapSet(chunkCSSIds, chunkId, id);
								} else if(filterAsset(id)) {
									let assetId = moduleAsset.get(id);
									if(assetId) {
										addMapSet(chunkDeps, chunkId, this.getFileName(assetId));
									}
									return;
								}
								setChunkDeps(id);
							});
						}
					}
				};
				for(let moduleId in modules) {
					setChunkDeps(moduleId);
				}
			}


			var plugins = [
				postcssRollupAsset({
					publicPath: publicPath,
					plugin: this
				})
			];
			if(cssMinify) {
				plugins.push(
					cssnano({
						preset: 'default',
					})
				);
			}
			var cssProcessor = postcss(plugins);

			for(let [chunkId, CSSIds] of chunkCSSIds) {
				let chunkInfo = bundle[chunkId];
				let chunkCSSs = [];
				for(let css of CSSIds) {
					let chunkIds = cssChunkIds.get(css);
					if(chunkIds) {
						if(chunkIds && chunkIds.size > 1) {
							let assetId = independentCSS.get(css);
							if(!assetId) {
								let result = await cssProcessor.process(cssContents.get(css) || "", { from: chunkInfo.facadeModuleId });
								assetId = this.emitFile({
									type: 'asset',
									name: path.basename(css),
									source: result.css
								});
								independentCSS.set(css, assetId);
							}
							addMapSet(chunkDeps, chunkId, this.getFileName(assetId));
						} else {
							chunkCSSs.push(cssContents.get(css) || "");
						}
					}
				}
				let result = await cssProcessor.process(chunkCSSs.join("\n\n"), { from: chunkInfo.facadeModuleId });
				let filename = path.basename(chunkInfo.facadeModuleId);
				filename = filename.replace(/\.[^\.]*$/, "");
				let assetId = this.emitFile({
					type: 'asset',
					name: filename + ".css",
					source: result.css
				});
				addMapSet(chunkDeps, chunkId, this.getFileName(assetId));
			}

			Object.entries(bundle).forEach(([chunkId, chunkInfo]) => {
				if(chunkInfo.type != 'chunk') {
					return;
				}

				var ast = null;
				try {
					ast = this.parse(chunkInfo.code);
				} catch(err) {
					this.warn({
						code: 'PARSE_ERROR',
						message: ("rollup-plugin-preload: failed to parse " + chunkId + ". Consider restricting the plugin to particular files via options.include")
					});
					return;
				}
				if(!ast) {
					return null;
				}
				var changed = false;
				var scope = pluginutils.attachScopes(ast, 'scope');
				var magicString = new MagicString(chunkInfo.code);

				estreeWalker.walk(ast, {
					enter: (node, parent) => {
						if(sourceMap) {
							magicString.addSourcemapLocation(node.start);
							magicString.addSourcemapLocation(node.end);
						}
						if(node.scope) {
							scope = node.scope;
						}
						if(node.type === 'MemberExpression') {
							var property = node.property;
							var object = node.object;
							if(property && object) {
								if(property.type === 'Identifier' && object.type === 'MetaProperty') {
									var name = property.name;
									if(name === 'url') {
										var url = `new URL(${JSON.stringify(publicPath + chunkInfo.fileName)},${baseURIVariable})`;
										magicString.overwrite(node.start, node.end, url);
										changed = true;
									} else if(name.startsWith(PRELOAD_MODULE_PREFIX)) {
										var hash = name.substring(PRELOAD_MODULE_PREFIX.length);
										if(hash) {
											var moduleId = hashModule.get(hash);
											var chunkId = moduleChunk.get(moduleId);
											var deps = chunkDeps.get(chunkId);
											var arr = [];
											if(deps) {
												deps.forEach((dep) => {
													arr.push(publicPath + dep);
												});
											}
											magicString.overwrite(node.start, node.end, JSON.stringify(arr));
											changed = true;
										}
									}
								}
							}
						}
					},
					leave: function leave(node) {
						if(node.scope) {
							scope = scope.parent;
						}
					}
				});
				if(changed) {
					chunkInfo.code = magicString.toString();
					// TODO source map
				}
			});
		}
	};
}
module.exports = preload;
preload.default;

function addMapSet(map, key, value) {
	var set = map.get(key);
	if(!set) {
		set = new Set();
		map.set(key, set);
	}
	set.add(value);
}

function getHash(content) {
	return crypto.createHmac('sha256', content)
		.digest('hex')
		.substring(0, 8);
}
