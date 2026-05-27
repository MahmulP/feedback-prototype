export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.DRePGUYp.js",app:"_app/immutable/entry/app.ByE8BRaF.js",imports:["_app/immutable/entry/start.DRePGUYp.js","_app/immutable/chunks/DpXNA2Sr.js","_app/immutable/chunks/DxEMXgkL.js","_app/immutable/chunks/DMX1FUzG.js","_app/immutable/entry/app.ByE8BRaF.js","_app/immutable/chunks/4zZ_TcYv.js","_app/immutable/chunks/DMX1FUzG.js","_app/immutable/chunks/DxEMXgkL.js","_app/immutable/chunks/B7UPCQzy.js","_app/immutable/chunks/Cr208-j7.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
