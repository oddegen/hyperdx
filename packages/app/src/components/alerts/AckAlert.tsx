import * as React from 'react';
import type { Duration } from 'date-fns';
import { add } from 'date-fns';
import { Button, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBell } from '@tabler/icons-react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';

import api from '@/api';
import { ErrorBoundary } from '@/components/Error/ErrorBoundary';
import type { AlertsPageItem } from '@/types';
import { FormatTime } from '@/useFormatTime';
import { isAlertSilenceExpired } from '@/utils/alerts';

type AlertSilence = AlertsPageItem['silenced'];
type AlertGroup = NonNullable<AlertsPageItem['groups']>[number];

const ACK_DURATIONS: Array<{ label: string; duration: Duration }> = [
  { label: '30 minutes', duration: { minutes: 30 } },
  { label: '1 hour', duration: { hours: 1 } },
  { label: '6 hours', duration: { hours: 6 } },
  { label: '24 hours', duration: { hours: 24 } },
];

function getErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error) || !('response' in error)) return undefined;

  const { response } = error;
  if (!response || typeof response !== 'object' || !('status' in response)) {
    return undefined;
  }

  const { status } = response;
  return typeof status === 'number' ? status : undefined;
}

function AckMenu({
  isPending,
  onSilence,
  onUnsilence,
  secondarySilenced,
  secondarySilencedLabel,
  silenced,
  state,
}: {
  isPending: boolean;
  onSilence: (duration: Duration) => void;
  onUnsilence: () => void;
  secondarySilenced?: AlertSilence;
  secondarySilencedLabel?: string;
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
          {secondarySilenced?.at ? (
            <>
              <Menu.Divider />
              <Menu.Label py={6}>
                {secondarySilencedLabel ?? 'Group acknowledgment'}{' '}
                {secondarySilenced.by ? (
                  <>
                    by <strong>{secondarySilenced.by}</strong>
                  </>
                ) : null}
                <br />
                Resumes <FormatTime value={secondarySilenced.until} />.
              </Menu.Label>
            </>
          ) : null}
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
          {ACK_DURATIONS.map(({ label, duration }) => (
            <Menu.Item
              key={label}
              lh="1"
              py={8}
              onClick={() => onSilence(duration)}
            >
              {label}
            </Menu.Item>
          ))}
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
  queryClient: QueryClient;
}) {
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: api.getAlertsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: api.getAlertQueryKey(alertId),
      });
    },
    onError: (error: unknown) => {
      const status = getErrorStatus(error);
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
  parentSilenced,
}: {
  alertId: string;
  group: AlertGroup;
  parentSilenced?: AlertSilence;
}) {
  const queryClient = useQueryClient();
  const silenceAlertGroup = api.useSilenceAlertGroup();
  const unsilenceAlert = api.useUnsilenceAlert();
  const unsilenceAlertGroup = api.useUnsilenceAlertGroup();

  const mutateOptions = React.useMemo(
    () => getAckMutationOptions({ alertId, queryClient }),
    [queryClient, alertId],
  );

  const isParentSilenceActive = React.useMemo(() => {
    return parentSilenced?.at ? !isAlertSilenceExpired(parentSilenced) : false;
  }, [parentSilenced]);

  const shouldInheritParentSilence =
    group.state === 'ALERT' && isParentSilenceActive;

  const effectiveSilenced = shouldInheritParentSilence
    ? parentSilenced
    : group.silenced;

  const secondarySilenced =
    shouldInheritParentSilence && group.silenced ? group.silenced : undefined;

  const handleUnsilenceAlertGroup = React.useCallback(() => {
    if (shouldInheritParentSilence) {
      unsilenceAlert.mutate(alertId, mutateOptions);
      return;
    }

    unsilenceAlertGroup.mutate(
      {
        alertId,
        group: group.group,
      },
      mutateOptions,
    );
  }, [
    alertId,
    group.group,
    mutateOptions,
    shouldInheritParentSilence,
    unsilenceAlert,
    unsilenceAlertGroup,
  ]);

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
        isPending={
          silenceAlertGroup.isPending ||
          unsilenceAlert.isPending ||
          unsilenceAlertGroup.isPending
        }
        onSilence={handleSilenceAlertGroup}
        onUnsilence={handleUnsilenceAlertGroup}
        secondarySilenced={secondarySilenced}
        secondarySilencedLabel="Group acknowledgment"
        silenced={effectiveSilenced}
        state={group.state}
      />
    </ErrorBoundary>
  );
}
