/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
import console from 'node:console';
import fs, { globSync } from 'node:fs';
import path from 'node:path';

/** Where a step reports. Astro's integration logger fits it. */
export interface Logger {
	info: (message: string) => void;
	warn: (message: string) => void;
	error: (message: string) => void;
}

export const consoleLogger: Logger = {
	info: (message) => {
		console.info(message);
	},
	warn: (message) => {
		console.warn(message);
	},
	error: (message) => {
		console.error(message);
	},
};

/** What every step receives. */
export interface StepContext {
	/** The build output folder (Astro's `dist/`). */
	dir: string;
	/** Astro's `build.assets` folder name, inside `dir`. Default `_astro`. */
	assets?: string;
	logger?: Logger;
}

/**
 * Files under a folder, as absolute paths.
 * @param directory - The folder.
 * @param pattern - A glob, relative to it.
 * @param exclude - Globs to leave out.
 * @returns The matching files.
 */
export const filesIn = (
	directory: string,
	pattern: string,
	exclude: string[] = [],
): string[] =>
	globSync(pattern, { cwd: directory, exclude }).map((file) =>
		path.join(directory, file),
	);

/**
 * Total size of some files.
 * @param files - Absolute paths.
 * @returns The size in bytes.
 */
export const totalSizeOf = (files: string[]): number =>
	files.reduce((total, file) => total + fs.statSync(file).size, 0);

export const toKb = (bytes: number): string => `${(bytes / 1024).toFixed(2)}kb`;

/**
 * Throws once every file was tried, so one broken file doesn't hide the
 * others, and the build still fails.
 * @param step - The step name, for the message.
 * @param failures - What went wrong, one entry per file.
 */
export const failIfAny = (step: string, failures: string[]): void => {
	if (failures.length > 0) {
		throw new Error(`${step} failed:\n${failures.join('\n')}`);
	}
};

/**
 * The message of anything thrown.
 * @param error - The caught value.
 * @returns Its message.
 */
export const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
