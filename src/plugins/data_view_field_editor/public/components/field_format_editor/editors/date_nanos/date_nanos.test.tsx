/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { shallow } from 'enzyme';
import type { FieldFormat } from '@kbn/field-formats-plugin/common';

import { DateNanosFormatEditor } from './date_nanos';

const fieldType = 'date_nanos';
const format = {
  getConverterFor: jest
    .fn()
    .mockImplementation(() => (input: string) => `converted date for ${input}`),
  getParamDefaults: jest.fn().mockImplementation(() => {
    return { pattern: 'MMM D, YYYY @ HH:mm:ss.SSSSSSSSS' };
  }),
};
const formatParams = {
  pattern: '',
};
const onChange = jest.fn();
const onError = jest.fn();

describe('DateFormatEditor', () => {
  it('should have a formatId', () => {
    expect(DateNanosFormatEditor.formatId).toEqual('date_nanos');
  });

  it('should render normally', async () => {
    const component = shallow(
      <DateNanosFormatEditor
        fieldType={fieldType}
        format={format as unknown as FieldFormat}
        formatParams={formatParams}
        onChange={onChange}
        onError={onError}
      />
    );

    expect(component).toMatchSnapshot();
  });
});
