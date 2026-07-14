import { Group, Stack, Text } from '@mantine/core';

import type { AlertsPageItem } from '@/types';

import { AckAlertGroup } from './AckAlert';
import { AlertHistoryCardStack } from './AlertHistoryCards';
import { AlertStateBadge } from './AlertStateBadge';

import styles from '@styles/AlertsPage.module.scss';

export function AlertGroupRows({ alert }: { alert: AlertsPageItem }) {
  if (!alert.groups?.length) return null;

  return (
    <Stack gap={0} className={styles.alertGroupRows}>
      {alert.groups.map((group, index) => (
        <div
          key={group.group}
          className={styles.alertGroupRow}
          data-testid={`alert-group-row-${alert._id}-${index}`}
        >
          <Group gap="sm" wrap="nowrap">
            <AlertStateBadge state={group.state} />
            <Text size="sm" className={styles.alertGroupLabel}>
              {group.group}
            </Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <AlertHistoryCardStack history={group.history} />
            <AckAlertGroup alertId={alert._id} group={group} />
          </Group>
        </div>
      ))}
    </Stack>
  );
}
