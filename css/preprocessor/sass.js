const util = require('util');
const fs = require('fs');

const readFile = util.promisify(fs.readFile);

module.exports = function createSassPreprocessor(options) {
	var sass = options.implementation || require("sass");
	var sassOptions = options.sassOptions || {};
	var encoding = options.encoding || 'utf-8';
	var plugin = options.plugin;
	var sourceMap = options.sourceMap;
	var additionalData = options.additionalData;
	var rollupImporter = options.rollupImporter !== false;
	var warnRuleAsWarning = options.warnRuleAsWarning;
	var logger;
	if(warnRuleAsWarning) {
		logger = {
			warn(message, options) {
				if(options.span) {
					plugin.warn(message, { file: span.url, line: span.start.line, column: span.start.column });
				} else {
					plugin.warn(message);
				}
			}
		};
	}

	var render;
	if(rollupImporter) {
		render = function(options) {
			return new Promise(function(resolve, reject) {
				sass.render(options, function(err, result) {
					if(err) {
						reject(err);
					} else {
						resolve(result);
					}
				});
			});
		};
	} else {
		render = function(options) {
			return new Promise(function(resolve, reject) {
				var result = sass.renderSync(options);
				resolve(result);
			});
		};
	}
	return async function(id) {
		var code = await readFile(id, { encoding: encoding });
		if(additionalData) {
			if(typeof additionalData === 'function') {
				var data = await additionalData(id, this);
				code = data + code;
			} else {
				code = additionalData + code;
			}
		}
		var importers = sassOptions.importer;
		if(importers) {
			if(!Array.isArray(importers)) {
				importers = [importers];
			}
		} else {
			importers = [];
		}
		if(rollupImporter) {
			importers.push(function(url, prev, done) {
				plugin.resolve(url, prev).then(({ id, external }) => {
					if(external) {
						done(null);
					} else {
						done({ file: id });
					}
				}, done);
			});
		}

		const res = await render({
			...sassOptions,
			file: id,
			data: code,
			indentedSyntax: /\.sass$/i.test(id),
			sourceMap: id,
			omitSourceMapUrl: true,
			sourceMapContents: true,
			importer: importers.length ? importers : undefined,
			logger: logger
		});

		return {
			code: Buffer.from(res.css).toString(),
			map: res.map ? Buffer.from(res.map).toString(encoding) : map,
		};
	};
};
