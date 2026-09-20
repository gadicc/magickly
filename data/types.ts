/**
 * Row types, derived from the JSON and [the graph](./graph.ts) together.
 *
 * Ids are `keyof typeof <table>`, so they are exact by construction and no
 * union is copied by hand. A link is a property on the row whose type is the
 * target table's row, so a four-hop read type-checks, and a table that was
 * not assembled has no accessor at all — reading it is a compile error rather
 * than `undefined` at runtime.
 *
 * Shape, from the spike recorded in plan 032: one flat mapped type per row
 * over a key union computed from the JSON and the graph literal. The key set
 * never recurses, so the cycles (sephirah → archangel → sephirah) live only
 * in property positions, which TypeScript instantiates lazily. `Graph` and
 * `Tables` are bound in rather than passed as type parameters, and `"*"`
 * stands for "every table"; the fully generic form checks identically and
 * prints the whole graph literal in every hover.
 *
 * Rows are uniform per table: the keys are unioned across the table's rows
 * and an absent one is typed `undefined`, so a partial relation reads
 * `hod.gdGrade?.planet?.hebrewLetter?.letter.he`. Per-row precision would
 * make hop two an error, because a link's target is the union of the target
 * table's rows.
 */
import type { Graph } from "./graph";
import type { NamedRows } from "./rows";
import type { TableName, Tables } from "./tables";

/** The tables an assembled object holds: some of them, or all of them. */
export type Scope = TableName | "*";

type Included<I extends Scope> = "*" extends I
  ? TableName
  : Extract<I, TableName>;

/** A table's rows as a union: an object table by key, an array table by index. */
export type Rows<T extends TableName> = Tables[T] extends readonly (infer R)[]
  ? R
  : Tables[T][keyof Tables[T]];

/** Every key any row of the table has. */
type UnionKeys<RU> = RU extends unknown ? keyof RU & string : never;

/** That key's type across the rows, `undefined` where a row lacks it. */
type UnionField<RU, K> = RU extends unknown
  ? K extends keyof RU
    ? RU[K]
    : undefined
  : never;

type Defined<V> = Exclude<V, undefined | null>;

/** The keys some of them lack. JSON stores `null`, never `undefined`. */
type Missing<RU> = {
  [K in UnionKeys<RU>]: undefined extends UnionField<RU, K> ? K : never;
}[UnionKeys<RU>];

/**
 * One shape per object at every depth, not only at the top: the keys unioned,
 * optional where one of them lacks it, and `readonly` throughout because
 * `assemble()` deep-freezes what it returns. Nested blocks differ row by row —
 * the sephirot have four shapes of `color` between them, five planets have no
 * Hebrew name — and without this a read of a key only some of them carry is
 * an error rather than a `string | undefined`. An array becomes a
 * `readonly` array of the same, uniformly; a primitive is left as it is.
 */
type Uniform<V> = [Defined<V>] extends [never]
  ? V
  : [Defined<V>] extends [object]
    ? [Defined<V>] extends [readonly (infer E)[]]
      ? readonly Uniform<E>[] | Extract<V, undefined | null>
      :
          | Simplify<
              {
                readonly [K in Exclude<
                  UnionKeys<Defined<V>>,
                  Missing<Defined<V>>
                >]: Uniform<UnionField<Defined<V>, K>>;
              } & {
                readonly [K in Missing<Defined<V>>]?: Uniform<
                  UnionField<Defined<V>, K>
                >;
              }
            >
          | Extract<V, undefined | null>
    : V;

/**
 * TypeScript refuses to index a deferred key-remapped mapped type with a
 * constrained key (TS2536); inside a one-parameter helper the key is naked
 * and it works.
 */
type Lookup<M, K> = K extends keyof M ? M[K] : never;

/** Flattens an intersection into one object, for a readable hover. */
type Simplify<T> = { [K in keyof T]: T[K] };

type LinksOf<T extends TableName> = Graph[T] extends { links: infer L }
  ? L
  : Record<never, never>;

type LinkFields<T extends TableName> = keyof LinksOf<T> & string;

/**
 * The accessor a field name gives, anchored at the end so that `Ids` never
 * matches `Id`: `planetId` → `planet`, `planetIds` → `planets`.
 */
type AccessorName<F extends string, D> = D extends {
  as: infer A extends string;
}
  ? A
  : F extends `${infer B}Ids`
    ? `${B}s`
    : F extends `${infer B}Id`
      ? B
      : never;

/** The raw value of a field, dotted paths included. */
type FieldValue<
  T extends TableName,
  F extends string,
> = F extends `${infer P}.${infer Rest}`
  ? UnionField<Exclude<UnionField<Rows<T>, P>, undefined | null>, Rest>
  : UnionField<Rows<T>, F>;

/** A link is optional exactly where the data leaves it out or nulls it. */
type Absent<T extends TableName, F extends string> =
  undefined extends FieldValue<T, F>
    ? undefined
    : null extends FieldValue<T, F>
      ? undefined
      : never;

/** Every table a link of `T` points at. */
type LinkTargets<T extends TableName> = {
  [F in LinkFields<T>]: Lookup<LinksOf<T>, F> extends {
    to: infer To extends TableName;
  }
    ? To
    : never;
}[LinkFields<T>];

/**
 * Every table either end of a link names. A scope that holds all of them gives
 * its rows every accessor `"*"` would, since a table outside it declares no
 * link into it and derives no back-link on it.
 */
type LinkedTables = {
  [T in TableName]: [LinkFields<T>] extends [never]
    ? never
    : T | LinkTargets<T>;
}[TableName];

