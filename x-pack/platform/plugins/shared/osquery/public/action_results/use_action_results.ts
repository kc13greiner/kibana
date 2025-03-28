/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import { flatten, reverse, uniqBy } from 'lodash/fp';
import { useQuery } from '@tanstack/react-query';
import { i18n } from '@kbn/i18n';
import { lastValueFrom } from 'rxjs';
import type { InspectResponse } from '../common/helpers';
import { getInspectResponse, generateTablePaginationOptions } from '../common/helpers';
import { useKibana } from '../common/lib/kibana';
import type {
  ResultEdges,
  ActionResultsRequestOptions,
  ActionResultsStrategyResponse,
  Direction,
} from '../../common/search_strategy';
import { OsqueryQueries } from '../../common/search_strategy';
import { queryClient } from '../query_client';

import { useErrorToast } from '../common/hooks/use_error_toast';

export interface ResultsArgs {
  results: ResultEdges;
  id: string;
  inspect: InspectResponse;
  isInspected: boolean;
}

export interface UseActionResults {
  actionId: string;
  activePage: number;
  startDate?: string;
  agentIds?: string[];
  direction: Direction;
  limit: number;
  sortField: string;
  kuery?: string;
  skip?: boolean;
  isLive?: boolean;
}

export const useActionResults = ({
  actionId,
  activePage,
  agentIds,
  direction,
  limit,
  sortField,
  kuery,
  startDate,
  skip = false,
  isLive = false,
}: UseActionResults) => {
  const { data } = useKibana().services;
  const setErrorToast = useErrorToast();

  return useQuery<{}, Error, ActionResultsStrategyResponse>(
    ['actionResults', { actionId }],
    async () => {
      const responseData = await lastValueFrom(
        data.search.search<ActionResultsRequestOptions, ActionResultsStrategyResponse>(
          {
            actionId,
            startDate,
            factoryQueryType: OsqueryQueries.actionResults,
            kuery,
            pagination: generateTablePaginationOptions(activePage, limit),
            sort: {
              direction,
              field: sortField,
            },
          },
          {
            strategy: 'osquerySearchStrategy',
          }
        )
      );

      const totalResponded =
        responseData.rawResponse?.aggregations?.aggs.responses_by_action_id?.doc_count ?? 0;
      const totalRowCount =
        responseData.rawResponse?.aggregations?.aggs.responses_by_action_id?.rows_count?.value ?? 0;
      const aggsBuckets =
        responseData.rawResponse?.aggregations?.aggs.responses_by_action_id?.responses.buckets;

      const cachedData = queryClient.getQueryData<ActionResultsStrategyResponse>([
        'actionResults',
        { actionId },
      ]);

      const previousEdges = cachedData?.edges.length
        ? cachedData?.edges
        : agentIds?.map(
            (agentId) =>
              ({ fields: { agent_id: [agentId] } } as unknown as estypes.SearchHit<object>)
          ) ?? [];

      return {
        ...responseData,
        edges: reverse(uniqBy('fields.agent_id[0]', flatten([responseData.edges, previousEdges]))),
        aggregations: {
          totalRowCount,
          totalResponded,
          successful: aggsBuckets?.find((bucket) => bucket.key === 'success')?.doc_count ?? 0,
          failed: aggsBuckets?.find((bucket) => bucket.key === 'error')?.doc_count ?? 0,
        },
        inspect: getInspectResponse(responseData, {} as InspectResponse),
      };
    },
    {
      initialData: {
        edges: [],
        aggregations: {
          totalResponded: 0,
          successful: 0,
          pending: agentIds?.length ?? 0,
          failed: 0,
        },
      },
      refetchInterval: isLive ? 5000 : false,
      keepPreviousData: true,
      enabled: !skip && !!agentIds?.length,
      onSuccess: () => setErrorToast(),
      onError: (error) =>
        setErrorToast(error, {
          title: i18n.translate('xpack.osquery.action_results.fetchError', {
            defaultMessage: 'Error while fetching action results',
          }),
        }),
    }
  );
};
