// This code is based on sindresorhus/yoctocolors, under the terms of the MIT License.
//
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
// SPDX-License-Identifier: MIT

export const isUnicodeSupported =
	process.platform !== "win32" ||
	Boolean(process.env.WT_SESSION) || // Windows Terminal
	process.env.TERM_PROGRAM === "vscode";

export const successSymbol = isUnicodeSupported ? "✅" : "[SUCCESS]";
export const infoSymbol = isUnicodeSupported ? "🔹" : "[INFO]";
export const warningSymbol = isUnicodeSupported ? "⚠️" : "[WARN]";
export const errorSymbol = isUnicodeSupported ? "❌" : "[ERROR]";
