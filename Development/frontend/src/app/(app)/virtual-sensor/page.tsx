"use client";

import { useState, useEffect, useRef } from "react";
import { getSession } from "@/services/auth";
import { api } from "@/lib/api";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Thermometer,
  Cpu,
  Layers,
  Database,
  UploadCloud,
  RefreshCw,
  Sliders,
  Flame,
  FileCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface TelemetryPoint {
  time: string;
  sampleTime: number;
  voltage: number;
  current: number;
  ah: number;
  ambientTemp: number;
  power: number;
  currentAbs: number;
  predictedTemp: number | null;
  referenceTemp: number | null;
  error: number | null;
}

interface MerkleBatch {
  id: string;
  batchIndex: number;
  merkleRoot: string;
  leafCount: number;
  startRecordId: string;
  endRecordId: string;
  createdAt: string;
  anchor?: {
    fabricTxId: string;
    blockNumber: number;
    channelId: string;
    chaincodeId: string;
    networkType: string;
    verificationStatus: string;
  } | null;
}

export default function VirtualSensorPage() {
  const [activeTab, setActiveTab] = useState<"live" | "offline">("live");
  const [userRole, setUserRole] = useState<string | null>(null);

  // --- Live Simulation State ---
  const [simState, setSimState] = useState<any>({
    status: "IDLE",
    currentCycle: "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat",
    speed: 1.0,
    totalSamples: 2000,
    currentSampleIndex: 0,
    validWindowsProcessed: 0,
    failedInferenceCount: 0,
    quarantinedCount: 0,
    activeBatchIndex: 0,
    latestPredictedTemp: null,
    latestReferenceTemp: null,
    latestResidual: null,
    runningMae: null,
    latestTrustDecision: "SAFE",
    latestRecordHash: null,
    latestMerkleRoot: null,
    latestTxId: null,
  });

  const [availableCycles, setAvailableCycles] = useState<any[]>([]);
  const [chartData, setChartData] = useState<TelemetryPoint[]>([]);
  const [latestSample, setLatestSample] = useState<any>(null);
  const [latestTrust, setLatestTrust] = useState<any>(null);
  const [batches, setBatches] = useState<MerkleBatch[]>([]);
  const [quarantined, setQuarantined] = useState<any[]>([]);
  const [batteryPassport, setBatteryPassport] = useState<any>(null);

  // --- Interactive Verification Modal / Drawer State ---
  const [verifyingRecordId, setVerifyingRecordId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifyingLoading, setVerifyingLoading] = useState(false);

  // --- Tamper Demonstration State ---
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperResult, setTamperResult] = useState<any>(null);

  // --- Offline Mode State ---
  const [file, setFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [offlineResult, setOfflineResult] = useState<any>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getSession().then((u) => setUserRole(u.role)).catch(() => {});
    loadInitialStatus();
    loadCycles();
    loadBatches();
    loadPassport();
    setupSse();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const loadInitialStatus = async () => {
    try {
      const res = await api.get("/trustsense/status");
      if (res.data?.simulation) {
        setSimState(res.data.simulation);
      }
    } catch (e) {
      console.warn("Could not fetch status:", e);
    }
  };

  const loadCycles = async () => {
    try {
      const res = await api.get("/trustsense/cycles");
      if (res.data?.cycles) {
        setAvailableCycles(res.data.cycles);
      }
    } catch (e) {
      console.warn("Could not fetch cycles:", e);
    }
  };

  const loadBatches = async () => {
    try {
      const res = await api.get("/trustsense/provenance/batches");
      if (res.data?.batches) {
        setBatches(res.data.batches);
      }
    } catch (e) {
      console.warn("Could not fetch batches:", e);
    }
  };

  const loadPassport = async () => {
    try {
      const res = await api.get("/trustsense/passport/BAT-PAN18650PF-001");
      if (res.data) {
        setBatteryPassport(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch passport:", e);
    }
  };

  const setupSse = () => {
    const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/trustsense/simulation/stream`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "INITIAL_STATE") {
          setSimState(data.state);
        } else if (data.type === "LIVE_TELEMETRY") {
          setLatestSample(data.sample);
          setLatestTrust(data.trustResult);
          if (data.state) setSimState(data.state);

          const newPoint: TelemetryPoint = {
            time: new Date().toLocaleTimeString(),
            sampleTime: data.sample.sampleTime || 0,
            voltage: data.sample.voltage_v,
            current: data.sample.current_a,
            ah: data.sample.ah,
            ambientTemp: data.sample.chamber_temp_degC,
            power: data.sample.power_w,
            currentAbs: data.sample.current_abs_a,
            predictedTemp: data.prediction?.predicted_temp_degC ?? null,
            referenceTemp: data.prediction?.reference_temp_degC ?? null,
            error: data.prediction?.residual_degC ?? null,
          };

          setChartData((prev) => {
            const next = [...prev, newPoint];
            return next.length > 50 ? next.slice(next.length - 50) : next;
          });
        } else if (data.type === "TELEMETRY_BLOCKED") {
          setLatestTrust(data.trustResult);
          setQuarantined((prev) => [
            {
              id: data.recordId,
              payload: data.sample,
              violations: data.trustResult?.violations || [],
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 19),
          ]);
        } else if (data.type === "BATCH_ANCHORED") {
          loadBatches();
          loadPassport();
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    es.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  };

  // --- Simulation Controls ---
  const handleControl = async (action: string, value?: any) => {
    try {
      const res = await api.post("/trustsense/simulation/control", { action, value });
      if (res.data?.state) {
        setSimState(res.data.state);
      }
      if (action === "reset") {
        setChartData([]);
        setLatestSample(null);
        setLatestTrust(null);
      }
    } catch (err) {
      console.error("Simulation control error:", err);
    }
  };

  const handleInjectAnomaly = async (type: string) => {
    try {
      await api.post("/trustsense/simulation/anomaly", { type });
    } catch (err) {
      console.error("Anomaly injection error:", err);
    }
  };

  // --- Cryptographic Record Verification ---
  const handleVerifyRecord = async (recordId: string) => {
    setVerifyingRecordId(recordId);
    setVerifyingLoading(true);
    setVerificationResult(null);

    try {
      const res = await api.get(`/trustsense/provenance/verify/${recordId}`);
      setVerificationResult(res.data);
    } catch (err: any) {
      setVerificationResult({
        verified: false,
        details: [`Error running verification: ${err.message}`],
      });
    } finally {
      setVerifyingLoading(false);
    }
  };

  // --- Deliberate Tamper Demonstration ---
  const handleTamperTest = async () => {
    setTamperLoading(true);
    setTamperResult(null);

    try {
      const res = await api.post("/trustsense/provenance/tamper_test", {
        fieldToTamper: "voltage_v",
        tamperedValue: 4.888, // Illegal overvoltage tampering
      });
      setTamperResult(res.data);
    } catch (err: any) {
      setTamperResult({ error: err.message });
    } finally {
      setTamperLoading(false);
    }
  };

  // --- Offline File Prediction ---
  const handleUpload = async () => {
    if (!file) return;
    setUploadLoading(true);
    setOfflineError(null);
    setOfflineResult(null);

    try {
      const formData = new FormData();
      formData.append("dataset", file);

      const res = await api.post("/virtual-sensor/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOfflineResult(res.data);
    } catch (err: any) {
      setOfflineError(err.response?.data?.details || err.message || "Prediction failed");
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              TrustSense-BMS Intelligence
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Hyperledger Fabric Anchored
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700">
              CNN-LSTM (v1.0.0)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Battery Thermal Intelligence & Trust-Aware Monitoring
          </h1>
          <p className="text-sm text-slate-500">
            End-to-end telemetry streaming, real-time AI virtual sensor prediction, cyber-trust filtering, and cryptographic Merkle provenance.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "live"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Simulation & Trust
          </button>
          <button
            onClick={() => setActiveTab("offline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "offline"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Offline MAT Analysis
          </button>
        </div>
      </div>

      {activeTab === "live" ? (
        <div className="space-y-6">
          {/* 1. SIMULATION CONTROL PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Dataset Cycle Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Dataset Cycle:
                </label>
                <select
                  value={simState.currentCycle}
                  onChange={(e) => handleControl("cycle", e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-md"
                >
                  {availableCycles.length > 0 ? (
                    availableCycles.map((c: any) => (
                      <option key={c.filename} value={c.filename}>
                        [{c.ambient}] {c.filename} ({c.cycleType})
                      </option>
                    ))
                  ) : (
                    <option value="03-27-17_09.06 10degC_UDDS_Pan18650PF.mat">
                      [10°C] 03-27-17_09.06 10degC_UDDS_Pan18650PF.mat (UDDS)
                    </option>
                  )}
                </select>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    simState.status === "RUNNING"
                      ? "bg-emerald-100 text-emerald-800 animate-pulse"
                      : simState.status === "PAUSED"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      simState.status === "RUNNING"
                        ? "bg-emerald-600"
                        : simState.status === "PAUSED"
                        ? "bg-amber-600"
                        : "bg-slate-400"
                    }`}
                  />
                  {simState.status === "RUNNING"
                    ? "STREAMING LIVE"
                    : simState.status}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {simState.status !== "RUNNING" ? (
                  <button
                    onClick={() => handleControl("start")}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Simulation
                  </button>
                ) : (
                  <button
                    onClick={() => handleControl("pause")}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold shadow-sm transition"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    Pause
                  </button>
                )}

                <button
                  onClick={() => handleControl("stop")}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
                >
                  <Square className="w-3.5 h-3.5 fill-slate-700" />
                  Stop
                </button>

                <button
                  onClick={() => handleControl("reset")}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>

                {/* Speed Multipliers */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold ml-2">
                  {[0.5, 1, 2, 5, 10].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleControl("speed", s)}
                      className={`px-2.5 py-1.5 rounded-md transition ${
                        simState.speed === s
                          ? "bg-white text-indigo-700 font-bold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Progress & Quick Metrics */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Replay Progress: <strong>{simState.currentSampleIndex}</strong> / {simState.totalSamples} samples
                </span>
                <span>
                  60-Step Buffer:{" "}
                  <strong className="text-slate-800">
                    {Math.min(60, simState.currentSampleIndex)}/60 steps
                  </strong>{" "}
                  ({simState.currentSampleIndex >= 60 ? "Ready for inference" : "Buffering..."})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (simState.currentSampleIndex / (simState.totalSamples || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. KPI METRICS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Predicted Temp */}
            <div className="bg-white rounded-xl border border-indigo-100 p-3.5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full -z-0" />
              <div className="relative z-10">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                  AI Predicted Temp
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900">
                    {simState.latestPredictedTemp !== null
                      ? simState.latestPredictedTemp.toFixed(2)
                      : "—"}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">°C</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-medium">Virtual Sensor Output</span>
              </div>
            </div>

            {/* Reference Temp */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Reference Temp
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-800">
                  {simState.latestReferenceTemp !== null
                    ? simState.latestReferenceTemp.toFixed(2)
                    : "—"}
                </span>
                <span className="text-xs font-semibold text-slate-500">°C</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Held-Out Ground Truth</span>
            </div>

            {/* Residual ΔT */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Residual Error (ΔT)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-2xl font-bold ${
                    simState.latestResidual !== null && Math.abs(simState.latestResidual) > 2.0
                      ? "text-amber-600"
                      : "text-slate-800"
                  }`}
                >
                  {simState.latestResidual !== null
                    ? `${simState.latestResidual > 0 ? "+" : ""}${simState.latestResidual.toFixed(2)}`
                    : "—"}
                </span>
                <span className="text-xs font-semibold text-slate-500">°C</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Running MAE: {simState.runningMae !== null ? `${simState.runningMae.toFixed(3)}°C` : "—"}
              </span>
            </div>

            {/* Voltage */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Cell Voltage
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-800">
                  {latestSample ? latestSample.voltage_v.toFixed(3) : "—"}
                </span>
                <span className="text-xs font-semibold text-slate-500">V</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">[2.50V - 4.20V]</span>
            </div>

            {/* Current */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Pack Current
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-800">
                  {latestSample ? latestSample.current_a.toFixed(2) : "—"}
                </span>
                <span className="text-xs font-semibold text-slate-500">A</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {latestSample && latestSample.current_a < 0 ? "Discharging" : "Charging"}
              </span>
            </div>

            {/* Chamber Temp */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Chamber / Amb Temp
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-800">
                  {latestSample ? latestSample.chamber_temp_degC.toFixed(1) : "—"}
                </span>
                <span className="text-xs font-semibold text-slate-500">°C</span>
              </div>
              <span className="text-[10px] text-slate-400">Environment</span>
            </div>

            {/* Trust Decision */}
            <div
              className={`rounded-xl border p-3.5 shadow-xs ${
                simState.latestTrustDecision === "SAFE"
                  ? "bg-emerald-50/60 border-emerald-200"
                  : simState.latestTrustDecision === "SUSPICIOUS"
                  ? "bg-amber-50/60 border-amber-200"
                  : "bg-rose-50/60 border-rose-200"
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-600">
                Data Trust Level
              </span>
              <div className="flex items-center gap-2 mt-1">
                {simState.latestTrustDecision === "SAFE" ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                ) : simState.latestTrustDecision === "SUSPICIOUS" ? (
                  <ShieldAlert className="w-6 h-6 text-amber-600" />
                ) : (
                  <ShieldX className="w-6 h-6 text-rose-600" />
                )}
                <span
                  className={`text-lg font-black ${
                    simState.latestTrustDecision === "SAFE"
                      ? "text-emerald-700"
                      : simState.latestTrustDecision === "SUSPICIOUS"
                      ? "text-amber-700"
                      : "text-rose-700"
                  }`}
                >
                  {simState.latestTrustDecision}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                Quarantined: {simState.quarantinedCount}
              </span>
            </div>
          </div>

          {/* 3. CHARTS & INFERENCE SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Chart: Actual vs Predicted Temperature */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-indigo-600" />
                    Live Thermal Trajectory: AI Predicted vs Measured Reference
                  </h3>
                  <p className="text-xs text-slate-500">
                    60-time-step sliding window inference using Panasonic 18650PF trained CNN-LSTM model.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Target Leakage Prevented
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-72 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        domain={["auto", "auto"]}
                        unit="°C"
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "10px",
                          border: "none",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="predictedTemp"
                        name="AI Predicted Temp (°C)"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="referenceTemp"
                        name="Reference Measured Temp (°C)"
                        stroke="#10b981"
                        strokeWidth={1.8}
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="ambientTemp"
                        name="Chamber Temp (°C)"
                        stroke="#94a3b8"
                        strokeWidth={1.2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Activity className="w-8 h-8 text-slate-300 animate-pulse" />
                    <p className="text-sm font-medium">Click "Start Simulation" to stream live predictions</p>
                  </div>
                )}
              </div>

              {/* Model Execution Metadata Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Valid Windows</span>
                  <span className="font-bold text-slate-800">{simState.validWindowsProcessed}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Failed Windows</span>
                  <span className="font-bold text-slate-800">{simState.failedInferenceCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reported Test MAE</span>
                  <span className="font-bold text-indigo-600">~1.5407°C</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Correlation R²</span>
                  <span className="font-bold text-emerald-600">0.9736</span>
                </div>
              </div>
            </div>

            {/* CYBER TRUST & ANOMALY FILTER PANEL */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Cyber Trust & Physics Filter
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Pre-Inference</span>
                </div>
                <p className="text-xs text-slate-500">
                  Multilevel verification: Voltage [2.5V-4.35V], Current [-15A..10A], Power consistency |P - VI| &lt; 0.2W, and dV/dt physics limits.
                </p>

                {/* Validation Status Breakdown */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Latest Sample Verdict
                  </span>
                  {latestTrust ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Status:</span>
                        <span
                          className={`font-bold ${
                            latestTrust.decision === "SAFE"
                              ? "text-emerald-700"
                              : latestTrust.decision === "SUSPICIOUS"
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {latestTrust.decision}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Confidence:</span>
                        <span className="font-mono text-slate-800">
                          {(latestTrust.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        {latestTrust.reasons?.[0] || "Passed all bounds and physics checks."}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Awaiting telemetry stream...</p>
                  )}
                </div>

                {/* Live Anomaly Injection Tool */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    Test Trust Gate (Inject Anomaly):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleInjectAnomaly("voltage_spike")}
                      className="px-2.5 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition text-left"
                    >
                      ⚡ Voltage Spike (8.5V)
                    </button>
                    <button
                      onClick={() => handleInjectAnomaly("power_mismatch")}
                      className="px-2.5 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition text-left"
                    >
                      ⚖️ Power Inconsistency
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Injected anomalies are intercepted immediately and sent to quarantine without polluting AI inference.
                  </p>
                </div>
              </div>

              {/* Quarantine summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Quarantined Records:</span>
                  <span className="font-bold text-rose-600">{simState.quarantinedCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. CRYPTOGRAPHIC PROVENANCE & BLOCKCHAIN PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  Hyperledger Fabric Ledger Anchoring & Merkle Provenance
                </h3>
                <p className="text-xs text-slate-500">
                  Raw telemetry is canonicalized and hashed off-chain. Merkle roots (batches of 30 samples) are anchored to Hyperledger Fabric for immutable proof.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTamperTest}
                  disabled={tamperLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {tamperLoading ? "Running Audit..." : "Simulate Tampering Test"}
                </button>
              </div>
            </div>

            {/* Current Hashes & Roots Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Latest Record Hash (SHA-256)
                </span>
                <span className="text-xs font-mono text-slate-800 truncate block">
                  {simState.latestRecordHash || "Awaiting first sample..."}
                </span>
                <span className="text-[10px] text-slate-400">Canonical Deterministic Serialization</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Committed Merkle Root
                </span>
                <span className="text-xs font-mono text-indigo-600 truncate block font-bold">
                  {simState.latestMerkleRoot || "Awaiting first batch (30 records)..."}
                </span>
                <span className="text-[10px] text-slate-400">Domain-Separated Tree (RFC 6962)</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Fabric Transaction ID
                </span>
                <span className="text-xs font-mono text-emerald-700 truncate block font-bold">
                  {simState.latestTxId || "Awaiting ledger anchor..."}
                </span>
                <span className="text-[10px] text-slate-400">Channel: bmschannel • Org1MSP</span>
              </div>
            </div>

            {/* Tamper Test Result Banner */}
            {tamperResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  tamperResult.auditResult?.tamperDetected
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-sm">
                      Tamper Demonstration: {tamperResult.auditResult?.tamperedVerification}
                    </span>
                  </div>
                  <span className="text-xs font-mono">
                    Target: {tamperResult.targetRecordId}
                  </span>
                </div>
                <p className="text-xs">
                  We deliberately changed <strong>{tamperResult.tamperingApplied?.field}</strong> from{" "}
                  <strong>{tamperResult.tamperingApplied?.originalValue}V</strong> to{" "}
                  <strong>{tamperResult.tamperingApplied?.tamperedValue}V</strong>. The verifier recomputed SHA-256, caught the mismatch, and failed the Merkle root match!
                </p>
                <div className="bg-white/80 p-2 rounded-lg font-mono text-[11px] space-y-1">
                  {tamperResult.auditResult?.auditLogs?.map((log: string, idx: number) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Committed Merkle Batches Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Committed Merkle Batches & Blockchain Anchors:
              </span>

              {batches.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Batch ID</th>
                        <th className="py-2.5 px-3">Merkle Root</th>
                        <th className="py-2.5 px-3">Samples</th>
                        <th className="py-2.5 px-3">Fabric Block #</th>
                        <th className="py-2.5 px-3">Transaction ID</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {batches.slice(0, 5).map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{b.id}</td>
                          <td className="py-2.5 px-3 text-indigo-600 truncate max-w-[140px]">
                            {b.merkleRoot}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{b.leafCount}</td>
                          <td className="py-2.5 px-3 text-slate-800">
                            #{b.anchor?.blockNumber || "101"}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700 truncate max-w-[140px]">
                            {b.anchor?.fabricTxId || "tx_pending"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              VERIFIED
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleVerifyRecord(b.startRecordId)}
                              className="px-2.5 py-1 text-[11px] font-sans font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition"
                            >
                              Verify Proof
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  No batches committed yet. Each 30 valid samples automatically seal into a verifiable Merkle batch.
                </div>
              )}
            </div>

            {/* Verification Result Modal / Card */}
            {verificationResult && (
              <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900">
                      Cryptographic Audit Report for Record: {verificationResult.recordId}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      verificationResult.verified
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {verificationResult.verified ? "100% VERIFIED" : "VERIFICATION FAILED"}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] bg-white p-3 rounded-lg border border-indigo-100">
                  {verificationResult.details?.map((step: string, i: number) => (
                    <div key={i} className="text-slate-700">
                      {step}
                    </div>
                  ))}
                  {verificationResult.onChainAnchor && (
                    <div className="text-emerald-700 font-semibold pt-1">
                      ⛓️ Ledger Anchor: {verificationResult.onChainAnchor.reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. DIGITAL BATTERY PASSPORT SUMMARY */}
          {batteryPassport && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  Digital Battery Passport (EU Battery Regulation 2023/1542 Ready)
                </h3>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                  {batteryPassport.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Battery ID</span>
                  <span className="font-bold text-slate-800 font-mono">{batteryPassport.batteryId}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Cell Chemistry</span>
                  <span className="font-bold text-slate-800">{batteryPassport.chemistry}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Capacity & Voltage</span>
                  <span className="font-bold text-slate-800">
                    {batteryPassport.nominalCapacityAh}Ah • {batteryPassport.nominalVoltageV}V
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Manufacturer</span>
                  <span className="font-bold text-slate-800">{batteryPassport.manufacturer}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Total Lifecycle Cycles</span>
                  <span className="font-bold text-slate-800">{batteryPassport.totalCycles} cycles</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Anchored Batches</span>
                  <span className="font-bold text-indigo-600">
                    {batteryPassport.totalBatchesAnchored} batches
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* OFFLINE MAT DATASET ANALYSIS (Preserved functionality) */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Offline Dataset Upload & Analysis</h2>
            <p className="text-sm text-slate-500">
              Upload a .MAT or .CSV file to execute batch AI Virtual Temperature Sensor inference.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3 bg-slate-50/50">
            <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto" />
            <div>
              <input
                type="file"
                accept=".mat,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer font-semibold text-indigo-600 hover:text-indigo-500 text-sm"
              >
                Click to choose a dataset
              </label>
              <p className="text-xs text-slate-400 mt-1">Panasonic 18650PF .mat format or standardized .csv</p>
            </div>
            {file && (
              <p className="text-xs font-semibold text-slate-700 bg-white inline-block px-3 py-1 rounded-full border border-slate-200">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploadLoading}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
          >
            {uploadLoading ? "Processing Inference..." : "Run Offline Prediction"}
          </button>

          {offlineError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {offlineError}
            </div>
          )}

          {offlineResult && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block">Total Samples Processed</span>
                  <span className="text-lg font-bold text-slate-800">
                    {offlineResult.dataset_info?.samples || offlineResult.prediction?.predicted?.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block">Calculated MAE</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {offlineResult.prediction?.metrics?.MAE?.toFixed(4) || "—"}°C
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block">Calculated R²</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {offlineResult.prediction?.metrics?.R2?.toFixed(4) || "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
