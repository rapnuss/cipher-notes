type EqOr<A, B, Fallback> = A extends B ? (B extends A ? A : Fallback) : Fallback

export default class XSet<A> extends Set<A> {
  static fromItr<A>(iterable: Iterable<A>): XSet<A>
  static fromItr<A, B>(iterable: Iterable<A>, mapFn: (a: A) => B): XSet<B>
  static fromItr<A, B>(iterable: Iterable<A>, mapFn?: (a: A) => B) {
    if (mapFn) {
      const set = new XSet<B>()
      for (const item of iterable) set.add(mapFn(item))
      return set
    } else {
      return new XSet(iterable)
    }
  }

  addItr(iterable: Iterable<A>): this
  addItr<B>(iterable: Iterable<B>, mapFn: (b: B) => A): this
  addItr<B>(iterable: Iterable<A | B>, mapFn?: (b: B) => A) {
    for (const item of iterable) this.add(mapFn ? mapFn(item as B) : (item as A))
    return this
  }

  intersect<B>(that: Set<B>): XSet<A & B> {
    const res = new XSet<A & B>()
    for (const item of this) {
      if (that.has(item as any)) res.add(item as any)
    }
    return res
  }

  union<B>(that: Set<B>): XSet<A | B> {
    const res = new XSet<A | B>()
    for (const item of this) res.add(item)
    for (const item of that) res.add(item)
    return res
  }

  without<B>(iterable: Iterable<B>): XSet<EqOr<A, B, Exclude<A, B>>> {
    const res = new XSet<any>(this)
    for (const item of iterable) res.delete(item as any)
    return res
  }

  isSubset(superSet: Set<A>): boolean {
    for (const item of this) {
      if (!superSet.has(item)) return false
    }
    return true
  }

  isEqualTo<B>(that: Set<B>): boolean {
    if (this.size !== that.size) return false
    for (const item of this) {
      if (!that.has(item as any)) return false
    }
    return true
  }

  toArray(): A[] {
    return Array.from(this)
  }

  toRecord(): Record<A extends string ? A : string, true> {
    const res = {} as any
    for (const item of this) res[String(item)] = true
    return res
  }

  map<B>(fn: (a: A) => B): XSet<B> {
    return XSet.fromItr(this, fn)
  }

  filter(pred: (a: A) => boolean): XSet<A> {
    const set = new XSet<A>()
    for (const item of this) {
      if (pred(item)) set.add(item)
    }
    return set
  }
}
