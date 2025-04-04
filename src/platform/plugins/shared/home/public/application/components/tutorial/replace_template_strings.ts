/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Writer } from 'mustache';
import { getServices } from '../../kibana_services';

const TEMPLATE_TAGS: [string, string] = ['{', '}'];
interface TemplateContext {
  curlyOpen: '{';
  curlyClose: '}';
  config: {
    docs: {
      base_url: string;
      beats: {
        filebeat: string;
        metricbeat: string;
        heartbeat: string;
        winlogbeat: string;
        auditbeat: string;
      };
      logstash: string;
      version: string;
    };
    kibana: {
      version: string;
    };
  };
}

// Extend the MustacheWriter class to include the escapedValue method
class CustomMustacheWriter extends Writer {
  escapedValue(
    token: Array<string | number>,
    context: { lookup: (name: string | number) => string }
  ) {
    const value = context.lookup(token[1]);
    if (value != null) {
      return value;
    }
  }
}

// Can not use 'Mustache' since its a global object
const mustacheWriter = new CustomMustacheWriter();

export function replaceTemplateStrings(text: string) {
  const { tutorialService, kibanaVersion, docLinks } = getServices();
  const variables: TemplateContext = {
    // '{' and '}' can not be used in template since they are used as template tags.
    // Must use '{curlyOpen}'' and '{curlyClose}'
    curlyOpen: '{',
    curlyClose: '}',
    config: {
      ...tutorialService.getVariables(),
      docs: {
        base_url: docLinks.ELASTIC_WEBSITE_URL,
        beats: {
          filebeat: docLinks.links.filebeat.base,
          metricbeat: docLinks.links.metricbeat.base,
          heartbeat: docLinks.links.heartbeat.base,
          winlogbeat: docLinks.links.winlogbeat.base,
          auditbeat: docLinks.links.auditbeat.base,
        },
        logstash: docLinks.links.logstash.base,
        version: docLinks.DOC_LINK_VERSION,
      },
      kibana: {
        version: kibanaVersion,
      },
    },
  };
  mustacheWriter.parse(text, TEMPLATE_TAGS);
  return mustacheWriter.render(text, variables, {});
}
