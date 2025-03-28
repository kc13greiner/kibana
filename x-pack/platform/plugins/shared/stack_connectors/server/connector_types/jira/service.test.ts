/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import axios from 'axios';

import { createExternalService } from './service';
import { request, createAxiosResponse } from '@kbn/actions-plugin/server/lib/axios_utils';
import type { ExternalService } from './types';
import type { Logger } from '@kbn/core/server';
import { loggingSystemMock } from '@kbn/core/server/mocks';
import { actionsConfigMock } from '@kbn/actions-plugin/server/actions_config.mock';
import { getBasicAuthHeader } from '@kbn/actions-plugin/server';
import { ConnectorUsageCollector } from '@kbn/actions-plugin/server/types';
const logger = loggingSystemMock.create().get() as jest.Mocked<Logger>;

interface ResponseError extends Error {
  response?: { data: { errors: Record<string, string>; errorMessages?: string[] } };
}

jest.mock('axios');
jest.mock('@kbn/actions-plugin/server/lib/axios_utils', () => {
  const originalUtils = jest.requireActual('@kbn/actions-plugin/server/lib/axios_utils');
  return {
    ...originalUtils,
    request: jest.fn(),
  };
});

axios.create = jest.fn(() => axios);
const requestMock = request as jest.Mock;
const configurationUtilities = actionsConfigMock.create();

const issueTypesResponse = createAxiosResponse({
  data: {
    issueTypes: [
      {
        id: '10006',
        name: 'Task',
      },
      {
        id: '10007',
        name: 'Bug',
      },
    ],
  },
});

const issueResponse = {
  id: '10267',
  key: 'RJ-107',
  fields: { summary: 'Test title' },
};

const issuesResponse = [issueResponse];

