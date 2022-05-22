
import("./chunk/chunk").then(function() {
	return import("./common/AB");
}).then(function() {
	import("./common/BC");
}).then(function() {
	return import("./module/module");
}).then(function() {
	return import("./image/image");
}).then(function() {
	return import("./import/import");
}).then(function() {
	return import("./import/import2");
}).then(function() {
	return import("./assets/assets");
}).then(function() {
	return import("./sass/scss");
}).then(function() {
	return import("./sass/scss2");
}).then(function() {
	return import("./sass/sass");
});
