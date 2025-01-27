/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { DocLinksServiceSetup, Logger } from '@kbn/core/server';
import type { ConfigType } from '../../../../config';
import type { SetupPlugins } from '../../../../plugin_contract';
import type { SecuritySolutionPluginRouter } from '../../../../types';

import { performBulkActionRoute } from './rules/bulk_actions/route';
import { createRuleRoute } from './rules/create_rule/route';
import { deleteRuleRoute } from './rules/delete_rule/route';
import { exportRulesRoute } from './rules/export_rules/route';
import { findRulesRoute } from './rules/find_rules/route';
import { importRulesRoute } from './rules/import_rules/route';
import { getRuleManagementFilters } from './rules/filters/route';
import { patchRuleRoute } from './rules/patch_rule/route';
import { readRuleRoute } from './rules/read_rule/route';
import { updateRuleRoute } from './rules/update_rule/route';
import { readTagsRoute } from './tags/read_tags/route';
import { getCoverageOverviewRoute } from './rules/coverage_overview/route';
import { bulkCreateRulesRoute } from './rules/bulk_create_rules/route';
import { bulkUpdateRulesRoute } from './rules/bulk_update_rules/route';
import { bulkPatchRulesRoute } from './rules/bulk_patch_rules/route';
import { bulkDeleteRulesRoute } from './rules/bulk_delete_rules/route';

export const registerRuleManagementRoutes = (
  router: SecuritySolutionPluginRouter,
  config: ConfigType,
  ml: SetupPlugins['ml'],
  logger: Logger,
  docLinks: DocLinksServiceSetup
) => {
  // Rules CRUD
  createRuleRoute(router);
  readRuleRoute(router, logger);
  updateRuleRoute(router);
  patchRuleRoute(router);
  deleteRuleRoute(router);

  // These four bulk endpoints are deprecated and will be removed in 9.0
  bulkCreateRulesRoute(router, logger, docLinks);
  bulkUpdateRulesRoute(router, logger, docLinks);
  bulkPatchRulesRoute(router, logger, docLinks);
  bulkDeleteRulesRoute(router, logger, docLinks);

  // Rules bulk actions
  performBulkActionRoute(router, config, ml, logger);

  // Rules export/import
  exportRulesRoute(router, config, logger);
  importRulesRoute(router, config);

  // Rules search
  findRulesRoute(router, logger);

  // Rule tags
  readTagsRoute(router);

  // Rules filters
  getRuleManagementFilters(router);

  // Rules coverage overview
  getCoverageOverviewRoute(router);
};
