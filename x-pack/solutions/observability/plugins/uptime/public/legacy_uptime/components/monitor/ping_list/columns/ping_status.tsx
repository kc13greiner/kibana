/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import moment from 'moment';
import { EuiBadge, EuiSpacer, EuiText, useEuiTheme } from '@elastic/eui';
import { Ping } from '../../../../../../common/runtime_types/ping';
import { MONITOR_TYPES, STATUS } from '../../../../../../common/constants';
import {
  STATUS_COMPLETE_LABEL,
  STATUS_DOWN_LABEL,
  STATUS_FAILED_LABEL,
  STATUS_UP_LABEL,
} from '../../../../../../common/translations/translations';

interface Props {
  pingStatus: string;
  item: Ping;
}

const getPingStatusLabel = (status: string, ping: Ping) => {
  if (ping.monitor.type === MONITOR_TYPES.BROWSER) {
    return status === 'up' ? STATUS_COMPLETE_LABEL : STATUS_FAILED_LABEL;
  }
  return status === 'up' ? STATUS_UP_LABEL : STATUS_DOWN_LABEL;
};

export const PingStatusColumn = ({ pingStatus, item }: Props) => {
  const theme = useEuiTheme();
  const isAmsterdam = theme.euiTheme.themeName === 'EUI_THEME_AMSTERDAM';

  const dangerBehindText = isAmsterdam
    ? theme.euiTheme.colors.vis.euiColorVisBehindText9
    : theme.euiTheme.colors.vis.euiColorVis6;

  const timeStamp = moment(item.timestamp);

  let checkedTime = '';

  if (moment().diff(timeStamp, 'd') > 1) {
    checkedTime = timeStamp.format('ll LTS');
  } else {
    checkedTime = timeStamp.format('LTS');
  }

  return (
    <div data-test-subj={`xpack.synthetics.pingList.ping-${item.docId}`}>
      <EuiBadge
        className="eui-textCenter"
        color={pingStatus === STATUS.UP ? 'success' : dangerBehindText}
      >
        {getPingStatusLabel(pingStatus, item)}
      </EuiBadge>
      <EuiSpacer size="xs" />
      <EuiText size="xs" color="subdued">
        {i18n.translate('xpack.uptime.pingList.recencyMessage', {
          values: { fromNow: checkedTime },
          defaultMessage: 'Checked {fromNow}',
          description:
            'A string used to inform our users how long ago Heartbeat pinged the selected host.',
        })}
      </EuiText>
    </div>
  );
};
