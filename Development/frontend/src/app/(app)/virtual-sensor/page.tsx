"use client";

import { useState, useEffect } from "react";
import { getSession } from "@/services/auth";
import { api } from "@/lib/api";
import { 
  UploadCloud, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BarChart2, 
  Thermometer, 
  Database,
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

type PredictResult = {
  status: "success" | "error";
  error?: string;
  dataset_info?: {
    samples: number;
    detected_features: number;
    required_features: number;
    missing: string[];
    extra: string[];
    mapped: { original: string; mapped: string }[];
    validation: "READY" | "INVALID";
  };
  prediction?: {
    predicted: number[];
    actual: number[];
    times: number[];
    metrics?: {
      MAE: number;
      RMSE: number;
      R2: number;
    };
    has_ground_truth: boolean;
  };
};

export default function VirtualSensorPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => { getSession().then(u => setUserRole(u.role)).catch(() => {}); }, []);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    if (userRole === "user") {
      setLoading(true);
      api.get("/virtual-sensor/latest")
        .then(res => setResult(res.data))
        .catch(err => setErrorMsg("No published results yet. Waiting for admin to process a dataset."))
        .finally(() => setLoading(false));
    }
  }, [userRole]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    if (file) {
      formData.append("dataset", file);
    }

    try {
      const response = await api.post("/virtual-sensor/predict", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(response.data);
    } catch (err) {
      console.error(err);
      const error = err as { response?: { data?: any } };
      setErrorMsg(error.response?.data?.error || "Failed to process dataset");
      if (error.response?.data) {
        setResult(error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = [];
  if (result?.prediction) {
    const p = result.prediction;
    for (let i = 0; i < p.predicted.length; i++) {
      chartData.push({
        time: p.times[i],
        predicted: p.predicted[i],
        actual: p.has_ground_truth ? p.actual[i] : null,
        error: p.has_ground_truth ? p.predicted[i] - p.actual[i] : null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Virtual Temperature Sensor</h1>
          <p className="text-slate-500 mt-1">Upload telemetry data to predict internal battery temperatures.</p>
        </div>
      </div>

      {userRole !== "user" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        {userRole === "admin" ? (
          <div className="panel p-6 lg:col-span-1 border border-slate-200 rounded-xl bg-white shadow-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UploadCloud className="h-5 w-5 text-blue-500" />
            Upload Dataset
          </h2>
          
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              id="dataset-upload"
              className="hidden"
              accept=".csv,.mat"
              onChange={handleFileChange}
            />
            <label htmlFor="dataset-upload" className="cursor-pointer flex flex-col items-center">
              <Database className="h-10 w-10 text-slate-400 mb-3" />
              <span className="text-sm font-medium text-blue-600">Choose a file (.csv or .mat)</span>
              <span className="text-xs text-slate-500 mt-1">
                {file ? file.name : "Run without file to use default demo dataset"}
              </span>
            </label>
          </div>

          <button
            className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
              loading 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? "Processing..." : "Run Prediction"}
          </button>

          {errorMsg && !result?.dataset_info && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>
        ) : (
          <div className="panel p-6 lg:col-span-1 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center text-center">
            <Database className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">Read Only Mode</h3>
            <p className="text-xs text-slate-500 mt-1">Dataset upload is restricted to Administrators.</p>
          </div>
        )}

        {/* Validation Info Section */}
        <div className="panel p-6 lg:col-span-2 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-center">
          {!result?.dataset_info && !loading && (
            <div className="text-center text-slate-400">
              <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Upload a dataset to see validation and prediction results.</p>
            </div>
          )}

          {loading && (
            <div className="text-center text-slate-500">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Validating dataset and running inference...</p>
            </div>
          )}

          {result?.dataset_info && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-semibold text-lg">Dataset Validation</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  result.dataset_info.validation === "READY" 
                    ? "bg-emerald-100 text-emerald-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  Status: {result.dataset_info.validation}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Samples</p>
                  <p className="text-lg font-bold text-slate-800">{result.dataset_info.samples.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Detected</p>
                  <p className="text-lg font-bold text-slate-800">{result.dataset_info.detected_features}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Required</p>
                  <p className="text-lg font-bold text-slate-800">{result.dataset_info.required_features}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Mapped</p>
                  <p className="text-lg font-bold text-slate-800">{result.dataset_info.mapped.length}</p>
                </div>
              </div>

              {result.dataset_info.missing.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4" /> Missing Required Features
                  </p>
                  <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                    {result.dataset_info.missing.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              {result.dataset_info.mapped.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4" /> Feature Mapping (Subset)
                  </p>
                  <div className="text-xs text-blue-700 flex flex-wrap gap-2">
                    {result.dataset_info.mapped.slice(0, 5).map((m, i) => (
                      <span key={i} className="bg-blue-100 px-2 py-1 rounded">
                        {m.original} → {m.mapped}
                      </span>
                    ))}
                    {result.dataset_info.mapped.length > 5 && <span className="py-1">...</span>}
                  </div>
                </div>
              )}

              {result.dataset_info.extra.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4" /> Ignored Extra Features
                  </p>
                  <p className="text-xs text-slate-600">{result.dataset_info.extra.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      )}

      {/* Results Section */}
      {errorMsg && userRole === "user" && (
        <div className="panel p-6 border border-slate-200 rounded-xl bg-slate-50 shadow-sm flex flex-col items-center justify-center text-center h-64">
          <Database className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">No Published Results</h3>
          <p className="text-slate-500 mt-1">Waiting for the Administrator to process and publish a dataset.</p>
        </div>
      )}

      {result?.prediction && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="panel p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Thermometer className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-700">Prediction</h3>
              </div>
              <p className="text-sm text-slate-500 mb-1">Status</p>
              <p className="text-xl font-bold text-emerald-600">SUCCESS</p>
              <p className="text-xs text-slate-400 mt-2">
                {result.prediction.predicted.length} windows inferred
              </p>
            </div>

            {result.prediction.metrics ? (
              <>
                <div className="panel p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Activity className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-700">MAE</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-1">Mean Absolute Error</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {result.prediction.metrics.MAE.toFixed(3)} °C
                  </p>
                </div>
                <div className="panel p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                      <BarChart2 className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-700">RMSE</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-1">Root Mean Square Error</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {result.prediction.metrics.RMSE.toFixed(3)} °C
                  </p>
                </div>
                <div className="panel p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                      <BarChart2 className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-700">R² Score</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-1">Coefficient of Determination</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {result.prediction.metrics.R2.toFixed(4)}
                  </p>
                </div>
              </>
            ) : (
              <div className="panel p-5 border border-slate-200 rounded-xl bg-slate-50 shadow-sm md:col-span-3 flex items-center justify-center">
                <p className="text-slate-500 text-center">
                  Ground-truth temperature unavailable; evaluation metrics are not calculated.
                </p>
              </div>
            )}
          </div>

          <div className="panel p-6 border border-slate-200 rounded-xl bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-6">Temperature Prediction Graph</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(val) => `${(val / 60).toFixed(1)}m`} 
                    stroke="#94a3b8" 
                    fontSize={12}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `${val.toFixed(1)}°`}
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value.toFixed(2)} °C`]}
                    labelFormatter={(label) => `Time: ${(label as number).toFixed(1)} s`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {result.prediction.has_ground_truth && (
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      name="Actual Temp" 
                      stroke="#94a3b8" 
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    name="Predicted Temp" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








