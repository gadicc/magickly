"use client";

import { useRouter } from "next/navigation";
import React from "react";
import styles from "./hallPage.module.css";

/** One hall in the select: its page and its label ("Practicus · Part 1"). */
export interface HallJumpOption {
  href: string;
  label: string;
}

/**
 * "Jump to hall" on a phone (plan 062's amendment, A4): a native select,
 * grouped by grade, whose choice opens that hall's page. The phone's own
 * picker is the best list control there is. Without JavaScript it does
 * nothing, and the trail and the previous and next links remain. The
 * groups come from the server, so this holds no hall data of its own.
 *
 * The choice stays shown while the next page loads, rather than snapping
 * back to the current hall, and follows the page once it has changed.
 */
export default function HallJump({
  groups,
  current,
}: {
  groups: { name: string; halls: HallJumpOption[] }[];
  current: string;
}) {
  const router = useRouter();
  const id = React.useId();
  const [chosen, setChosen] = React.useState(current);
  React.useEffect(() => setChosen(current), [current]);
  return (
    <div className={styles.jump}>
      <label htmlFor={id} className={styles.jumpLabel}>
        Jump to hall
      </label>
      <select
        id={id}
        value={chosen}
        onChange={(event) => {
          setChosen(event.target.value);
          router.push(event.target.value);
        }}
      >
        {groups.map((group) => (
          <optgroup key={group.name} label={group.name}>
            {group.halls.map((hall) => (
              <option key={hall.href} value={hall.href}>
                {hall.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
