import { docInline } from "@/explorer/DocText";
import type { PropDoc } from "@/explorer/props";
import styles from "./componentPage.module.css";

/**
 * The props reference (plan 080, decision 6): every prop docgen reads, the
 * required first, with its type, its default where the source states one
 * in the parameters, and its JSDoc. Wide types scroll sideways in the
 * table's frame, not the page.
 */
export default function PropsTable({ props }: { props: readonly PropDoc[] }) {
  return (
    <div className={styles.tableFrame}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Prop</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop) => (
            <tr key={prop.name} id={`prop-${prop.name}`}>
              <th scope="row">
                <code>{prop.name}</code>
                {prop.required ? (
                  <span className={styles.required}> required</span>
                ) : null}
              </th>
              <td>
                <code>{prop.type}</code>
              </td>
              <td>{prop.default ? <code>{prop.default}</code> : null}</td>
              <td>{docInline(prop.description.replace(/\s*\n\s*/g, " "))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
