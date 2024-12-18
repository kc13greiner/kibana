/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { monaco } from '@kbn/monaco';
import { MIN_HEIGHT } from './source';

// Displayed margin of the tab content to the window bottom
export const DEFAULT_MARGIN_BOTTOM = 16;

export function getTabContentAvailableHeight(
  elementRef: HTMLElement | undefined,
  decreaseAvailableHeightBy: number
): number {
  if (!elementRef) {
    return 0;
  }

  // assign a good height filling the available space of the document flyout
  const position = elementRef.getBoundingClientRect();
  return window.innerHeight - position.top - decreaseAvailableHeightBy;
}

export function getHeight(
  editor: monaco.editor.IStandaloneCodeEditor,
  decreaseAvailableHeightBy: number
) {
  const editorElement = editor?.getDomNode();
  if (!editorElement) {
    return 0;
  }

  const result = getTabContentAvailableHeight(editorElement, decreaseAvailableHeightBy);
  return Math.max(result, MIN_HEIGHT);
}
