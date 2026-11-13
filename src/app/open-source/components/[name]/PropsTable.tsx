import { docInline } from "@/explorer/DocText";
import type { PropDoc } from "@/explorer/props";
import styles from "./componentPage.module.css";

/**
 * The props reference (plan 080, decision 6): every prop docgen reads, the
 * required first, with its type, its default where the source states one
 * in the parameters, and its JSDoc. Wide types scroll sideways in the
 * table's frame, not the page. On a phone the CSS lays each row out as a
 * block, so the roles are explicit: browsers drop a table's semantics
 * once its elements stop displaying as one.
 */
export default function PropsTable({ props }: { props: readonly PropDoc[] }) {
  return (
    <div className={styles.tableFrame}>
      <table className={styles.table} role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Prop
            </th>
            <th scope="col" role="columnheader">
              Type
            </th>
            <th scope="col" role="columnheader">
              Default
            </th>
            <th scope="col" role="columnheader">
              Description
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {props.map((prop) => (
            <tr key={prop.name} id={`prop-${prop.name}`} role="row">
              <th scope="row" role="rowheader">
                <code>{prop.name}</code>
                {prop.required ? (
                  <span className={styles.required}> required</span>
                ) : null}
              </th>
              <td role="cell">
                <code>{prop.type}</code>
              </td>
              <td role="cell">
                {prop.default ? <code>{prop.default}</code> : null}
              </td>
              <td role="cell">
                {docInline(prop.description.replace(/\s*\n\s*/g, " "))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
