/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { CASE_COMMENTS_URL } from '../../../../common/constants';
import { createCaseError } from '../../../common/error';
import { createCasesRoute } from '../create_cases_route';
import type { caseDomainV1 } from '../../../../common/types/domain';
import type { attachmentApiV1 } from '../../../../common/types/api';
import { DEFAULT_CASES_ROUTE_SECURITY } from '../constants';

export const postCommentRoute = createCasesRoute({
  method: 'post',
  path: CASE_COMMENTS_URL,
  security: DEFAULT_CASES_ROUTE_SECURITY,
  params: {
    params: schema.object({
      case_id: schema.string(),
    }),
  },
  routerOptions: {
    access: 'public',
    summary: `Add a case comment or alert`,
    tags: ['oas-tag:cases'],
    description: 'Each case can have a maximum of 1,000 alerts.',
    // You must have `all` privileges for the **Cases** feature in the **Management**, **Observability**, or **Security** section of the Kibana feature privileges, depending on the owner of the case you're creating.
  },
  handler: async ({ context, request, response }) => {
    try {
      const caseContext = await context.cases;
      const casesClient = await caseContext.getCasesClient();
      const caseId = request.params.case_id;
      const comment = request.body as attachmentApiV1.AttachmentRequest;
      const res: caseDomainV1.Case = await casesClient.attachments.add({ caseId, comment });

      return response.ok({
        body: res,
      });
    } catch (error) {
      throw createCaseError({
        message: `Failed to post comment in route case id: ${request.params.case_id}: ${error}`,
        error,
      });
    }
  },
});
