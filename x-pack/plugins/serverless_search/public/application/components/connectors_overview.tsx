/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLink,
  EuiPageTemplate,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import React, { useMemo } from 'react';

import { docLinks } from '../../../common/doc_links';
import { LEARN_MORE_LABEL } from '../../../common/i18n_string';
import { PLUGIN_ID } from '../../../common';
import { useConnectors } from '../hooks/api/use_connectors';
import { useCreateConnector } from '../hooks/api/use_create_connector';
import { useKibanaServices } from '../hooks/use_kibana';
import { EmptyConnectorsPrompt } from './connectors/empty_connectors_prompt';
import { ConnectorsTable } from './connectors/connectors_table';
import { ConnectorPrivilegesCallout } from './connectors/connector_config/connector_privileges_callout';

export const ConnectorsOverview = () => {
  const { data, isLoading: connectorsLoading } = useConnectors();
  const { http, console: consolePlugin } = useKibanaServices();
  const { createConnector, isLoading } = useCreateConnector();
  const embeddableConsole = useMemo(
    () => (consolePlugin?.EmbeddableConsole ? <consolePlugin.EmbeddableConsole /> : null),
    [consolePlugin]
  );

  const canManageConnectors = !data || data.canManageConnectors;

  return (
    <EuiPageTemplate offset={0} grow restrictWidth data-test-subj="svlSearchConnectorsPage">
      <EuiPageTemplate.Header
        pageTitle={i18n.translate('xpack.serverlessSearch.connectors.title', {
          defaultMessage: 'Connectors',
        })}
        data-test-subj="serverlessSearchConnectorsTitle"
        restrictWidth
        rightSideItems={[
          <EuiFlexGroup direction="row" alignItems="flexStart" justifyContent="center">
            <EuiFlexItem>
              <EuiFlexGroup
                alignItems="center"
                gutterSize="xs"
                justifyContent="flexEnd"
                direction="row"
              >
                <EuiFlexItem grow={false}>
                  <EuiIcon
                    size="s"
                    type={http.basePath.prepend(`/plugins/${PLUGIN_ID}/assets/github.svg`)}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="s">
                    <EuiLink
                      data-test-subj="serverlessSearchConnectorsOverviewElasticConnectorsLink"
                      target="_blank"
                      href="https://github.com/elastic/connectors"
                    >
                      {i18n.translate('xpack.serverlessSearch.connectorsPythonLink', {
                        defaultMessage: 'elastic/connectors',
                      })}
                    </EuiLink>
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiButton
                data-test-subj="serverlessSearchConnectorsOverviewCreateConnectorButton"
                disabled={!canManageConnectors}
                isLoading={isLoading}
                fill
                iconType="plusInCircleFilled"
                onClick={() => createConnector()}
              >
                {i18n.translate('xpack.serverlessSearch.connectors.createConnector', {
                  defaultMessage: 'Create connector',
                })}
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>,
        ]}
      >
        <EuiText>
          <p>
            <FormattedMessage
              id="xpack.serverlessSearch.connectors.headerContent"
              defaultMessage="Sync third-party data sources to Elasticsearch, by deploying Elastic connectors on your own infrastructure. {learnMoreLink}"
              values={{
                learnMoreLink: (
                  <EuiLink
                    data-test-subj="serverlessSearchConnectorsOverviewLink"
                    external
                    target="_blank"
                    href={docLinks.connectors}
                  >
                    {LEARN_MORE_LABEL}
                  </EuiLink>
                ),
              }}
            />
          </p>
        </EuiText>
      </EuiPageTemplate.Header>
      <EuiPageTemplate.Section restrictWidth color="subdued">
        <ConnectorPrivilegesCallout />
        {connectorsLoading || (data?.connectors || []).length > 0 ? (
          <ConnectorsTable />
        ) : (
          <EmptyConnectorsPrompt />
        )}
      </EuiPageTemplate.Section>
      {embeddableConsole}
    </EuiPageTemplate>
  );
};
