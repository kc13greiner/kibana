/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useCallback, useState } from 'react';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { stubIndexPattern } from '@kbn/data-plugin/common/stubs';
import { useFetchIndex } from '../../../../../common/containers/source';
import { NAME_ERROR } from '../event_filters_list';
import { useCurrentUser, useKibana } from '../../../../../common/lib/kibana';
import { licenseService } from '../../../../../common/hooks/use_license';
import type { AppContextTestRender } from '../../../../../common/mock/endpoint';
import { createAppRootMockRenderer } from '../../../../../common/mock/endpoint';
import userEvent from '@testing-library/user-event';
import type { ExceptionListItemSchema } from '@kbn/securitysolution-io-ts-list-types';

import { ENDPOINT_EVENT_FILTERS_LIST_ID } from '@kbn/securitysolution-list-constants';
import type {
  ArtifactFormComponentOnChangeCallbackProps,
  ArtifactFormComponentProps,
} from '../../../../components/artifact_list_page';
import { OperatingSystem } from '@kbn/securitysolution-utils';
import { EventFiltersForm } from './form';
import { EndpointDocGenerator } from '../../../../../../common/endpoint/generate_data';
import type { PolicyData } from '../../../../../../common/endpoint/types';
import { MAX_COMMENT_LENGTH } from '../../../../../../common/constants';
import {
  BY_POLICY_ARTIFACT_TAG_PREFIX,
  FILTER_PROCESS_DESCENDANTS_TAG,
  GLOBAL_ARTIFACT_TAG,
} from '../../../../../../common/endpoint/service/artifacts/constants';
import type { IHttpFetchError } from '@kbn/core-http-browser';

jest.mock('../../../../../common/lib/kibana');
jest.mock('../../../../../common/containers/source');
jest.mock('../../../../../common/hooks/use_license', () => {
  const licenseServiceInstance = {
    isPlatinumPlus: jest.fn(),
    isGoldPlus: jest.fn(),
  };
  return {
    licenseService: licenseServiceInstance,
    useLicense: () => {
      return licenseServiceInstance;
    },
  };
});

/** When some props and states change, `EventFilterForm` will recreate its internal `processChanged` function,
 * and therefore will call it from a `useEffect` hook.
 *
 * Amongst the aforementioned props is the item itself, which comes from the outside - the test environment.
 * Amongst the aforementioned states is the `hasFormChanged` state, which will change from `false` to `true`
 * on the first user action.
 *
 * In the browser, the `item` prop is a state, a state from the parent component, therefore both
 * `item` and `hasFormChange` will change at the same re-render, which ensures that the `useEffect` will
 * call `processChanged` with consistent data.
 *
 * In the test environment, however, we need a trick to make sure that the data is updated in the same re-render
 * both outside and inside the component, in order to not receive additional calls from `processChanged` with outdated
 * data.
 *
 * This `TestComponentWrapper` component is meant to provide this kind of syncronisation, by turning the `item` prop
 * into a state.
 *
 */
const TestComponentWrapper: typeof EventFiltersForm = (formProps: ArtifactFormComponentProps) => {
  const [item, setItem] = useState(formProps.item);

  const handleOnChange: ArtifactFormComponentProps['onChange'] = useCallback(
    (formStatus) => {
      setItem(formStatus.item);
      formProps.onChange(formStatus);
    },
    [formProps]
  );

  return <EventFiltersForm {...formProps} item={item} onChange={handleOnChange} />;
};

