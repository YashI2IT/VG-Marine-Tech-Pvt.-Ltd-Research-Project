/**
 * In-memory and rolling-window traffic analytics tracker.
 * Records actual request durations, payload bytes, status codes, and tenant attributions.
 * Computes genuine percentiles (p95, p99), hourly aggregates, and endpoint breakdowns.
 */

export interface RequestRecord {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  bytesIn: number;
  bytesOut: number;
  tenantId?: string | number;
  tenantName?: string;
}

export interface HourlyBucket {
  hour: string;
  requests: number;
  virtualSensorRuns: number;
  latencySum: number;
  latencyAvg: number;
}

class TrafficAnalyticsTracker {
  private requests: RequestRecord[] = [];
  private readonly maxRecords = 20000; // Keep rolling history in memory
  private activeSessionsCount = 1;
  private totalTelemetryBytesIngested = 0;

  public recordRequest(record: RequestRecord): void {
    this.requests.push(record);
    if (this.requests.length > this.maxRecords) {
      this.requests.shift();
    }
  }

  public recordTelemetryBytes(bytes: number): void {
    this.totalTelemetryBytesIngested += bytes;
  }

  public setActiveSessions(count: number): void {
    this.activeSessionsCount = Math.max(1, count);
  }

  public getSummary(windowMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = this.requests.filter((r) => r.timestamp >= cutoff);

    if (recent.length === 0) {
      return {
        totalRequests24h: 0,
        peakRps: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        bandwidthTodayGB: 0,
        activeUserSessions: this.activeSessionsCount,
        errorRate: "0.00%",
      };
    }

    const totalRequests24h = recent.length;
    const durations = recent.map((r) => r.durationMs).sort((a, b) => a - b);
    const avgLatencyMs =
      Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10;

    const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
    const p99Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.99));
    const p95LatencyMs = Math.round(durations[p95Index] * 10) / 10;
    const p99LatencyMs = Math.round(durations[p99Index] * 10) / 10;

    // Peak RPS in any 1-second slice
    const secondBuckets = new Map<number, number>();
    for (const r of recent) {
      const sec = Math.floor(r.timestamp / 1000);
      secondBuckets.set(sec, (secondBuckets.get(sec) || 0) + 1);
    }
    let peakRps = 0;
    for (const count of secondBuckets.values()) {
      if (count > peakRps) peakRps = count;
    }

    const totalBytes =
      recent.reduce((sum, r) => sum + r.bytesIn + r.bytesOut, 0) + this.totalTelemetryBytesIngested;
    const bandwidthTodayGB = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10000) / 10000;

    const errorCount = recent.filter((r) => r.statusCode >= 400).length;
    const errorRate = `${((errorCount / totalRequests24h) * 100).toFixed(2)}%`;

    return {
      totalRequests24h,
      peakRps,
      avgLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      bandwidthTodayGB,
      activeUserSessions: this.activeSessionsCount,
      errorRate,
    };
  }

  public getHourlyTraffic(): { hour: string; requests: number; virtualSensorRuns: number; latency: number }[] {
    const now = new Date();
    const buckets: { [key: string]: { requests: number; virtualSensorRuns: number; totalLat: number } } = {};

    // Generate 8 3-hour or 24 1-hour slots covering 24h
    for (let i = 23; i >= 0; i -= 3) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = `${d.getHours().toString().padStart(2, "0")}:00`;
      buckets[hourStr] = { requests: 0, virtualSensorRuns: 0, totalLat: 0 };
    }

    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    for (const r of this.requests) {
      if (r.timestamp < cutoff) continue;
      const d = new Date(r.timestamp);
      // Group to nearest 3-hour mark
      const h = Math.floor(d.getHours() / 3) * 3;
      const hourStr = `${h.toString().padStart(2, "0")}:00`;
      if (!buckets[hourStr]) {
        buckets[hourStr] = { requests: 0, virtualSensorRuns: 0, totalLat: 0 };
      }
      buckets[hourStr].requests++;
      buckets[hourStr].totalLat += r.durationMs;
      if (r.path.includes("virtual-sensor") || r.path.includes("predict")) {
        buckets[hourStr].virtualSensorRuns++;
      }
    }

    return Object.keys(buckets).map((hour) => {
      const b = buckets[hour];
      return {
        hour,
        requests: b.requests,
        virtualSensorRuns: b.virtualSensorRuns,
        latency: b.requests > 0 ? Math.round((b.totalLat / b.requests) * 10) / 10 : 0,
      };
    });
  }

  public getEndpointBreakdown(): { endpoint: string; hits: number; avgMs: number; errorRate: string }[] {
    const groups = new Map<string, { hits: number; totalDuration: number; errors: number }>();

    for (const r of this.requests) {
      // Normalize parameterized paths
      let normalized = r.path.split("?")[0];
      normalized = normalized.replace(/\/\d+/g, "/:id");
      normalized = normalized.replace(/\/rec_[a-zA-Z0-9_-]+/g, "/:id");
      normalized = normalized.replace(/\/batch_[a-zA-Z0-9_-]+/g, "/:id");

      const curr = groups.get(normalized) || { hits: 0, totalDuration: 0, errors: 0 };
      curr.hits++;
      curr.totalDuration += r.durationMs;
      if (r.statusCode >= 400) {
        curr.errors++;
      }
      groups.set(normalized, curr);
    }

    if (groups.size === 0) {
      return [];
    }

    return Array.from(groups.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        hits: stats.hits,
        avgMs: Math.round((stats.totalDuration / stats.hits) * 10) / 10,
        errorRate: `${((stats.errors / stats.hits) * 100).toFixed(2)}%`,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);
  }

  public getClientTenants(): { tenant: string; requests: number; share: string }[] {
    const tenants = new Map<string, number>();
    let total = 0;

    for (const r of this.requests) {
      let tenant = r.tenantName;
      if (!tenant) {
        if (r.tenantId === 1) tenant = "VG Marine Tech Fleet Ops";
        else if (r.tenantId === 5) tenant = "Sify";
        else if (r.tenantId) tenant = `Tenant #${r.tenantId}`;
        else tenant = "System / Gateway";
      }
      tenants.set(tenant, (tenants.get(tenant) || 0) + 1);
      total++;
    }

    if (total === 0) {
      return [];
    }

    return Array.from(tenants.entries())
      .map(([tenant, count]) => ({
        tenant,
        requests: count,
        share: `${((count / total) * 100).toFixed(1)}%`,
      }))
      .sort((a, b) => b.requests - a.requests);
  }
}

export const trafficTracker = new TrafficAnalyticsTracker();
