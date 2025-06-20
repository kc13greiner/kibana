/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { performance } from 'perf_hooks';
import type { ElasticsearchClient } from '@kbn/core/server';
import type { estypes } from '@elastic/elasticsearch';
import type { RulePreviewLoggedRequest } from '../../../../../common/api/detection_engine/rule_preview/rule_preview.gen';
import { logQueryRequest } from '../utils/logged_requests';
import * as i18n from '../translations';
import type { SignalSource } from '../types';

export interface FetchedDocument {
  fields: estypes.SearchHit['fields'];
  _source?: SignalSource;
  _index: estypes.SearchHit['_index'];
  _version: estypes.SearchHit['_version'];
}

interface FetchSourceDocumentsArgs {
  isRuleAggregating: boolean;
  esClient: ElasticsearchClient;
  index: string[];
  results: Array<Record<string, string | null>>;
  loggedRequests?: RulePreviewLoggedRequest[];
  hasLoggedRequestsReachedLimit: boolean;
  runtimeMappings: estypes.MappingRuntimeFields | undefined;
}
/**
 * fetches source documents by list of their ids
 * it used for a case when non-aggregating has _id property to enrich alert with source document,
 * if some of the properties missed from resulted query
 */
export const fetchSourceDocuments = async ({
  isRuleAggregating,
  results,
  esClient,
  index,
  loggedRequests,
  hasLoggedRequestsReachedLimit,
  runtimeMappings,
}: FetchSourceDocumentsArgs): Promise<Record<string, FetchedDocument>> => {
  const ids = results.reduce<string[]>((acc, doc) => {
    if (doc._id) {
      acc.push(doc._id);
    }
    return acc;
  }, []);

  // we will fetch source documents only for non-aggregating rules, since aggregating do not have _id
  if (ids.length === 0 || isRuleAggregating) {
    return {};
  }

  const idsQuery = {
    query: {
      bool: {
        filter: {
          ids: { values: ids },
        },
      },
    },
  };

  const searchBody = {
    query: idsQuery.query,
    _source: true,
    fields: ['*'],
    size: ids.length,
    runtime_mappings: runtimeMappings,
  };
  const ignoreUnavailable = true;

  if (loggedRequests) {
    loggedRequests.push({
      request: hasLoggedRequestsReachedLimit
        ? undefined
        : logQueryRequest(searchBody, { index, ignoreUnavailable }),
      description: i18n.FIND_SOURCE_DOCUMENTS_REQUEST_DESCRIPTION,
    });
  }

  const searchStart = performance.now();
  const response = await esClient.search<SignalSource>({
    index,
    ...searchBody,
    ignore_unavailable: ignoreUnavailable,
  });

  if (loggedRequests) {
    loggedRequests[loggedRequests.length - 1].duration = Math.round(
      performance.now() - searchStart
    );
  }

  return response.hits.hits.reduce<Record<string, FetchedDocument>>((acc, hit) => {
    if (hit._id) {
      acc[hit._id] = {
        fields: hit.fields,
        _source: hit._source,
        _index: hit._index,
        _version: hit._version,
      };
    }
    return acc;
  }, {});
};
