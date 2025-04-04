/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { PreviewBanner, PreviewSection } from './preview_section';
import {
  PREVIEW_SECTION_BACK_BUTTON_TEST_ID,
  PREVIEW_SECTION_CLOSE_BUTTON_TEST_ID,
  PREVIEW_SECTION_TEST_ID,
} from './test_ids';
import { TestProvider } from '../test/provider';
import { initialUiState, State } from '../store/state';

describe('PreviewSection', () => {
  const context: State = {
    panels: {
      byId: {
        flyout: {
          right: undefined,
          left: undefined,
          preview: [
            {
              id: 'key',
            },
          ],
          history: [],
        },
      },
    },
    ui: initialUiState,
  };

  const component = <div>{'component'}</div>;

  it('should render back button and close button in header', () => {
    const { getByTestId } = render(
      <TestProvider state={context}>
        <PreviewSection component={component} banner={undefined} showExpanded={false} />
      </TestProvider>
    );

    expect(getByTestId(PREVIEW_SECTION_CLOSE_BUTTON_TEST_ID)).toBeInTheDocument();
    expect(getByTestId(PREVIEW_SECTION_BACK_BUTTON_TEST_ID)).toBeInTheDocument();
  });

  it('should render banner', () => {
    const title = 'test';
    const banner: PreviewBanner = {
      title,
      backgroundColor: 'primary',
      textColor: 'red',
    };

    const { getByTestId, getByText } = render(
      <TestProvider state={context}>
        <PreviewSection component={component} banner={banner} showExpanded={false} />
      </TestProvider>
    );

    expect(getByTestId(`${PREVIEW_SECTION_TEST_ID}BannerPanel`)).toHaveClass(
      `euiPanel--${banner.backgroundColor}`
    );
    expect(getByTestId(`${PREVIEW_SECTION_TEST_ID}BannerText`)).toHaveStyle(
      `color: ${banner.textColor}`
    );
    expect(getByText(title)).toBeInTheDocument();
  });
});
