export interface LadderLevel {
  start: string;
  end: string;
  /** Minimum number of transformations on an optimal path (start → end). */
  minSteps: number;
  /** One valid optimal path, if the generator computed one. Not required
   *  for play — players find their own route. */
  samplePath?: string[];
}
