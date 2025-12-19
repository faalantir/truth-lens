"use client";

import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import Tesseract from "tesseract.js";
import { Camera, RefreshCw, ScanEye } from "lucide-react";

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [overlays, setOverlays] = useState<any[]>([]);
  const [status, setStatus] = useState("Ready to Scan");

  // THE ON-SCREEN LOGGER STATE
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString().split(" ")[0]}: ${msg}`,
    ]);
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      setLogs(["Image Captured."]); // Reset logs on new capture
      processImage(imageSrc);
    } else {
      addLog("Error: Camera capture failed.");
    }
  }, [webcamRef]);

  const processImage = async (image: string) => {
    setScanning(true);
    setOverlays([]);
    setStatus("Reading Text...");

    try {
      addLog("Starting Tesseract...");

      // 1. Tesseract
      const { data } = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          if (
            m.status === "recognizing text" &&
            (m.progress * 100) % 20 === 0
          ) {
            setStatus(`Scanning... ${Math.floor(m.progress * 100)}%`);
          }
        },
      });

      // 2. Extract Words
      const textData = data as any;
      let allWords = textData.words || [];
      if (allWords.length === 0 && textData.blocks) {
        allWords = textData.blocks.flatMap((block: any) =>
          block.paragraphs.flatMap((para: any) =>
            para.lines.flatMap((line: any) => line.words)
          )
        );
      }

      const fullText = textData.text.replace(/\n/g, " ");
      addLog(`OCR Read: "${fullText.substring(0, 30)}..."`); // Show us what it read!

      if (fullText.length < 5) {
        addLog("Error: Text too short/empty.");
        setScanning(false);
        return;
      }

      // 3. API Call
      setStatus("Analyzing...");
      addLog("Sending to OpenAI...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      if (!response.ok) throw new Error(`API Error ${response.status}`);

      const result = await response.json();
      const { bad_ingredients } = result;

      addLog(`AI Found: [${bad_ingredients?.join(", ")}]`);

      // 4. Matching Logic (The "Nuclear" Loose Match)
      const newOverlays: any[] = [];

      if (bad_ingredients && bad_ingredients.length > 0) {
        allWords.forEach((word: any) => {
          const w = word.text.toLowerCase().replace(/[^a-z]/g, ""); // strip punctuation

          const isMatch = bad_ingredients.some((bad: string) => {
            const b = bad.toLowerCase().replace(/[^a-z]/g, "");
            // Match if word is inside bad ingredient OR bad ingredient is inside word
            // e.g. "syrup" matches "corn syrup"
            return w.length > 2 && (b.includes(w) || w.includes(b));
          });

          if (isMatch) {
            newOverlays.push({
              text: word.text,
              bbox: word.bbox,
            });
          }
        });
      }

      addLog(`Matches/Boxes: ${newOverlays.length}`);
      setOverlays(newOverlays);
      setStatus(newOverlays.length > 0 ? "⚠️ Found Items!" : "Clean Label");
    } catch (err: any) {
      addLog(`CRASH: ${err.message}`);
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setImgSrc(null);
    setOverlays([]);
    setStatus("Ready to Scan");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-2 text-yellow-400 tracking-wider">
        TRUTH LENS v2.0
      </h1>
      {/* FORCE VISIBLE DEBUGGER AT TOP */}
      <div className="w-full bg-yellow-900/80 border border-yellow-400 p-2 mb-4 text-[10px] font-mono text-yellow-200 h-24 overflow-y-auto">
        <strong>LIVE LOGS (v2):</strong>
        {logs.length === 0 ? (
          <div>Waiting for scan...</div>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>

      {/* CAMERA VIEW */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
        {!imgSrc && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }} // Safe Mode Camera
            className="w-full h-full object-cover"
          />
        )}
        {imgSrc && (
          <img
            src={imgSrc}
            alt="Captured"
            className="w-full h-full object-cover opacity-80"
          />
        )}

        {/* RED BOXES */}
        {imgSrc &&
          overlays.map((box, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                // Use simplified relative math for safety
                left: `${
                  (box.bbox.x0 / (imgSrc.includes("width") ? 1 : 400)) * 100
                }%`,
                top: `${
                  (box.bbox.y0 / (imgSrc.includes("height") ? 1 : 400)) * 100
                }%`,
                // Just try to center it roughly if math fails:
                border: "2px solid red",
                width: "15%",
                height: "5%", // Force a visible box size if coordinates fail
                backgroundColor: "rgba(255, 0, 0, 0.4)",
                zIndex: 20,
              }}
            />
          ))}

        {scanning && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <ScanEye className="w-12 h-12 text-red-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* WARNING LIST (Always Visible Backup) */}
      {overlays.length > 0 && (
        <div className="w-full max-w-md mt-2 bg-red-900/40 border border-red-500 p-3 rounded animate-bounce">
          <p className="text-red-300 text-xs font-bold uppercase">
            ⚠️ Warning Detected:
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {overlays.map((o, i) => (
              <span
                key={i}
                className="bg-red-600 text-white text-xs px-2 py-1 rounded"
              >
                {o.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CONTROLS */}
      <div className="mt-6 flex gap-6">
        {!imgSrc ? (
          <button
            onClick={capture}
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>
        ) : (
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 rounded-full flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Retake
          </button>
        )}
      </div>

      {/* === THE DEBUG DASHBOARD (Black Box) === */}
      <div className="w-full max-w-md mt-6 p-2 bg-gray-900 border border-gray-700 text-[10px] font-mono text-green-400 h-32 overflow-y-auto">
        <p className="border-b border-gray-700 mb-1 text-gray-500">
          SYSTEM LOGS:
        </p>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        {logs.length === 0 && (
          <span className="text-gray-600">Waiting for logs...</span>
        )}
      </div>
    </div>
  );
}
