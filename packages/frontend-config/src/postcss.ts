/**
 * PostCSS config: mixins, `:root` custom properties inlined, Utopia fluid
 * sizes and, in builds only, cssnano's advanced preset.
 */
import cssnano from 'cssnano';
import type { AcceptedPlugin } from 'postcss';
import postcssCustomProperties from 'postcss-custom-properties';
import postcssMixins from 'postcss-mixins';
import postcssUtopia from 'postcss-utopia';

export interface PostcssOptions {
	/**
	 * Files whose `@define-mixin`s every style sheet can call without
	 * importing them. Default: the ITCSS tools layer.
	 */
	mixinsFiles?: string | string[];
	/** The viewport range of `utopia.clamp()`, in px. */
	utopia?: { minWidth: number; maxWidth: number };
}

/**
 * Builds the PostCSS config.
 * @param options - Where the mixins are and the fluid range.
 * @returns The config, for postcss.config.js to export.
 */
export const postcssConfig = ({
	mixinsFiles = './src/styles/tools/*.css',
	utopia = { minWidth: 320, maxWidth: 1240 },
}: PostcssOptions = {}): { plugins: AcceptedPlugin[] } => ({
	plugins: [
		// CSS Modules and atoms can call @mixin heading-xl etc. without importing tools/.
		postcssMixins({ mixinsFiles }),
		// Vite runs PostCSS once per file, so this only reaches the sheets that
		// declare :root: CSS Modules keep their var(). Never redefine a token
		// under another selector: the override is inlined away.
		postcssCustomProperties({ preserve: false }),
		postcssUtopia(utopia),
		// Builds only: in dev it slowed HMR and minified what DevTools shows.
		...(process.env.NODE_ENV === 'production'
			? [
					cssnano({
						// Vite runs PostCSS once per file, and these advanced plugins
						// assume they see the whole site:
						// - discardUnused deleted every Fontsource @font-face (each file
						//   declares a face it doesn't use itself).
						// - reduceIdents renamed each file's keyframes to a, b, c…, so
						//   two files bundled into one sheet would collide.
						// - mergeIdents merges same-body keyframes, with the same risk.
						// - zindex rebases each file's z-index from 1, which breaks the
						//   stacking order between files.
						preset: [
							'advanced',
							{
								discardUnused: false,
								reduceIdents: false,
								mergeIdents: false,
								zindex: false,
							},
						],
					}),
				]
			: []),
	],
});

export default postcssConfig;
