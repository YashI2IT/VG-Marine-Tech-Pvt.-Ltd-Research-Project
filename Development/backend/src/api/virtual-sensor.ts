import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const router = express.Router();

let latestResult: any = null;

function getModelDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../../../models"),
    path.resolve(__dirname, "../../../models"),
    path.resolve(process.cwd(), "models"),
    path.resolve(process.cwd(), "../models"),
    path.resolve(process.cwd(), "../../models")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(__dirname, "../../../../models");
}


const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post("/predict", upload.single("dataset"), (req, res) => {
  let filePath = "";
  let usingFallback = false;

  if (req.file) {
    filePath = req.file.path;
  } else {
    // Temporary fallback for demo: use a default MAT file
    filePath = path.join(getModelDir(), "wykht8y7tg-1/Panasonic 18650PF Data/10degC/Drive Cycles/03-27-17_09.06 10degC_UDDS_Pan18650PF.mat");
    usingFallback = true;
  }

  const scriptPath = path.join(getModelDir(), "virtual_sensor/predict_api.py");

  // Call the python script
  const pythonProcess = spawn("python", [scriptPath, "--file", filePath]);

  let stdoutData = "";
  let stderrData = "";

  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on("close", (code) => {
    // Attempt to delete the file after processing if it was an uploaded file
    try {
      if (!usingFallback && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error("Error deleting file:", e);
    }

    if (code !== 0) {
      console.error("Python script exited with code", code);
      console.error("stderr:", stderrData);
      return res.status(500).json({ error: "Prediction process failed.", details: stderrData });
    }

    try {
      // Find the JSON block in stdout (in case python prints something else before)
      // Usually it's just the JSON object
      const jsonStr = stdoutData.trim().split('\n').pop();
      if (!jsonStr) throw new Error("Empty response from script");
      
      const result = JSON.parse(jsonStr);
      
      if (result.error) {
        return res.status(400).json(result);
      }
      
      latestResult = result;
      res.json(result);
    } catch (parseError) {
      console.error("Error parsing python output:", parseError);
      console.error("Raw output:", stdoutData);
      res.status(500).json({ error: "Failed to parse prediction results.", raw: stdoutData });
    }
  });
});

export default router;


router.get('/latest', (req, res) => {
  if (latestResult) {
    return res.json(latestResult);
  }
  // Auto-generate fallback dataset result if empty
  const filePath = path.join(getModelDir(), "wykht8y7tg-1/Panasonic 18650PF Data/10degC/Drive Cycles/03-27-17_09.06 10degC_UDDS_Pan18650PF.mat");
  const scriptPath = path.join(getModelDir(), "virtual_sensor/predict_api.py");
  const pythonProcess = spawn("python", [scriptPath, "--file", filePath]);
  let stdoutData = "";
  let stderrData = "";
  pythonProcess.stdout.on("data", (data) => { stdoutData += data.toString(); });
  pythonProcess.stderr.on("data", (data) => { stderrData += data.toString(); });
  pythonProcess.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "Failed to generate default dataset" });
    try {
      const jsonStr = stdoutData.trim().split('\n').pop();
      if (!jsonStr) throw new Error("Empty");
      const result = JSON.parse(jsonStr);
      if (!result.error) latestResult = result;
      res.json(result);
    } catch (e) { res.status(500).json({ error: "Parse failed" }); }
  });
});



