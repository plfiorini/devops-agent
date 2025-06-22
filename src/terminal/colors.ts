// This code is based on sindresorhus/yoctocolors, under the terms of the MIT License.
//
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
// SPDX-License-Identifier: MIT

export const supportsColor =
	process.stdout.isTTY && process.stdout.hasColors() && !process.env.NO_COLOR;

const format = (open: number, close: number) => {
	if (!supportsColor) {
		return (...args: unknown[]) => args.flat().join(" ");
	}

	const openCode = `\x1b[${open}m`;
	const closeCode = `\x1b[${close}m`;

	return (...args: unknown[]) => openCode + args.flat().join(" ") + closeCode;
};

export const reset = format(0, 0);
export const bold = format(1, 22);
export const dim = format(2, 22);
export const italic = format(3, 23);
export const underline = format(4, 24);
export const overline = format(53, 55);
export const inverse = format(7, 27);
export const hidden = format(8, 28);
export const strikethrough = format(9, 29);

export const black = format(30, 39);
export const red = format(31, 39);
export const green = format(32, 39);
export const yellow = format(33, 39);
export const blue = format(34, 39);
export const magenta = format(35, 39);
export const cyan = format(36, 39);
export const white = format(37, 39);
export const gray = format(90, 39);

export const bgBlack = format(40, 49);
export const bgRed = format(41, 49);
export const bgGreen = format(42, 49);
export const bgYellow = format(43, 49);
export const bgBlue = format(44, 49);
export const bgMagenta = format(45, 49);
export const bgCyan = format(46, 49);
export const bgWhite = format(47, 49);
export const bgGray = format(100, 49);

export const redBright = format(91, 39);
export const greenBright = format(92, 39);
export const yellowBright = format(93, 39);
export const blueBright = format(94, 39);
export const magentaBright = format(95, 39);
export const cyanBright = format(96, 39);
export const whiteBright = format(97, 39);

export const bgRedBright = format(101, 49);
export const bgGreenBright = format(102, 49);
export const bgYellowBright = format(103, 49);
export const bgBlueBright = format(104, 49);
export const bgMagentaBright = format(105, 49);
export const bgCyanBright = format(106, 49);
export const bgWhiteBright = format(107, 49);
