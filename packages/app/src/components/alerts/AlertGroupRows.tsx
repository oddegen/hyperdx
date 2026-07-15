import { Group, Stack, Text } from '@mantine/core';

import type { AlertsPageItem } from '@/types';

import { AckAlertGroup } from './AckAlert';
import { AlertHistoryCardStack } from './AlertHistoryCards';
import { AlertStateBadge } from './AlertStateBadge';

import styles from '@styles/AlertsPage.module.scss';

export function getAlertGroupDisplayName(group: string) {
  return group.replace(
    /^arrayElement\((\w+), '([^']+)'\):/,
    (_, mapName: string, key: string) => `${mapName}['${key}']:`,
  );
}

export function getVisibleAlertGroups(alert: AlertsPageItem) {
  return alert.groups?.filter(group => group.state === alert.state) ?? [];
}

export function AlertGroupRows({ alert }: { alert: AlertsPageItem }) {
  const groups = getVisibleAlertGroups(alert);
  if (!groups.length) return null;

  return (
    <Stack gap={0} className={styles.alertGroupRows}>
      {groups.map((group, index) => {
        const displayGroup = getAlertGroupDisplayName(group.group);

        return (
          <div
            key={group.group}
            className={styles.alertGroupRow}
            data-testid={`alert-group-row-${alert._id}-${index}`}
          >
            <Group gap="sm" wrap="nowrap" className={styles.alertGroupMeta}>
              <AlertStateBadge state={group.state} />
              <Text
                size="sm"
                className={styles.alertGroupLabel}
                title={group.group}
              >
                {displayGroup}
              </Text>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <AlertHistoryCardStack history={group.history} />
              <AckAlertGroup
                alertId={alert._id}
                group={group}
                parentSilenced={alert.silenced}
              />
            </Group>
          </div>
        );
      })}
    </Stack>
  );
}
