/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readFile } from 'fs/promises';
import * as path from 'path';
import { TranslationInput } from './translation';

const TRANSLATION_FILE_EXTENSION = '.json';

/**
 * Internal property for storing registered translations paths.
 * Key is locale, value is array of registered paths
 */
const translationsRegistry: { [key: string]: string[] } = {};

/**
 * Internal property for caching loaded translations files.
 * Key is path to translation file, value is object with translation messages
 */
const loadedFiles: { [key: string]: TranslationInput } = {};

/**
 * Returns locale by the given translation file name
 * @param fullFileName
 * @returns locale
 * @example
 * getLocaleFromFileName('./path/to/translation/ru.json') // => 'ru'
 */
function getLocaleFromFileName(fullFileName: string) {
  if (!fullFileName) {
    throw new Error('Filename is empty');
  }

  const fileExt = path.extname(fullFileName);

  if (fileExt !== TRANSLATION_FILE_EXTENSION) {
    throw new Error(
      `Translations must have 'json' extension. File being registered is ${fullFileName}`
    );
  }

  return path.basename(fullFileName, TRANSLATION_FILE_EXTENSION);
}

/**
 * Loads file and parses it as JSON
 * @param pathToFile
 * @returns
 */
async function loadFile(pathToFile: string): Promise<TranslationInput> {
  return JSON.parse(await readFile(pathToFile, 'utf8'));
}

/**
 * Loads translations files and adds them into "loadedFiles" cache
 * @param files
 * @returns
 */
async function loadAndCacheFiles(files: string[]) {
  const translations = await Promise.all(files.map(loadFile));

  files.forEach((file, index) => {
    loadedFiles[file] = translations[index];
  });
}

/**
 * Registers translation file with i18n loader
 * @param translationFilePath - Absolute path to the translation file to register.
 */
export function registerTranslationFile(translationFilePath: string) {
  if (!path.isAbsolute(translationFilePath)) {
    throw new TypeError(
      'Paths to translation files must be absolute. ' +
        `Got relative path: "${translationFilePath}"`
    );
  }

  const locale = getLocaleFromFileName(translationFilePath);

  translationsRegistry[locale] = [
    ...new Set([...(translationsRegistry[locale] || []), translationFilePath]),
  ];
}

/**
 * Registers array of translation files with i18n loader
 * @param arrayOfPaths - Array of absolute paths to the translation files to register.
 */
export function registerTranslationFiles(arrayOfPaths: string[] = []) {
  arrayOfPaths.forEach(registerTranslationFile);
}

/**
 * Returns an array of locales that have been registered with i18n loader
 * @returns registeredTranslations
 */
export function getRegisteredLocales() {
  return Object.keys(translationsRegistry);
}

/**
 * Returns translation messages by specified locale
 * @param locale
 * @returns translation messages
 */
export async function getTranslationsByLocale(locale: string): Promise<TranslationInput> {
  const files = translationsRegistry[locale] || [];
  const notLoadedFiles = files.filter((file) => !loadedFiles[file]);

  if (notLoadedFiles.length) {
    await loadAndCacheFiles(notLoadedFiles);
  }

  if (!files.length) {
    return { locale, messages: {} };
  }

  const fileTranslationDetails = files.map((file) => loadedFiles[file]);

  const filesLocale = fileTranslationDetails[0].locale || locale;
  const translationInput = fileTranslationDetails.reduce((acc, translation) => ({
    locale,
    formats: translation.formats
      ? Object.assign(acc.formats || {}, translation.formats)
      : undefined,
    messages: Object.assign(acc.messages, translation.messages),
  }));

  return { ...translationInput, locale: filesLocale };
}

/**
 * Returns all translations for registered locales
 * @returns A Promise object
 * where keys are the locale and values are objects of translation messages
 */
export async function getAllTranslations(): Promise<{ [key: string]: TranslationInput }> {
  const locales = getRegisteredLocales();
  const translations = await Promise.all(locales.map(getTranslationsByLocale));

  return locales.reduce((acc, locale, index) => {
    acc[locale] = translations[index];
    return acc;
  }, {} as { [key: string]: TranslationInput });
}

/**
 * Registers passed translations files, loads them and returns promise with
 * all translation messages
 * @param paths - Array of absolute paths to the translation files
 * @returns A Promise object where
 * keys are the locale and values are objects of translation messages
 */
export async function getAllTranslationsFromPaths(paths: string[]) {
  registerTranslationFiles(paths);

  return await getAllTranslations();
}