describe('Event filter form', () => {
  const formPrefix = 'eventFilters-form';
  const generator = new EndpointDocGenerator('effected-policy-select');

  let formProps: jest.Mocked<ArtifactFormComponentProps>;
  let mockedContext: AppContextTestRender;
  let renderResult: ReturnType<AppContextTestRender['render']>;
  let latestUpdatedItem: ArtifactFormComponentProps['item'];
  let isLatestUpdatedItemValid: boolean;

  const getUI = () => <TestComponentWrapper {...formProps} />;
  const render = () => {
    return (renderResult = mockedContext.render(getUI()));
  };
  const rerender = () => renderResult.rerender(getUI());
  const rerenderWithLatestProps = () => {
    formProps.item = latestUpdatedItem;
    rerender();
  };

  function createEntry(
    overrides?: ExceptionListItemSchema['entries'][number]
  ): ExceptionListItemSchema['entries'][number] {
    const defaultEntry: ExceptionListItemSchema['entries'][number] = {
      field: '',
      operator: 'included',
      type: 'match',
      value: '',
    };

    return {
      ...defaultEntry,
      ...overrides,
    };
  }

  function createItem(
    overrides: Partial<ArtifactFormComponentProps['item']> = {}
  ): ArtifactFormComponentProps['item'] {
    const defaults: ArtifactFormComponentProps['item'] = {
      id: 'some_item_id',
      list_id: ENDPOINT_EVENT_FILTERS_LIST_ID,
      name: '',
      description: '',
      os_types: [OperatingSystem.WINDOWS],
      entries: [createEntry()],
      type: 'simple',
      tags: [GLOBAL_ARTIFACT_TAG, FILTER_PROCESS_DESCENDANTS_TAG],
    };
    return {
      ...defaults,
      ...overrides,
    };
  }

  function createOnChangeArgs(
    overrides: Partial<ArtifactFormComponentOnChangeCallbackProps>
  ): ArtifactFormComponentOnChangeCallbackProps {
    const defaults = {
      item: createItem(),
      isValid: false,
    };
    return {
      ...defaults,
      ...overrides,
    };
  }

  function createPolicies(): PolicyData[] {
    const policies = [
      generator.generatePolicyPackagePolicy(),
      generator.generatePolicyPackagePolicy(),
    ];
    policies.map((p, i) => {
      p.id = `id-${i}`;
      p.name = `some-policy-${Math.random().toString(36).split('.').pop()}`;
      return p;
    });
    return policies;
  }

  const setValidItemForEditing = () => {
    formProps.mode = 'edit';
    formProps.item.name = 'item name';
    formProps.item.entries = [
      { field: 'test.field', operator: 'included', type: 'match', value: 'test value' },
    ];
  };

  beforeEach(async () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ username: 'test-username' });
    (useKibana as jest.Mock).mockReturnValue({
      services: {
        http: {},
        data: {},
        unifiedSearch: {},
        notifications: {},
      },
    });
    (licenseService.isPlatinumPlus as jest.Mock).mockReturnValue(true);
    mockedContext = createAppRootMockRenderer();
    latestUpdatedItem = createItem();
    (useFetchIndex as jest.Mock).mockImplementation(() => [
      false,
      {
        indexPatterns: stubIndexPattern,
      },
    ]);

    formProps = {
      item: latestUpdatedItem,
      mode: 'create',
      disabled: false,
      error: undefined,
      policiesIsLoading: false,
      onChange: jest.fn((updates) => {
        latestUpdatedItem = updates.item;
        isLatestUpdatedItemValid = updates.isValid;
      }),
      policies: [],
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe('Details and Conditions', () => {
    it('should render correctly without data', () => {
      formProps.policies = createPolicies();
      formProps.policiesIsLoading = true;
      formProps.item.tags = [
        formProps.policies.map((p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`)[0],
      ];
      formProps.item.entries = [];
      render();
      expect(renderResult.getByTestId('loading-spinner')).not.toBeNull();
    });

    it('should render correctly with data', async () => {
      formProps.policies = createPolicies();
      render();
      expect(renderResult.queryByTestId('loading-spinner')).toBeNull();
      expect(renderResult.getByTestId('exceptionsBuilderWrapper')).not.toBeNull();
    });

    it('should display sections', async () => {
      render();
      expect(renderResult.queryByText('Details')).not.toBeNull();
      expect(renderResult.queryByText('Conditions')).not.toBeNull();
      expect(renderResult.queryByText('Comments')).not.toBeNull();
    });

    it('should display name error only when on blur and empty name', async () => {
      render();
      expect(renderResult.queryByText(NAME_ERROR)).toBeNull();
      const nameInput = renderResult.getByTestId(`${formPrefix}-name-input`);
      fireEvent.blur(nameInput);
      rerenderWithLatestProps();
      expect(renderResult.queryByText(NAME_ERROR)).not.toBeNull();
    });

    it('should change name', async () => {
      render();
      const nameInput = renderResult.getByTestId(`${formPrefix}-name-input`);

      await userEvent.type(nameInput, 'Exception name');
      rerenderWithLatestProps();

      expect(formProps.item?.name).toBe('Exception name');
      expect(renderResult.queryByText(NAME_ERROR)).toBeNull();
    });

    it('should change name with a white space still shows an error', async () => {
      render();
      const nameInput = renderResult.getByTestId(`${formPrefix}-name-input`);

      await userEvent.type(nameInput, '   ');
      fireEvent.blur(nameInput);
      rerenderWithLatestProps();

      expect(formProps.item.name).toBe('');
      expect(renderResult.queryByText(NAME_ERROR)).not.toBeNull();
    });

    it('should change description', async () => {
      render();
      const descriptionInput = renderResult.getByTestId(`${formPrefix}-description-input`);

      await userEvent.type(descriptionInput, 'Exception description');
      rerenderWithLatestProps();

      expect(formProps.item.description).toBe('Exception description');
    });

    it('should change comments', async () => {
      render();
      const commentInput = renderResult.getByLabelText('Comment Input');

      await userEvent.type(commentInput, 'Exception comment');
      rerenderWithLatestProps();

      expect(formProps.item.comments).toEqual([{ comment: 'Exception comment' }]);
    });

    describe('when opened for editing', () => {
      beforeEach(() => {
        setValidItemForEditing();
      });

      it('item should not be valid when opened for editing', async () => {
        render();
        expect(isLatestUpdatedItemValid).toBe(false);
      });

      it('item should be valid after editing name', async () => {
        render();
        const nameInput = renderResult.getByTestId(`${formPrefix}-name-input`);

        await userEvent.type(nameInput, '2');

        expect(latestUpdatedItem.name).toBe('item name2');
        expect(isLatestUpdatedItemValid).toBe(true);
      });

      it('item should be valid after editing description', async () => {
        render();
        const descriptionInput = renderResult.getByTestId(`${formPrefix}-description-input`);

        await userEvent.type(descriptionInput, 'd');

        expect(latestUpdatedItem.description).toBe('d');
        expect(isLatestUpdatedItemValid).toBe(true);
      });

      it('item should be valid after editing comment', async () => {
        render();
        const commentInput = renderResult.getByLabelText('Comment Input');

        await userEvent.type(commentInput, 'c');

        expect(latestUpdatedItem.comments).toEqual([{ comment: 'c' }]);
        expect(isLatestUpdatedItemValid).toBe(true);
      });
    });
  });

  describe('Policy section', () => {
    beforeEach(() => {
      formProps.policies = createPolicies();
    });

    afterEach(() => {
      cleanup();
    });

    it('should display loader when policies are still loading', () => {
      formProps.policiesIsLoading = true;
      formProps.item.tags = [
        formProps.policies.map((p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`)[0],
      ];
      render();
      expect(renderResult.getByTestId('loading-spinner')).not.toBeNull();
    });

    it('should display the policy list when "per policy" is selected', async () => {
      render();
      await userEvent.click(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      );
      rerenderWithLatestProps();
      // policy selector should show up
      expect(
        renderResult.getByTestId(`${formPrefix}-effectedPolicies-policiesSelectable`)
      ).toBeTruthy();
    });

    it('should call onChange when a policy is selected from the policy selection', async () => {
      formProps.item.tags = [
        formProps.policies.map((p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`)[0],
      ];
      render();
      const policyId = formProps.policies[0].id;
      await userEvent.click(renderResult.getByTestId(`${formPrefix}-effectedPolicies-perPolicy`));
      await userEvent.click(renderResult.getByTestId(`policy-${policyId}`));
      formProps.item.tags = formProps.onChange.mock.calls[0][0].item.tags;
      rerender();
      const expected = createOnChangeArgs({
        item: {
          ...formProps.item,
          tags: [`${BY_POLICY_ARTIFACT_TAG_PREFIX}${policyId}`],
        },
      });
      expect(formProps.onChange).toHaveBeenCalledWith(expected);
    });

    it('should have global policy by default', async () => {
      render();
      expect(renderResult.getByTestId('eventFilters-form-effectedPolicies-global')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('should retain the previous policy selection when switching from per-policy to global', async () => {
      formProps.item.tags = [
        formProps.policies.map((p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`)[0],
      ];
      render();
      const policyId = formProps.policies[0].id;
      // move to per-policy and select the first
      await userEvent.click(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      );
      await userEvent.click(renderResult.getByTestId(`policy-${policyId}`));
      formProps.item.tags = formProps.onChange.mock.calls[0][0].item.tags;
      rerender();
      expect(
        renderResult.queryByTestId(`${formPrefix}-effectedPolicies-policiesSelectable`)
      ).toBeTruthy();
      expect(formProps.item.tags).toEqual([`${BY_POLICY_ARTIFACT_TAG_PREFIX}${policyId}`]);

      // move back to global
      await userEvent.click(renderResult.getByTestId('eventFilters-form-effectedPolicies-global'));
      // eslint-disable-next-line require-atomic-updates
      formProps.item.tags = [GLOBAL_ARTIFACT_TAG];
      rerenderWithLatestProps();
      expect(formProps.item.tags).toEqual([GLOBAL_ARTIFACT_TAG]);
      expect(
        renderResult.queryByTestId(`${formPrefix}-effectedPolicies-policiesSelectable`)
      ).toBeFalsy();

      // move back to per-policy
      await userEvent.click(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      );
      // eslint-disable-next-line require-atomic-updates
      formProps.item.tags = [`${BY_POLICY_ARTIFACT_TAG_PREFIX}${policyId}`];
      rerender();
      // on change called with the previous policy
      expect(formProps.item.tags).toEqual([`${BY_POLICY_ARTIFACT_TAG_PREFIX}${policyId}`]);
      // the previous selected policy should be selected
      // expect(renderResult.getByTestId(`policy-${policyId}`)).toHaveAttribute(
      //   'data-test-selected',
      //   'true'
      // );
    });

    it('should preserve other tags when updating artifact assignment', async () => {
      formProps.item.tags = ['some:random_tag'];
      render();
      const policyId = formProps.policies[0].id;
      // move to per-policy and select the first
      await userEvent.click(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      );
      await userEvent.click(renderResult.getByTestId(`policy-${policyId}`));

      expect(formProps.onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({
            tags: ['some:random_tag', `${BY_POLICY_ARTIFACT_TAG_PREFIX}id-0`],
          }),
        })
      );
    });

    describe('when opened for editing', () => {
      beforeEach(() => {
        setValidItemForEditing();
      });

      it('item should be valid after changing to global assignment', async () => {
        formProps.item.tags = [];
        render();
        expect(isLatestUpdatedItemValid).toBe(false);

        await userEvent.click(
          renderResult.getByTestId('eventFilters-form-effectedPolicies-global')
        );

        expect(isLatestUpdatedItemValid).toBe(true);
        expect(latestUpdatedItem.tags).toEqual([GLOBAL_ARTIFACT_TAG]);
      });

      it('item should be valid after changing to per policy assignment', async () => {
        formProps.item.tags = [GLOBAL_ARTIFACT_TAG];
        render();
        expect(isLatestUpdatedItemValid).toBe(false);

        await userEvent.click(
          renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
        );

        expect(isLatestUpdatedItemValid).toBe(true);
        expect(latestUpdatedItem.tags).toEqual([]);
      });

      it('item should be valid after changing policy assignment', async () => {
        formProps.item.tags = [];
        render();
        expect(isLatestUpdatedItemValid).toBe(false);

        const policyId = formProps.policies[0].id;
        await userEvent.click(renderResult.getByTestId(`policy-${policyId}`));

        expect(isLatestUpdatedItemValid).toBe(true);
        expect(latestUpdatedItem.tags).toEqual([`${BY_POLICY_ARTIFACT_TAG_PREFIX}${policyId}`]);
      });
    });
  });

  describe('Policy section with downgraded license', () => {
    beforeEach(() => {
      const policies = createPolicies();
      formProps.policies = policies;
      formProps.item.tags = [policies.map((p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`)[0]];
      formProps.mode = 'edit';
      // downgrade license
      (licenseService.isPlatinumPlus as jest.Mock).mockReturnValue(false);
    });

    it('should hide assignment section when no license', () => {
      render();
      formProps.item.tags = [GLOBAL_ARTIFACT_TAG];
      rerender();
      expect(renderResult.queryByTestId(`${formPrefix}-effectedPolicies`)).toBeNull();
    });

    it('should hide assignment section when create mode and no license even with by policy', () => {
      render();
      formProps.mode = 'create';
      rerender();
      expect(renderResult.queryByTestId(`${formPrefix}-effectedPolicies`)).toBeNull();
    });

    it('should show disabled assignment section when edit mode and no license with by policy', async () => {
      render();
      formProps.item.tags = [`${BY_POLICY_ARTIFACT_TAG_PREFIX}id-0`];
      rerender();

      expect(
        renderResult.queryByTestId('eventFilters-form-effectedPolicies-perPolicy')
      ).not.toBeNull();
      expect(renderResult.getByTestId('policy-id-0').getAttribute('aria-disabled')).toBe('true');
    });

    it("allows the user to set the event filter entry to 'Global' in the edit option", async () => {
      render();
      const globalButtonInput = renderResult.getByTestId(
        'eventFilters-form-effectedPolicies-global'
      ) as HTMLButtonElement;
      await userEvent.click(globalButtonInput);
      formProps.item.tags = [GLOBAL_ARTIFACT_TAG];
      rerender();
      const expected = createOnChangeArgs({
        item: {
          ...formProps.item,
          tags: [GLOBAL_ARTIFACT_TAG],
        },
      });
      expect(formProps.onChange).toHaveBeenCalledWith(expected);

      const policyItem = formProps.onChange.mock.calls[0][0].item.tags
        ? formProps.onChange.mock.calls[0][0].item.tags[0]
        : '';

      expect(policyItem).toBe(GLOBAL_ARTIFACT_TAG);
    });
  });

  describe('Filter process descendants', () => {
    beforeEach(() => {
      mockedContext.setExperimentalFlag({ filterProcessDescendantsForEventFiltersEnabled: true });
    });

    it('should not display selector when feature flag is disabled', () => {
      mockedContext.setExperimentalFlag({
        filterProcessDescendantsForEventFiltersEnabled: false,
      });
      render();

      expect(
        renderResult.queryByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      ).not.toBeInTheDocument();
    });

    it('should show `Events` filter selected when tags are missing', () => {
      delete formProps.item.tags;
      render();

      expect(renderResult.getByTestId(`${formPrefix}-filterEventsButton`)).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('should show `Events` filter selected when filtering process descendants is disabled in config', () => {
      formProps.item.tags = [];
      render();

      expect(renderResult.getByTestId(`${formPrefix}-filterEventsButton`)).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('should show `Process descendants` filter selected when enabled in config', () => {
      formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];
      render();

      expect(renderResult.getByTestId(`${formPrefix}-filterEventsButton`)).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('should add process tree filtering tag to tags when filtering descendants enabled', async () => {
      formProps.item.tags = [];
      render();

      await userEvent.click(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      );

      expect(latestUpdatedItem.tags).toStrictEqual([FILTER_PROCESS_DESCENDANTS_TAG]);
    });

    it('should remove process tree filtering tag from tags when filtering descendants disabled', async () => {
      formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];
      render();

      await userEvent.click(renderResult.getByTestId(`${formPrefix}-filterEventsButton`));

      expect(latestUpdatedItem.tags).toStrictEqual([]);
    });

    it('should add the tag always after policy assignment tags', async () => {
      formProps.policies = createPolicies();
      const perPolicyTags = formProps.policies.map(
        (p) => `${BY_POLICY_ARTIFACT_TAG_PREFIX}${p.id}`
      );
      formProps.item.tags = perPolicyTags;
      render();

      await userEvent.click(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      );
      expect(latestUpdatedItem.tags).toStrictEqual([
        ...perPolicyTags,
        FILTER_PROCESS_DESCENDANTS_TAG,
      ]);

      rerenderWithLatestProps();
      await userEvent.click(renderResult.getByTestId(`${formPrefix}-effectedPolicies-global`));
      expect(latestUpdatedItem.tags).toStrictEqual([
        FILTER_PROCESS_DESCENDANTS_TAG,
        GLOBAL_ARTIFACT_TAG,
      ]);

      rerenderWithLatestProps();
      await userEvent.click(renderResult.getByTestId(`${formPrefix}-filterEventsButton`));
      expect(latestUpdatedItem.tags).toStrictEqual([GLOBAL_ARTIFACT_TAG]);

      rerenderWithLatestProps();
      await userEvent.click(
        renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
      );
      expect(latestUpdatedItem.tags).toStrictEqual([
        GLOBAL_ARTIFACT_TAG,
        FILTER_PROCESS_DESCENDANTS_TAG,
      ]);

      rerenderWithLatestProps();
      await userEvent.click(
        renderResult.getByTestId('eventFilters-form-effectedPolicies-perPolicy')
      );
      expect(latestUpdatedItem.tags).toStrictEqual([
        FILTER_PROCESS_DESCENDANTS_TAG,
        ...perPolicyTags,
      ]);
    });

    it('should display a tooltip to the user', async () => {
      const tooltipIconSelector = `${formPrefix}-filterProcessDescendantsTooltip-tooltipIcon`;
      const tooltipTextSelector = `${formPrefix}-filterProcessDescendantsTooltip-tooltipText`;
      render();

      expect(renderResult.getByTestId(tooltipIconSelector)).toBeInTheDocument();
      expect(renderResult.queryByTestId(tooltipTextSelector)).not.toBeInTheDocument();

      await userEvent.hover(renderResult.getByTestId(tooltipIconSelector));

      expect(await renderResult.findByTestId(tooltipTextSelector)).toBeInTheDocument();
    });

    describe('when opened for editing', () => {
      beforeEach(() => {
        setValidItemForEditing();
      });

      it('item should be valid after changing to event filtering', async () => {
        formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];
        render();
        expect(isLatestUpdatedItemValid).toBe(false);

        await userEvent.click(renderResult.getByTestId(`${formPrefix}-filterEventsButton`));

        expect(isLatestUpdatedItemValid).toBe(true);
        expect(latestUpdatedItem.tags).toEqual([]);
      });

      it('item should be valid after changing to process descendant filtering', async () => {
        formProps.item.tags = [];
        render();
        expect(isLatestUpdatedItemValid).toBe(false);

        await userEvent.click(
          renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
        );

        expect(isLatestUpdatedItemValid).toBe(true);
        expect(latestUpdatedItem.tags).toEqual([FILTER_PROCESS_DESCENDANTS_TAG]);
      });
    });
  });

  describe('Warnings', () => {
    describe('duplicate fields', () => {
      it('should not show warning text when unique fields are added', async () => {
        formProps.item.entries = [
          {
            field: 'event.action',
            operator: 'included',
            type: 'match',
            value: 'some value',
          },
          {
            field: 'file.name',
            operator: 'excluded',
            type: 'match',
            value: 'some other value',
          },
        ];
        render();
        expect(await renderResult.findByDisplayValue('some value')).toBeInTheDocument();

        expect(
          renderResult.queryByTestId('duplicate-fields-warning-message')
        ).not.toBeInTheDocument();
      });

      it('should not show warning text when field values are not added', async () => {
        formProps.item.entries = [
          {
            field: 'event.action',
            operator: 'included',
            type: 'match',
            value: '',
          },
          {
            field: 'event.action',
            operator: 'excluded',
            type: 'match',
            value: '',
          },
        ];
        render();
        expect((await renderResult.findAllByTestId('fieldAutocompleteComboBox')).length).toBe(2);

        expect(
          renderResult.queryByTestId('duplicate-fields-warning-message')
        ).not.toBeInTheDocument();
      });

      it('should show warning text when duplicate fields are added with values', async () => {
        formProps.item.entries = [
          {
            field: 'event.action',
            operator: 'included',
            type: 'match',
            value: 'some value',
          },
          {
            field: 'event.action',
            operator: 'excluded',
            type: 'match',
            value: 'some other value',
          },
        ];
        render();

        expect(
          await renderResult.findByTestId('duplicate-fields-warning-message')
        ).toBeInTheDocument();
      });

      describe('in relation with Process Descendant filtering', () => {
        it('should not show warning text when event.category is added but feature flag is disabled', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: false,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 1',
            },
          ];
          formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];

          render();
          expect(await renderResult.findByDisplayValue('some value 1')).toBeInTheDocument();

          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();
        });

        it('should not show warning text when event.category is added but process descendant filter is disabled', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 2',
            },
          ];
          formProps.item.tags = [];

          render();
          expect(await renderResult.findByDisplayValue('some value 2')).toBeInTheDocument();

          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();
        });

        it('should not show warning text when event.category is NOT added and process descendant filter is enabled', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.action',
              operator: 'included',
              type: 'match',
              value: 'some value 3',
            },
          ];
          formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];

          render();
          expect(await renderResult.findByDisplayValue('some value 3')).toBeInTheDocument();

          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();
        });

        it('should show warning text when event.category is added and process descendant filter is enabled', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 4',
            },
          ];
          formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];

          render();
          expect(await renderResult.findByDisplayValue('some value 4')).toBeInTheDocument();

          expect(
            await renderResult.findByTestId('duplicate-fields-warning-message')
          ).toBeInTheDocument();
        });

        it('should add warning text when switching to process descendant filtering', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 5',
            },
          ];
          formProps.item.tags = [];

          render();
          expect(await renderResult.findByDisplayValue('some value 5')).toBeInTheDocument();
          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();

          // switch to Process Descendant filtering
          await userEvent.click(
            renderResult.getByTestId(`${formPrefix}-filterProcessDescendantsButton`)
          );
          rerenderWithLatestProps();

          expect(
            await renderResult.findByTestId('duplicate-fields-warning-message')
          ).toBeInTheDocument();
        });

        it('should remove warning text when switching from process descendant filtering', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 6',
            },
          ];
          formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];

          render();

          expect(
            await renderResult.findByTestId('duplicate-fields-warning-message')
          ).toBeInTheDocument();

          // switch to classic Event filtering
          await userEvent.click(renderResult.getByTestId(`${formPrefix}-filterEventsButton`));
          rerenderWithLatestProps();

          expect(await renderResult.findByDisplayValue('some value 6')).toBeInTheDocument();
          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();
        });

        it('should remove warning text when removing `event.category`', async () => {
          mockedContext.setExperimentalFlag({
            filterProcessDescendantsForEventFiltersEnabled: true,
          });

          formProps.item.entries = [
            {
              field: 'event.category',
              operator: 'included',
              type: 'match',
              value: 'some value 6',
            },
          ];
          formProps.item.tags = [FILTER_PROCESS_DESCENDANTS_TAG];

          render();

          expect(
            await renderResult.findByTestId('duplicate-fields-warning-message')
          ).toBeInTheDocument();

          // switch to classic Event filtering
          await userEvent.click(renderResult.getByTestId(`builderItemEntryDeleteButton`));
          rerenderWithLatestProps();

          expect(
            renderResult.queryByTestId('duplicate-fields-warning-message')
          ).not.toBeInTheDocument();
        });
      });
    });

    describe('wildcard with wrong operator', () => {
      it('should not show warning callout when wildcard is used with the "MATCHES" operator', async () => {
        formProps.item.entries = [
          {
            field: 'event.category',
            operator: 'included',
            type: 'wildcard',
            value: 'valuewithwildcard*',
          },
        ];
        render();
        expect(await renderResult.findByDisplayValue('valuewithwildcard*')).toBeInTheDocument();

        expect(
          renderResult.queryByTestId('wildcardWithWrongOperatorCallout')
        ).not.toBeInTheDocument();
      });

      it('should show warning callout when wildcard is used with the "IS" operator', async () => {
        formProps.item.entries = [
          {
            field: 'event.category',
            operator: 'included',
            type: 'match',
            value: 'valuewithwildcard*',
          },
        ];
        render();

        expect(
          await renderResult.findByTestId('wildcardWithWrongOperatorCallout')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Errors', () => {
    beforeEach(() => {
      render();
    });

    it('should not show warning text when unique fields are added', async () => {
      rerender();

      const commentInput = renderResult.getByLabelText('Comment Input');

      expect(
        renderResult.queryByText(
          `The length of the comment is too long. The maximum length is ${MAX_COMMENT_LENGTH} characters.`
        )
      ).toBeNull();
      act(() => {
        fireEvent.change(commentInput, {
          target: {
            value: [...new Array(MAX_COMMENT_LENGTH + 1).keys()].map((_) => 'a').join(''),
          },
        });
        fireEvent.blur(commentInput);
      });
      expect(
        renderResult.queryByText(
          `The length of the comment is too long. The maximum length is ${MAX_COMMENT_LENGTH} characters.`
        )
      ).not.toBeNull();
    });

    it('should display form submission errors', () => {
      const message = 'oh oh - error';
      formProps.error = new Error(message) as IHttpFetchError;
      const { getByTestId } = render();

      expect(getByTestId('eventFilters-form-submitError').textContent).toMatch(message);
    });
  });
});
