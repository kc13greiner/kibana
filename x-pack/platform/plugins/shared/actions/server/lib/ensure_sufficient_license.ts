/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { LICENSE_TYPE } from '@kbn/licensing-plugin/common/types';
import type { ActionType } from '../types';
import type { ActionTypeConfig, ActionTypeSecrets, ActionTypeParams } from '../types';

const ServerLogActionTypeId = '.server-log';
const IndexActionTypeId = '.index';

const ACTIONS_SCOPED_WITHIN_STACK = new Set([ServerLogActionTypeId, IndexActionTypeId]);

export function ensureSufficientLicense<
  Config extends ActionTypeConfig,
  Secrets extends ActionTypeSecrets,
  Params extends ActionTypeParams,
  ExecutorResultData
>(actionType: ActionType<Config, Secrets, Params, ExecutorResultData>) {
  if (!(actionType.minimumLicenseRequired in LICENSE_TYPE)) {
    throw new Error(`"${actionType.minimumLicenseRequired}" is not a valid license type`);
  }
  if (
    LICENSE_TYPE[actionType.minimumLicenseRequired] < LICENSE_TYPE.gold &&
    !ACTIONS_SCOPED_WITHIN_STACK.has(actionType.id)
  ) {
    throw new Error(
      `Third party action type "${actionType.id}" can only set minimumLicenseRequired to a gold license or higher`
    );
  }
}
