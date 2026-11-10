import { ActionIcon, type ActionIconProps, Tooltip } from '@mantine/core';
import type { AriaAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Props = ActionIconProps &
  Pick<AriaAttributes, 'aria-pressed' | 'aria-haspopup' | 'aria-busy'> & {
    onClick?: () => void;
    disabled?: boolean;
    /** Said twice: the tooltip on hover, and the name a screen reader reads. */
    label: string;
    /** A tooltip other than the label, for a state the name shouldn't change with. */
    tooltip?: string;
    /** A link instead of a button. */
    to?: string;
    children: ReactNode;
  };

/**
 * An icon with its name: the toolbar's and page headers' buttons. Subtle and grey by the theme;
 * `lg` unless asked otherwise.
 */
export function IconButton({
  label,
  tooltip,
  to,
  size = 'lg',
  children,
  ...props
}: Props) {
  return (
    <Tooltip label={tooltip ?? label}>
      {to === undefined ? (
        <ActionIcon size={size} aria-label={label} {...props}>
          {children}
        </ActionIcon>
      ) : (
        <ActionIcon component={Link} to={to} size={size} aria-label={label} {...props}>
          {children}
        </ActionIcon>
      )}
    </Tooltip>
  );
}