/**
 * A row as it is printed: the interface [rows.ts](./rows.ts) declares for the
 * table, where the scope leaves no link out, and the mapped type itself where
 * a narrower `assemble()` gives its rows fewer links than that name means. The
 * two are structurally the same type; this only decides what a hover, an
 * error and a `.d.ts` say.
 *
 * The barrel is the case this is for. It assembles 23 of the 26 tables, the
 * three [data.ts](./data.ts) leaves out being named in no link either way, so
 * its rows are `Row<"*", T>` in everything but the scope written on them —
 * and without this they would print, and fail to be named in a `.d.ts`, as
 * the whole expansion. A link added to one of those three narrows the scope
 * and takes the names away again, which
 * [types.test.ts](./types.test.ts) asserts against.
 */
type Named<I extends Scope, T extends TableName> = "*" extends I
  ? NamedRows[T]
  : [Exclude<LinkedTables, I>] extends [never]
    ? NamedRows[T]
    : Row<I, T>;

type LinkValue<I extends Scope, T extends TableName, F extends string> =
  Lookup<LinksOf<T>, F> extends { to: infer To extends TableName }
    ?
        | (Lookup<LinksOf<T>, F> extends { many: true }
            ? readonly Named<I, To>[]
            : Named<I, To>)
        | Absent<T, F>
    : never;

/** Accessors from this table's own link fields, where the target is in scope. */
type TopLinks<T extends TableName, I extends Scope> = {
  [F in LinkFields<T> as F extends `${string}.${string}`
    ? never
    : Lookup<LinksOf<T>, F> extends { to: infer To }
      ? To extends Included<I>
        ? AccessorName<F, Lookup<LinksOf<T>, F>>
        : never
      : never]: F;
};

/** The prefix of a dotted link field, where its accessor lands. */
type NestKey<T extends TableName> = {
  [F in LinkFields<T>]: F extends `${infer P}.${string}` ? P : never;
}[LinkFields<T>];

type NestLinks<T extends TableName, I extends Scope, P extends string> = {
  [F in LinkFields<T> as F extends `${P}.${infer Rest}`
    ? Lookup<LinksOf<T>, F> extends { to: infer To }
      ? To extends Included<I>
        ? AccessorName<Rest, Lookup<LinksOf<T>, F>>
        : never
      : never
    : never]: F;
};

type NestValue<I extends Scope, T extends TableName, P extends string> =
  | Simplify<
      Uniform<Defined<UnionField<Rows<T>, P>>> & {
        readonly [K in keyof NestLinks<T, I, P>]: LinkValue<
          I,
          T,
          Lookup<NestLinks<T, I, P>, K> & string
        >;
      }
    >
  | (undefined extends UnionField<Rows<T>, P> ? undefined : never);

/** The inverse accessors `S` declares on `T`'s rows. */
type InverseName<S extends TableName, T extends TableName> = {
  [F in LinkFields<S>]: Lookup<LinksOf<S>, F> extends {
    to: T;
    inverse: infer N extends string;
  }
    ? N
    : never;
}[LinkFields<S>];

type InverseIsMany<S extends TableName, T extends TableName> = {
  [F in LinkFields<S>]: Lookup<LinksOf<S>, F> extends { to: T; inverse: string }
    ? Lookup<LinksOf<S>, F> extends { inverseMany: true }
      ? true
      : false
    : never;
}[LinkFields<S>];

/** Back-links derived on this table, by the accessor name they take. */
type Inverses<T extends TableName, I extends Scope> = {
  [S in Included<I> as InverseName<S, T>]: S;
};

type InverseValue<I extends Scope, T extends TableName, S extends TableName> = [
  InverseIsMany<S, T>,
] extends [true]
  ? readonly Named<I, S>[]
  : Named<I, S> | undefined;

/** Everything `assemble()` adds to a row of `T`, and nothing it already had. */
export type Links<I extends Scope, T extends TableName> = {
  readonly [K in
    | (keyof TopLinks<T, I> & string)
    | (keyof Inverses<T, I> & string)]: K extends keyof TopLinks<T, I>
    ? LinkValue<I, T, Lookup<TopLinks<T, I>, K> & string>
    : InverseValue<I, T, Lookup<Inverses<T, I>, K> & TableName>;
};

/** One of a row's own fields, which for a nested block carries its accessor. */
type OwnField<I extends Scope, T extends TableName, K extends string> =
  K extends NestKey<T> ? NestValue<I, T, K> : Uniform<UnionField<Rows<T>, K>>;

/**
 * An assembled row of `T`: its own fields, and its links into `I`. The links
 * are always there, because `assemble()` gives every row of the table the
 * accessor and leaves it `undefined` where the id is not.
 *
 * Every property is `readonly`, at every depth and through the arrays,
 * because the object `assemble()` returns is deep-frozen: an assignment used
 * to compile and throw, and is now the compile error it always was at
 * runtime ([types.test.ts](./types.test.ts)).
 */
export type Row<I extends Scope, T extends TableName> = Simplify<
  {
    readonly [K in Exclude<UnionKeys<Rows<T>>, Missing<Rows<T>>>]: OwnField<
      I,
      T,
      K
    >;
  } & {
    readonly [K in Missing<Rows<T>>]?: OwnField<I, T, K>;
  } & Links<I, T>
>;

/** A row as the JSON has it, uniform across the table and with no links. */
export type Raw<T extends TableName> = Uniform<Rows<T>>;

/** An assembled table: keyed as the JSON keys it, or an array where it is one. */
export type Table<
  I extends Scope,
  T extends TableName,
> = Tables[T] extends readonly unknown[]
  ? readonly Named<I, T>[]
  : { readonly [K in keyof Tables[T]]: Named<I, T> };

/** What `assemble()` returns: the tables asked for, linked to each other. */
export type Assembled<I extends Scope> = {
  readonly [T in Included<I>]: Table<I, T>;
};
