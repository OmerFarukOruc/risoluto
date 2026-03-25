import { Counter, Gauge, Histogram, Registry } from "prom-client";

type Labels = Record<string, string>;

export class CounterMetric {
  constructor(private readonly counter: Counter<string>) {}

  increment(labels: Labels = {}): void {
    this.counter.inc(labels, 1);
  }
}

export class HistogramMetric {
  constructor(private readonly histogram: Histogram<string>) {}

  observe(value: number, labels: Labels = {}): void {
    this.histogram.observe(labels, value);
  }
}

export class GaugeMetric {
  constructor(private readonly gauge: Gauge<string>) {}

  set(value: number, labels: Labels = {}): void {
    this.gauge.set(labels, value);
  }
}

/**
 * Prometheus-format metrics collector for Symphony.
 *
 * Tracks HTTP requests, request durations, orchestrator polls,
 * agent run completions, and container resource snapshots.
 * Expose via `GET /metrics`.
 */
export class MetricsCollector {
  private readonly registry = new Registry();

  readonly httpRequestsTotal = new CounterMetric(
    new Counter({
      name: "symphony_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "status"],
      registers: [this.registry],
    }),
  );

  readonly httpRequestDurationSeconds = new HistogramMetric(
    new Histogram({
      name: "symphony_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "status"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    }),
  );

  readonly orchestratorPollsTotal = new CounterMetric(
    new Counter({
      name: "symphony_orchestrator_polls_total",
      help: "Orchestrator poll cycles",
      labelNames: ["status"],
      registers: [this.registry],
    }),
  );

  readonly agentRunsTotal = new CounterMetric(
    new Counter({
      name: "symphony_agent_runs_total",
      help: "Agent run completions by status",
      labelNames: ["outcome"],
      registers: [this.registry],
    }),
  );

  readonly containerCpuPercent = new GaugeMetric(
    new Gauge({
      name: "symphony_container_cpu_percent",
      help: "Container CPU usage percentage",
      labelNames: ["issue"],
      registers: [this.registry],
    }),
  );

  readonly containerMemoryPercent = new GaugeMetric(
    new Gauge({
      name: "symphony_container_memory_percent",
      help: "Container memory usage percentage",
      labelNames: ["issue"],
      registers: [this.registry],
    }),
  );

  async serialize(): Promise<string> {
    const output = await this.registry.metrics();
    const sections = [
      {
        marker: /^symphony_http_requests_total\b/m,
        fallback: "symphony_http_requests_total 0",
      },
      {
        marker: /^symphony_http_request_duration_seconds_count\b/m,
        fallback: [
          'symphony_http_request_duration_seconds_bucket{le="+Inf"} 0',
          "symphony_http_request_duration_seconds_sum 0",
          "symphony_http_request_duration_seconds_count 0",
        ].join("\n"),
      },
      {
        marker: /^symphony_orchestrator_polls_total\b/m,
        fallback: "symphony_orchestrator_polls_total 0",
      },
      {
        marker: /^symphony_agent_runs_total\b/m,
        fallback: "symphony_agent_runs_total 0",
      },
      {
        marker: /^symphony_container_cpu_percent\b/m,
        fallback: "symphony_container_cpu_percent 0",
      },
      {
        marker: /^symphony_container_memory_percent\b/m,
        fallback: "symphony_container_memory_percent 0",
      },
    ];

    const missingSections = sections
      .filter((section) => !section.marker.test(output))
      .map((section) => section.fallback);

    return missingSections.length > 0 ? `${output}\n${missingSections.join("\n")}\n` : output;
  }
}

export const globalMetrics = new MetricsCollector();