describe('Jira service', () => {
  let service: ExternalService;
  let connectorUsageCollector: ConnectorUsageCollector;

  beforeAll(() => {
    connectorUsageCollector = new ConnectorUsageCollector({
      logger,
      connectorId: 'test-connector-id',
    });
    service = createExternalService(
      {
        // The trailing slash at the end of the url is intended.
        // All API calls need to have the trailing slash removed.
        config: { apiUrl: 'https://coolsite.net/', projectKey: 'CK' },
        secrets: { apiToken: 'token', email: 'elastic@elastic.com' },
      },
      logger,
      configurationUtilities,
      connectorUsageCollector
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExternalService', () => {
    test('throws without url', () => {
      expect(() =>
        createExternalService(
          {
            config: { apiUrl: null, projectKey: 'CK' },
            secrets: { apiToken: 'token', email: 'elastic@elastic.com' },
          },
          logger,
          configurationUtilities,
          connectorUsageCollector
        )
      ).toThrow();
    });

    test('throws without projectKey', () => {
      expect(() =>
        createExternalService(
          {
            config: { apiUrl: 'test.com', projectKey: null },
            secrets: { apiToken: 'token', email: 'elastic@elastic.com' },
          },
          logger,
          configurationUtilities,
          connectorUsageCollector
        )
      ).toThrow();
    });

    test('throws without email/username', () => {
      expect(() =>
        createExternalService(
          {
            config: { apiUrl: 'test.com', projectKey: 'CK' },
            secrets: { apiToken: 'token' },
          },
          logger,
          configurationUtilities,
          connectorUsageCollector
        )
      ).toThrow();
    });

    test('throws without apiToken/password', () => {
      expect(() =>
        createExternalService(
          {
            config: { apiUrl: 'test.com', projectKey: 'CK' },
            secrets: { email: 'elastic@elastic.com' },
          },
          logger,
          configurationUtilities,
          connectorUsageCollector
        )
      ).toThrow();
    });

    test('uses the basic auth header for authentication', () => {
      createExternalService(
        {
          config: { apiUrl: 'https://coolsite.net/', projectKey: 'CK' },
          secrets: { apiToken: 'token', email: 'elastic@elastic.com' },
        },
        logger,
        configurationUtilities,
        connectorUsageCollector
      );

      expect(axios.create).toHaveBeenCalledWith({
        headers: getBasicAuthHeader({ username: 'elastic@elastic.com', password: 'token' }),
      });
    });
  });

  describe('getIncident', () => {
    const axiosRes = {
      data: {
        id: '1',
        key: 'CK-1',
        fields: {
          summary: 'title',
          description: 'description',
          created: '2021-10-20T19:41:02.754+0300',
          updated: '2021-10-20T19:41:02.754+0300',
        },
      },
    };

    test('it returns the incident correctly', async () => {
      requestMock.mockImplementation(() => createAxiosResponse(axiosRes));
      const res = await service.getIncident('1');
      expect(res).toEqual({
        id: '1',
        key: 'CK-1',
        summary: 'title',
        description: 'description',
        created: '2021-10-20T19:41:02.754+0300',
        updated: '2021-10-20T19:41:02.754+0300',
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() => createAxiosResponse(axiosRes));

      await service.getIncident('1');
      expect(requestMock).toHaveBeenCalledWith({
        axios,
        url: 'https://coolsite.net/rest/api/2/issue/1',
        logger,
        configurationUtilities,
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { summary: 'Required field' } } };
        throw error;
      });
      await expect(service.getIncident('1')).rejects.toThrow(
        '[Action][Jira]: Unable to get incident with id 1. Error: An error has occurred Reason: Required field'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ ...axiosRes, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.getIncident('1')).rejects.toThrow(
        '[Action][Jira]: Unable to get incident with id 1. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json Reason: unknown: errorResponse was null'
      );
    });

    test('it should throw if the required attributes are not there', async () => {
      requestMock.mockImplementation(() => createAxiosResponse({ data: { notRequired: 'test' } }));

      await expect(service.getIncident('1')).rejects.toThrow(
        '[Action][Jira]: Unable to get incident with id 1. Error: Response is missing at least one of the expected fields: id,key Reason: unknown: errorResponse was null'
      );
    });
  });

  describe('createIncident', () => {
    const incident = {
      incident: {
        summary: 'title',
        description: 'desc',
        labels: [],
        issueType: '10006',
        priority: 'High',
        parent: 'RJ-107',
        otherFields: null,
      },
    };

    test('it creates the incident correctly', async () => {
      /* The response from Jira when creating an issue contains only the key and the id.
      The function makes the following calls when creating an issue:
        1. Get issueTypes to set a default ONLY when incident.issueType is missing
        2. Create the issue.
        3. Get the created issue with all the necessary fields.
    */
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { summary: 'title', description: 'description' } },
        })
      );

      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { created: '2020-04-27T10:59:46.202Z' } },
        })
      );

      const res = await service.createIncident(incident);

      expect(res).toEqual({
        title: 'CK-1',
        id: '1',
        pushedDate: '2020-04-27T10:59:46.202Z',
        url: 'https://coolsite.net/browse/CK-1',
      });
    });

    test('it creates the incident correctly without issue type', async () => {
      // getIssueType mocks
      requestMock.mockImplementationOnce(() => issueTypesResponse);

      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { summary: 'title', description: 'description' } },
        })
      );

      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { created: '2020-04-27T10:59:46.202Z' } },
        })
      );

      const res = await service.createIncident({
        incident: {
          summary: 'title',
          description: 'desc',
          labels: [],
          priority: 'High',
          issueType: null,
          parent: null,
          otherFields: null,
        },
      });

      expect(res).toEqual({
        title: 'CK-1',
        id: '1',
        pushedDate: '2020-04-27T10:59:46.202Z',
        url: 'https://coolsite.net/browse/CK-1',
      });

      expect(requestMock).toHaveBeenCalledWith({
        axios,
        url: 'https://coolsite.net/rest/api/2/issue',
        logger,
        method: 'post',
        configurationUtilities,
        data: {
          fields: {
            summary: 'title',
            description: 'desc',
            project: { key: 'CK' },
            issuetype: { id: '10006' },
            labels: [],
            priority: { name: 'High' },
          },
        },
        connectorUsageCollector,
      });
    });

    test('removes newline characters and trialing spaces from summary', async () => {
      // getIssueType mocks
      requestMock.mockImplementationOnce(() => issueTypesResponse);

      // getIssueType mocks
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { summary: 'test', description: 'description' } },
        })
      );

      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: { id: '1', key: 'CK-1', fields: { created: '2020-04-27T10:59:46.202Z' } },
        })
      );

      await service.createIncident({
        incident: {
          summary: 'title \n      \n \n howdy   \r \r \n \r test',
          description: 'desc',
          labels: [],
          priority: 'High',
          issueType: null,
          parent: null,
          otherFields: null,
        },
      });

      expect(requestMock).toHaveBeenCalledWith({
        axios,
        url: 'https://coolsite.net/rest/api/2/issue',
        logger,
        method: 'post',
        configurationUtilities,
        data: {
          fields: {
            summary: 'title, howdy, test',
            description: 'desc',
            project: { key: 'CK' },
            issuetype: { id: '10006' },
            labels: [],
            priority: { name: 'High' },
          },
        },
        connectorUsageCollector,
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            id: '1',
            key: 'CK-1',
            fields: { created: '2020-04-27T10:59:46.202Z' },
          },
        })
      );

      await service.createIncident(incident);

      expect(requestMock).toHaveBeenCalledWith({
        axios,
        url: 'https://coolsite.net/rest/api/2/issue',
        logger,
        method: 'post',
        configurationUtilities,
        data: {
          fields: {
            summary: 'title',
            description: 'desc',
            project: { key: 'CK' },
            issuetype: { id: '10006' },
            labels: [],
            priority: { name: 'High' },
            parent: { key: 'RJ-107' },
          },
        },
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { summary: 'Required field' } } };
        throw error;
      });

      await expect(service.createIncident(incident)).rejects.toThrow(
        '[Action][Jira]: Unable to create incident. Error: An error has occurred. Reason: Required field'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.createIncident(incident)).rejects.toThrow(
        '[Action][Jira]: Unable to create incident. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });

    test('it should throw if the required attributes are not there', async () => {
      requestMock.mockImplementation(() => createAxiosResponse({ data: { notRequired: 'test' } }));

      await expect(service.createIncident(incident)).rejects.toThrow(
        '[Action][Jira]: Unable to create incident. Error: Response is missing at least one of the expected fields: id. Reason: unknown: errorResponse was null'
      );
    });

    describe('otherFields', () => {
      test('it should call request with correct arguments', async () => {
        const otherFields = { foo0: 'bar', foo1: true, foo2: 2 };

        requestMock.mockImplementation(() =>
          createAxiosResponse({
            data: {
              id: '1',
              key: 'CK-1',
              fields: { created: '2020-04-27T10:59:46.202Z' },
            },
          })
        );

        await service.createIncident({
          incident: { ...incident.incident, otherFields },
        });

        expect(requestMock).toHaveBeenCalledWith({
          axios,
          url: 'https://coolsite.net/rest/api/2/issue',
          logger,
          method: 'post',
          configurationUtilities,
          data: {
            fields: {
              summary: 'title',
              description: 'desc',
              project: { key: 'CK' },
              issuetype: { id: '10006' },
              labels: [],
              priority: { name: 'High' },
              parent: { key: 'RJ-107' },
              ...otherFields,
            },
          },
          connectorUsageCollector,
        });
      });
    });
  });

  describe('updateIncident', () => {
    const incident = {
      incidentId: '1',
      incident: {
        summary: 'title',
        description: 'desc',
        labels: [],
        issueType: '10006',
        priority: 'High',
        parent: 'RJ-107',
        otherFields: null,
      },
    };

    test('it updates the incident correctly', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            id: '1',
            key: 'CK-1',
            fields: { updated: '2020-04-27T10:59:46.202Z' },
          },
        })
      );

      const res = await service.updateIncident(incident);

      expect(res).toEqual({
        title: 'CK-1',
        id: '1',
        pushedDate: '2020-04-27T10:59:46.202Z',
        url: 'https://coolsite.net/browse/CK-1',
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            id: '1',
            key: 'CK-1',
            fields: { updated: '2020-04-27T10:59:46.202Z' },
          },
        })
      );

      await service.updateIncident(incident);

      expect(requestMock).toHaveBeenCalledWith({
        axios,
        logger,
        method: 'put',
        configurationUtilities,
        url: 'https://coolsite.net/rest/api/2/issue/1',
        data: {
          fields: {
            summary: 'title',
            description: 'desc',
            labels: [],
            priority: { name: 'High' },
            issuetype: { id: '10006' },
            project: { key: 'CK' },
            parent: { key: 'RJ-107' },
          },
        },
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { summary: 'Required field' } } };
        throw error;
      });

      await expect(service.updateIncident(incident)).rejects.toThrow(
        '[Action][Jira]: Unable to update incident with id 1. Error: An error has occurred. Reason: Required field'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.updateIncident(incident)).rejects.toThrow(
        '[Action][Jira]: Unable to update incident with id 1. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });

    describe('otherFields', () => {
      const otherFields = { foo0: 'bar', foo1: true, foo2: 2 };

      test('it should call request with correct arguments', async () => {
        requestMock.mockImplementation(() =>
          createAxiosResponse({
            data: {
              id: '1',
              key: 'CK-1',
              fields: { updated: '2020-04-27T10:59:46.202Z' },
            },
          })
        );

        await service.updateIncident({
          ...incident,
          incident: { ...incident.incident, otherFields },
        });

        expect(requestMock).toHaveBeenCalledWith({
          axios,
          logger,
          method: 'put',
          configurationUtilities,
          url: 'https://coolsite.net/rest/api/2/issue/1',
          data: {
            fields: {
              summary: 'title',
              description: 'desc',
              labels: [],
              priority: { name: 'High' },
              issuetype: { id: '10006' },
              project: { key: 'CK' },
              parent: { key: 'RJ-107' },
              ...otherFields,
            },
          },
          connectorUsageCollector,
        });
      });
    });
  });

  describe('createComment', () => {
    const commentReq = {
      incidentId: '1',
      comment: {
        comment: 'comment',
        commentId: 'comment-1',
      },
    };
    test('it creates the comment correctly', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            id: '1',
            key: 'CK-1',
            created: '2020-04-27T10:59:46.202Z',
          },
        })
      );

      const res = await service.createComment(commentReq);

      expect(res).toEqual({
        commentId: 'comment-1',
        pushedDate: '2020-04-27T10:59:46.202Z',
        externalCommentId: '1',
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            id: '1',
            key: 'CK-1',
            created: '2020-04-27T10:59:46.202Z',
          },
        })
      );

      await service.createComment(commentReq);

      expect(requestMock).toHaveBeenCalledWith({
        axios,
        logger,
        method: 'post',
        configurationUtilities,
        url: 'https://coolsite.net/rest/api/2/issue/1/comment',
        data: { body: 'comment' },
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { summary: 'Required field' } } };
        throw error;
      });

      await expect(service.createComment(commentReq)).rejects.toThrow(
        '[Action][Jira]: Unable to create comment at incident with id 1. Error: An error has occurred. Reason: Required field'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.createComment(commentReq)).rejects.toThrow(
        '[Action][Jira]: Unable to create comment at incident with id 1. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });

    test('it should throw if the required attributes are not there', async () => {
      requestMock.mockImplementation(() => createAxiosResponse({ data: { notRequired: 'test' } }));

      await expect(service.createComment(commentReq)).rejects.toThrow(
        '[Action][Jira]: Unable to create comment at incident with id 1. Error: Response is missing at least one of the expected fields: id,created. Reason: unknown: errorResponse was null'
      );
    });
  });

  describe('getIssueTypes', () => {
    test('it should return the issue types', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            issueTypes: issueTypesResponse.data.issueTypes,
          },
        })
      );

      const res = await service.getIssueTypes();

      expect(res).toEqual([
        {
          id: '10006',
          name: 'Task',
        },
        {
          id: '10007',
          name: 'Bug',
        },
      ]);
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            issueTypes: issueTypesResponse.data.issueTypes,
          },
        })
      );

      await service.getIssueTypes();

      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: 'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes',
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { issuetypes: 'Could not get issue types' } } };
        throw error;
      });

      await expect(service.getIssueTypes()).rejects.toThrow(
        '[Action][Jira]: Unable to get issue types. Error: An error has occurred. Reason: Could not get issue types'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.getIssueTypes()).rejects.toThrow(
        '[Action][Jira]: Unable to get issue types. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });

    test('it should work with data center response - issueTypes returned in data.values', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            values: issueTypesResponse.data.issueTypes,
          },
        })
      );

      await service.getIssueTypes();

      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: 'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes',
        connectorUsageCollector,
      });
    });
  });

  describe('getFieldsByIssueType', () => {
    test('it should return the fields', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            fields: [
              { required: true, schema: { type: 'string' }, fieldId: 'summary' },
              {
                required: false,
                schema: { type: 'string' },
                fieldId: 'priority',
                allowedValues: [
                  {
                    name: 'Medium',
                    id: '3',
                  },
                ],
                defaultValue: {
                  name: 'Medium',
                  id: '3',
                },
              },
            ],
          },
        })
      );

      const res = await service.getFieldsByIssueType('10006');

      expect(res).toEqual({
        priority: {
          required: false,
          schema: { type: 'string' },
          allowedValues: [{ id: '3', name: 'Medium' }],
          defaultValue: { id: '3', name: 'Medium' },
        },
        summary: {
          required: true,
          schema: { type: 'string' },
          allowedValues: [],
          defaultValue: {},
        },
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            fields: [
              { required: true, schema: { type: 'string' }, fieldId: 'summary' },
              {
                required: true,
                schema: { type: 'string' },
                fieldId: 'priority',
                allowedValues: [
                  {
                    name: 'Medium',
                    id: '3',
                  },
                ],
                defaultValue: {
                  name: 'Medium',
                  id: '3',
                },
              },
            ],
          },
        })
      );

      await service.getFieldsByIssueType('10006');

      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: 'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes/10006',
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { issuetypes: 'Could not get issue types' } } };
        throw error;
      });

      await expect(service.getFieldsByIssueType('10006')).rejects.toThrowError(
        '[Action][Jira]: Unable to get fields. Error: An error has occurred. Reason: Could not get issue types'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.getFieldsByIssueType('10006')).rejects.toThrow(
        '[Action][Jira]: Unable to get fields. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });

    test('it should work with data center response - issueTypes returned in data.values', async () => {
      requestMock.mockImplementationOnce(() =>
        createAxiosResponse({
          data: {
            values: [
              { required: true, schema: { type: 'string' }, fieldId: 'summary' },
              {
                required: false,
                schema: { type: 'string' },
                fieldId: 'priority',
                allowedValues: [
                  {
                    name: 'Medium',
                    id: '3',
                  },
                ],
                defaultValue: {
                  name: 'Medium',
                  id: '3',
                },
              },
            ],
          },
        })
      );

      const res = await service.getFieldsByIssueType('10006');

      expect(res).toEqual({
        priority: {
          required: false,
          schema: { type: 'string' },
          allowedValues: [{ id: '3', name: 'Medium' }],
          defaultValue: { id: '3', name: 'Medium' },
        },
        summary: {
          required: true,
          schema: { type: 'string' },
          allowedValues: [],
          defaultValue: {},
        },
      });
    });
  });

  describe('getIssues', () => {
    test('it should return the issues', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            issues: issuesResponse,
          },
        })
      );

      const res = await service.getIssues('Test title');

      expect(res).toEqual([
        {
          id: '10267',
          key: 'RJ-107',
          title: 'Test title',
        },
      ]);
    });

    test('it should return correct issue when special characters are used', async () => {
      const specialCharacterIssuesResponse = [
        {
          id: '77145',
          key: 'RJ-5696',
          fields: { summary: '[th!s^is()a-te+st-{~is*s&ue?or|and\\bye:}]"}]' },
        },
      ];
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            issues: specialCharacterIssuesResponse,
          },
        })
      );

      const res = await service.getIssues('[th!s^is()a-te+st-{~is*s&ue?or|and\\bye:}]"}]');

      expect(res).toEqual([
        {
          id: '77145',
          key: 'RJ-5696',
          title: '[th!s^is()a-te+st-{~is*s&ue?or|and\\bye:}]"}]',
        },
      ]);
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            issues: issuesResponse,
          },
        })
      );

      await service.getIssues('Test title');
      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: `https://coolsite.net/rest/api/2/search?jql=project%3D%22CK%22%20and%20summary%20~%22Test%20title%22`,
        connectorUsageCollector,
      });
    });

    test('it should escape JQL special characters', async () => {
      const specialCharacterIssuesResponse = [
        {
          id: '77145',
          key: 'RJ-5696',
          fields: { summary: '[th!s^is()a-te+st-{~is*s&ue?or|and\\bye:}]"}]' },
        },
      ];
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            issues: specialCharacterIssuesResponse,
          },
        })
      );

      await service.getIssues('[th!s^is()a-te+st-{~is*s&ue?or|and\\bye:}]"}]');
      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: `https://coolsite.net/rest/api/2/search?jql=project%3D%22CK%22%20and%20summary%20~%22%5C%5C%5Bth%5C%5C!s%5C%5C%5Eis%5C%5C(%5C%5C)a%5C%5C-te%5C%5C%2Bst%5C%5C-%5C%5C%7B%5C%5C~is%5C%5C*s%5C%5C%26ue%5C%5C%3For%5C%5C%7Cand%5C%5Cbye%5C%5C%3A%5C%5C%7D%5C%5C%5D%5C%5C%7D%5C%5C%5D%22`,
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { issuetypes: 'Could not get issue types' } } };
        throw error;
      });

      await expect(service.getIssues('Test title')).rejects.toThrow(
        '[Action][Jira]: Unable to get issues. Error: An error has occurred. Reason: Could not get issue types'
      );
    });

    test('it should show an error from errorMessages', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = {
          data: {
            errors: {
              issuestypes: 'My second error',
            },
            errorMessages: ['My first error'],
          },
        };
        throw error;
      });

      await expect(service.getIssues('<hj>"')).rejects.toThrow(
        '[Action][Jira]: Unable to get issues. Error: An error has occurred. Reason: My first error'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.getIssues('Test title')).rejects.toThrow(
        '[Action][Jira]: Unable to get issues. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });
  });

  describe('getIssue', () => {
    test('it should return a single issue', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: issueResponse,
        })
      );

      const res = await service.getIssue('RJ-107');

      expect(res).toEqual({
        id: '10267',
        key: 'RJ-107',
        title: 'Test title',
      });
    });

    test('it should call request with correct arguments', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({
          data: {
            issues: issuesResponse,
          },
        })
      );

      await service.getIssue('RJ-107');
      expect(requestMock).toHaveBeenLastCalledWith({
        axios,
        logger,
        method: 'get',
        configurationUtilities,
        url: `https://coolsite.net/rest/api/2/issue/RJ-107`,
        connectorUsageCollector,
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { issuetypes: 'Could not get issue types' } } };
        throw error;
      });

      await expect(service.getIssue('RJ-107')).rejects.toThrow(
        '[Action][Jira]: Unable to get issue with id RJ-107. Error: An error has occurred. Reason: Could not get issue types'
      );
    });

    test('it should throw if the request is not a JSON', async () => {
      requestMock.mockImplementation(() =>
        createAxiosResponse({ data: { id: '1' }, headers: { ['content-type']: 'text/html' } })
      );

      await expect(service.getIssue('Test title')).rejects.toThrow(
        '[Action][Jira]: Unable to get issue with id Test title. Error: Unsupported content type: text/html in GET https://example.com. Supported content types: application/json. Reason: unknown: errorResponse was null'
      );
    });
  });

  describe('getFields', () => {
    const callMocks = () => {
      requestMock
        .mockImplementationOnce(() =>
          createAxiosResponse({
            data: {
              issueTypes: issueTypesResponse.data.issueTypes,
            },
          })
        )
        .mockImplementationOnce(() =>
          createAxiosResponse({
            data: {
              fields: [
                { required: true, schema: { type: 'string' }, fieldId: 'summary' },
                { required: true, schema: { type: 'string' }, fieldId: 'description' },
                {
                  required: false,
                  schema: { type: 'string' },
                  fieldId: 'priority',
                  allowedValues: [
                    {
                      name: 'Medium',
                      id: '3',
                    },
                  ],
                  defaultValue: {
                    name: 'Medium',
                    id: '3',
                  },
                },
              ],
            },
          })
        )
        .mockImplementationOnce(() =>
          createAxiosResponse({
            data: {
              fields: [
                { required: true, schema: { type: 'string' }, fieldId: 'summary' },
                { required: true, schema: { type: 'string' }, fieldId: 'description' },
              ],
            },
          })
        );
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    test('it should call request with correct arguments', async () => {
      callMocks();
      await service.getFields();
      const callUrls = [
        'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes',
        'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes/10006',
        'https://coolsite.net/rest/api/2/issue/createmeta/CK/issuetypes/10007',
      ];
      requestMock.mock.calls.forEach((call, i) => {
        expect(call[0].url).toEqual(callUrls[i]);
      });
    });
    test('it returns common fields correctly', async () => {
      callMocks();
      const res = await service.getFields();
      expect(res).toEqual({
        description: {
          allowedValues: [],
          defaultValue: {},
          required: true,
          schema: { type: 'string' },
        },
        summary: {
          allowedValues: [],
          defaultValue: {},
          required: true,
          schema: { type: 'string' },
        },
      });
    });

    test('it should throw an error', async () => {
      requestMock.mockImplementation(() => {
        const error: ResponseError = new Error('An error has occurred');
        error.response = { data: { errors: { summary: 'Required field' } } };
        throw error;
      });
      await expect(service.getFields()).rejects.toThrow(
        '[Action][Jira]: Unable to get issue types. Error: An error has occurred. Reason: Required field'
      );
    });
  });
});
