/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EmbeddableApiContext } from '@kbn/presentation-publishing';
import { ADD_PANEL_TRIGGER, IncompatibleActionError } from '@kbn/ui-actions-plugin/public';
import { ADD_PANEL_ANNOTATION_GROUP } from '@kbn/embeddable-plugin/public';
import { APP_ICON, APP_NAME, CONTENT_ID } from '../../common';
import { uiActions } from '../services/kibana_services';

const ADD_LINKS_PANEL_ACTION_ID = 'create_links_panel';

export const registerCreateLinksPanelAction = () => {
  uiActions.registerAction<EmbeddableApiContext>({
    id: ADD_LINKS_PANEL_ACTION_ID,
    getIconType: () => APP_ICON,
    order: 10,
    isCompatible: async ({ embeddable }) => {
      const { isParentApiCompatible } = await import('./compatibility_check');
      return isParentApiCompatible(embeddable);
    },
    execute: async ({ embeddable }) => {
      const { isParentApiCompatible } = await import('./compatibility_check');
      if (!isParentApiCompatible(embeddable)) throw new IncompatibleActionError();
      const { openEditorFlyout } = await import('../editor/open_editor_flyout');
      const runtimeState = await openEditorFlyout({
        parentDashboard: embeddable,
      });
      if (!runtimeState) return;

      await embeddable.addNewPanel({
        panelType: CONTENT_ID,
        initialState: runtimeState,
      });
    },
    grouping: [ADD_PANEL_ANNOTATION_GROUP],
    getDisplayName: () => APP_NAME,
  });
  uiActions.attachAction(ADD_PANEL_TRIGGER, ADD_LINKS_PANEL_ACTION_ID);
};
