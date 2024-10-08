/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { registerRoutes } from '.';
import { ISavedObjectsManagement } from '../services';
import { coreMock, httpServiceMock } from '@kbn/core/server/mocks';

describe('registerRoutes', () => {
  it('registers the management routes', () => {
    const router = httpServiceMock.createRouter();
    const httpSetup = coreMock.createSetup().http;
    httpSetup.createRouter.mockReturnValue(router);
    const managementPromise = Promise.resolve({} as ISavedObjectsManagement);

    registerRoutes({
      http: httpSetup,
      managementServicePromise: managementPromise,
    });

    expect(httpSetup.createRouter).toHaveBeenCalledTimes(1);
    expect(router.get).toHaveBeenCalledTimes(3);
    expect(router.post).toHaveBeenCalledTimes(3);

    expect(router.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/kibana/management/saved_objects/_find',
      }),
      expect.any(Function)
    );
    expect(router.post).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/internal/kibana/management/saved_objects/_bulk_delete',
      }),
      expect.any(Function)
    );
    expect(router.post).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/kibana/management/saved_objects/_bulk_get',
      }),
      expect.any(Function)
    );
    expect(router.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/kibana/management/saved_objects/relationships/{type}/{id}',
      }),
      expect.any(Function)
    );
    expect(router.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/kibana/management/saved_objects/_allowed_types',
      }),
      expect.any(Function)
    );
    expect(router.post).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/kibana/management/saved_objects/scroll/counts',
      }),
      expect.any(Function)
    );
  });
});
