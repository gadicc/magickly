import { Fragment } from "react";

/**
 * A component's name, free to break between its words on a narrow screen
 * (`SevenBranchedCandleStick` is wider than a phone at a heading's size).
 */
export default function BreakableName({ name }: { name: string }) {
  let offset = 0;
  return name.split(/(?=[A-Z])/).map((word) => {
    const key = offset;
    offset += word.length;
    return (
      <Fragment key={key}>
        {key ? <wbr /> : null}
        {word}
      </Fragment>
    );
  });
}
