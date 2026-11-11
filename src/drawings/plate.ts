import styles from "./plate.module.css";

/**
 * The class that puts a drawing on a light card in the dark scheme, for an
 * element that already wraps it (plan 076, decision 4). The drawing itself
 * does not change, so its exports and server images do not either. In
 * light it adds nothing.
 */
export const plateClass: string = styles.plate;
