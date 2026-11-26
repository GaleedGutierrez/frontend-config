// postcss-utopia's own index.d.ts declares a module named 'utopia', not
// 'postcss-utopia', so TypeScript reads it as "not a module".
declare module 'postcss-utopia' {
	import type { PluginCreator } from 'postcss';

	interface UtopiaOptions {
		/** Default minimum viewport, in px. */
		minWidth?: number;
		/** Default maximum viewport, in px. */
		maxWidth?: number;
	}

	const utopia: PluginCreator<UtopiaOptions>;

	export default utopia;
}
