import * as React from 'react';
import type { Duration } from 'date-fns';
import { add } from 'date-fns';
import { Button, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBell } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';

import api from '@/api';
import { ErrorBoundary } from '@/components/Error/ErrorBoundary';
import type { AlertsPageItem } from '@/types';
import { FormatTime } from '@/useFormatTime';
import { isAlertSilenceExpired } from '@/utils/alerts';

type AlertSilence = AlertsPageItem['silenced'];
type AlertGroup = NonNullable<AlertsPageItem['groups']>[number];

function AckMenu({
  isPending,
  onSilence,
  onUnsilence,
  silenced,
  state,
}: {
  isPending: boolean;
  onSilence: (duration: Duration) => void;
  onUnsilence: () => void;
  silenced?: AlertSilence;
  state?: AlertsPageItem['state'];
}) {
  const isNoLongerMuted = React.useMemo(() => {
    return isAlertSilenceExpired(silenced);
  }, [silenced]);

  if (silenced?.at) {
    return (
      <Menu>
        <Menu.Target>
          <Button
            size="compact-sm"
            variant="primary"
            color={
              isNoLongerMuted
                ? 'var(--color-bg-warning)'
                : 'var(--color-bg-success)'
            }
            leftSection={<IconBell size={16} />}
          >
            Ack&apos;d
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label py={6}>
            Acknowledged{' '}
            {silenced.by ? (
              <>
                by <strong>{silenced.by}</strong>
              </>
            ) : null}{' '}
            on <br />
            <FormatTime value={silenced.at} />
            .<br />
          </Menu.Label>

          <Menu.Label py={6}>
            {isNoLongerMuted ? (
              'Alert resumed.'
            ) : (
              <>
                Resumes <FormatTime value={silenced.until} />.
              </>
            )}
          </Menu.Label>
          <Menu.Item
            lh="1"
            py={8}
            color="orange"
            onClick={onUnsilence}
            disabled={isPending}
          >
            {isNoLongerMuted ? 'Unacknowledge' : 'Resume alert'}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }

  if (state === 'ALERT') {
    return (
      <Menu disabled={isPending}>
        <Menu.Target>
          <Button size="compact-sm" variant="secondary">
            Ack
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label lh="1" py={6}>
            Acknowledge and silence for
          </Menu.Label>
          <Menu.Item
            lh="1"
            py={8}
            onClick={() =>
              onSilence({
                minutes: 30,
              })
            }
          >
            30 minutes
          </Menu.Item>
          <Menu.Item
            lh="1"
            py={8}
            onClick={() =>
              onSilence({
                hours: 1,
              })
            }
          >
            1 hour
          </Menu.Item>
          <Menu.Item
            lh="1"
            py={8}
            onClick={() =>
              onSilence({
                hours: 6,
              })
            }
          >
            6 hours
          </Menu.Item>
          <Menu.Item
            lh="1"
            py={8}
            onClick={() =>
              onSilence({
                hours: 24,
              })
            }
          >
            24 hours
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }

  return null;
}

function getAckMutationOptions({
  alertId,
  queryClient,
}: {
  alertId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: api.getAlertsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: api.getAlertQueryKey(alertId),
      });
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      let message = 'Failed to silence alert, please try again later.';

      if (status === 404) {
        message = 'Alert not found.';
      } else if (status === 400) {
        message =
          'Invalid request. Please ensure the silence duration is valid.';
      }

      notifications.show({
        color: 'red',
        message,
      });
    },
  };
}

export function AckAlert({ alert }: { alert: AlertsPageItem }) {
  const queryClient = useQueryClient();
  const silenceAlert = api.useSilenceAlert();
  const unsilenceAlert = api.useUnsilenceAlert();

  const mutateOptions = React.useMemo(
    () => getAckMutationOptions({ alertId: alert._id, queryClient }),
    [queryClient, alert._id],
  );

  const handleUnsilenceAlert = React.useCallback(() => {
    unsilenceAlert.mutate(alert._id || '', mutateOptions);
  }, [alert._id, mutateOptions, unsilenceAlert]);

  const handleSilenceAlert = React.useCallback(
    (duration: Duration) => {
      // eslint-disable-next-line no-restricted-syntax
      const mutedUntil = add(new Date(), duration);
      silenceAlert.mutate(
        {
          alertId: alert._id || '',
          mutedUntil: mutedUntil.toISOString(),
        },
        mutateOptions,
      );
    },
    [alert._id, mutateOptions, silenceAlert],
  );

  return (
    <ErrorBoundary message="Failed to load alert acknowledgment menu">
      <AckMenu
        isPending={silenceAlert.isPending || unsilenceAlert.isPending}
        onSilence={handleSilenceAlert}
        onUnsilence={handleUnsilenceAlert}
        silenced={alert.silenced}
        state={alert.state}
      />
    </ErrorBoundary>
  );
}

export function AckAlertGroup({
  alertId,
  group,
}: {
  alertId: string;
  group: AlertGroup;
}) {
  const queryClient = useQueryClient();
  const silenceAlertGroup = api.useSilenceAlertGroup();
  const unsilenceAlertGroup = api.useUnsilenceAlertGroup();

  const mutateOptions = React.useMemo(
    () => getAckMutationOptions({ alertId, queryClient }),
    [queryClient, alertId],
  );

  const handleUnsilenceAlertGroup = React.useCallback(() => {
    unsilenceAlertGroup.mutate(
      {
        alertId,
        group: group.group,
      },
      mutateOptions,
    );
  }, [alertId, group.group, mutateOptions, unsilenceAlertGroup]);

  const handleSilenceAlertGroup = React.useCallback(
    (duration: Duration) => {
      // eslint-disable-next-line no-restricted-syntax
      const mutedUntil = add(new Date(), duration);
      silenceAlertGroup.mutate(
        {
          alertId,
          group: group.group,
          mutedUntil: mutedUntil.toISOString(),
        },
        mutateOptions,
      );
    },
    [alertId, group.group, mutateOptions, silenceAlertGroup],
  );

  return (
    <ErrorBoundary message="Failed to load alert group acknowledgment menu">
      <AckMenu
        isPending={silenceAlertGroup.isPending || unsilenceAlertGroup.isPending}
        onSilence={handleSilenceAlertGroup}
        onUnsilence={handleUnsilenceAlertGroup}
        silenced={group.silenced}
        state={group.state}
      />
    </ErrorBoundary>
  );
}
