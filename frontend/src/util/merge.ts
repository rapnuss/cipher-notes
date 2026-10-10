import {diff3Merge} from 'node-diff3'

/**
 * Computes the longest common subsequence (LCS) of two arrays of strings.
 * @param a The first array of lines.
 * @param b The second array of lines.
 * @returns An array containing the common lines in order.
 */
export function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({length: m + 1}, () => Array(n + 1).fill(0))

  // Build the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  // Reconstruct the LCS from the dp table
  const lcs: string[] = []
  let i = m,
    j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]!)
      i--
      j--
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--
    } else {
      j--
    }
  }
  return lcs
}

export function twoWayMerge(serverText: string, localText: string): string {
  return threeWayMerge(null, localText, serverText)
}

export function threeWayMerge(
  baseText: string | null,
  localText: string,
  serverText: string,
): string {
  let baseLines: string[] = baseText?.split('\n') ?? []
  const localLines = localText.split('\n')
  const serverLines = serverText.split('\n')
  if (baseText === null) {
    baseLines = longestCommonSubsequence(localLines, serverLines)
  }
  const diff = diff3Merge(localLines, baseLines, serverLines)
  return diff
    .flatMap((block) =>
      block.ok ? block.ok
      : block.conflict ?
        ['<<<<<<< LOCAL', ...block.conflict.a, '=======', ...block.conflict.b, '>>>>>>> SERVER']
      : [],
    )
    .join('\n')
}

export function threeWayMergeArrays(
  baseArray: string[],
  localArray: string[],
  serverArray: string[],
): string[] {
  const diff = diff3Merge(localArray, baseArray, serverArray)
  return diff.flatMap((block) =>
    block.ok ? block.ok
    : block.conflict ? [...block.conflict.a, ...block.conflict.b]
    : [],
  )
}
