/**
 * Every table, assembled: the app's one import of the whole data set.
 *
 * It was a hand-written object whose rows were mutated in place at module
 * load — for each key ending in `Id`, if a table of that name existed, the
 * row it named was assigned onto the row — which made a link a guess from a
 * field name, left the result order-dependent, and put the whole set on
 * `window.magickData`. It is now [assemble()](./assemble.ts) over
 * [the tables](./tables.ts), with [the graph](./graph.ts) saying what links
 * to what. The keys are the same, plus the five tables the barrel never had.
 *
 * A page that wants one table should import that table, not this: the barrel
 * pulls in everything it can reach.
 */
import { assemble } from "./assemble";
import { tables } from "./tables";

const data = assemble(tables);

export default data;

export const { geomanicHouse, tetragram } = data;
