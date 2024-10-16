/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { TryInConsoleButton } from '@kbn/try-in-console';

import { AnalyticsEvents } from '../../analytics/constants';
import { Languages, AvailableLanguages, LanguageOptions } from '../../code_examples';
import { DenseVectorSeverlessCodeExamples } from '../../code_examples/create_index';
import { useUsageTracker } from '../../hooks/use_usage_tracker';
import { useKibana } from '../../hooks/use_kibana';
import { useElasticsearchUrl } from '../../hooks/use_elasticsearch_url';
import { getDefaultCodingLanguage } from '../../utils/language';

import { CodeSample } from '../shared/code_sample';
import { LanguageSelector } from '../shared/language_selector';

import { CreateIndexFormState } from './types';

export interface CreateIndexCodeViewProps {
  createIndexForm: CreateIndexFormState;
}

// TODO: this will be dynamic based on stack / es3 & onboarding token
const SelectedCodeExamples = DenseVectorSeverlessCodeExamples;

export const CreateIndexCodeView = ({ createIndexForm }: CreateIndexCodeViewProps) => {
  const { application, share, console: consolePlugin } = useKibana().services;
  const usageTracker = useUsageTracker();

  const [selectedLanguage, setSelectedLanguage] =
    useState<AvailableLanguages>(getDefaultCodingLanguage);
  const onSelectLanguage = useCallback(
    (value: AvailableLanguages) => {
      setSelectedLanguage(value);
      usageTracker.count([
        AnalyticsEvents.startCreateIndexLanguageSelect,
        `${AnalyticsEvents.startCreateIndexLanguageSelect}_${value}`,
      ]);
    },
    [usageTracker]
  );
  const elasticsearchUrl = useElasticsearchUrl();
  const codeParams = useMemo(() => {
    return {
      indexName: createIndexForm.indexName || undefined,
      elasticsearchURL: elasticsearchUrl,
    };
  }, [createIndexForm.indexName, elasticsearchUrl]);
  const selectedCodeExample = useMemo(() => {
    return SelectedCodeExamples[selectedLanguage];
  }, [selectedLanguage]);

  return (
    <EuiFlexGroup direction="column" data-test-subj="createIndexCodeView">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem css={{ maxWidth: '300px' }}>
          <LanguageSelector
            options={LanguageOptions}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={onSelectLanguage}
          />
        </EuiFlexItem>
        {selectedLanguage === 'curl' && (
          <EuiFlexItem grow={false}>
            <TryInConsoleButton
              request={SelectedCodeExamples.sense.createIndex(codeParams)}
              application={application}
              sharePlugin={share}
              consolePlugin={consolePlugin}
            />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      {selectedCodeExample.installCommand && (
        <CodeSample
          title={i18n.translate('xpack.searchIndices.startPage.codeView.installCommand.title', {
            defaultMessage: 'Install Elasticsearch serverless client',
          })}
          language="shell"
          code={selectedCodeExample.installCommand}
          onCodeCopyClick={() => {
            usageTracker.click([
              AnalyticsEvents.startCreateIndexCodeCopyInstall,
              `${AnalyticsEvents.startCreateIndexCodeCopyInstall}_${selectedLanguage}`,
            ]);
          }}
        />
      )}
      <CodeSample
        title={i18n.translate('xpack.searchIndices.startPage.codeView.createIndex.title', {
          defaultMessage: 'Connect and create an index',
        })}
        language={Languages[selectedLanguage].codeBlockLanguage}
        code={selectedCodeExample.createIndex(codeParams)}
        onCodeCopyClick={() => {
          usageTracker.click([
            AnalyticsEvents.startCreateIndexCodeCopy,
            `${AnalyticsEvents.startCreateIndexCodeCopy}_${selectedLanguage}`,
            // TODO: vector should be a parameter when have multiple options
            `${AnalyticsEvents.startCreateIndexCodeCopy}_${selectedLanguage}_vector`,
          ]);
        }}
      />
    </EuiFlexGroup>
  );
};
