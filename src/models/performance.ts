/**
 * Interface defining performance metric.
 */
export interface Metric {
  /** Metric name. */
  name: string;

  /** Metric value. */
  value: number;

}

/**
 * Interface defining performance metric results.
 */
export interface PerformanceMetricsResult {
  [key: string]: number;
}

