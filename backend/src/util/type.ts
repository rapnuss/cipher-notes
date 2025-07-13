export type Without<T, U> = {[P in Exclude<keyof T, keyof U>]?: never}

/**
 * XOR is needed to have a real mutually exclusive union type
 * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
 * https://github.com/maninak/ts-xor/blob/master/src/types/Xor.type.ts
 */
export type XOR<T, U> = T extends object
  ? U extends object
    ? (Without<T, U> & U) | (Without<U, T> & T)
    : U
  : T

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type AwaitedFn<Fn extends (...ags: unknown[]) => unknown> = Awaited<ReturnType<Fn>>

export type EqOr<A, B, Fallback> = A extends B ? (B extends A ? A : Fallback) : Fallback

export type FnArgs<T> = T extends (...args: infer U) => unknown ? U : never

export type FnProps<T> = T extends (arg: infer U) => unknown ? U : never

export type Overwrite<Base, Overrides> = Omit<Base, keyof Overrides> & Overrides

export type IterableT<T> = T extends Iterable<infer Item> ? Item : never

export type RecordKey<M> = M extends Record<infer K, unknown> ? K : never

export type RecordValue<M> = M extends Record<keyof object, infer V> ? V : never

export type JsonValue = string | number | boolean | null
export type JsonArr = (JsonValue | JsonArr | JsonObj)[]
export type JsonObj = {[key: string]: JsonValue | JsonArr | JsonObj}
export type JsonRoot = JsonArr | JsonObj
export type JsonAny = JsonValue | JsonArr | JsonObj

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & unknown
