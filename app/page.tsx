"use client";

import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import Tesseract from "tesseract.js";
import { Camera, RefreshCw, ScanEye, AlertTriangle } from "lucide-react";

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [overlays, setOverlays] = useState<any[]>([]);
  const [status, setStatus] = useState("Ready to Scan");
  const [badIngredientsFound, setBadIngredientsFound] = useState<string[]>([]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      processImage(imageSrc);
    }
  }, [webcamRef]);

  const processImage = async (image: string) => {
    setScanning(true);
    setOverlays([]);
    setBadIngredientsFound([]);
    setStatus("Reading Text...");

    try {
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

      // 2. Extract Words (V6 Safe)
      const textData = data as any;
      let allWords = textData.words || [];
      if (allWords.length === 0 && textData.blocks) {
        allWords = textData.blocks.flatMap((block: any) =>
          block.paragraphs.flatMap((para: any) =>
            para.lines.flatMap((line: any) => line.words)
          )
        );
      }

      const fullText = textData.text;

      // 3. API Call
      setStatus("Analyzing...");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      const result = await response.json();
      const { bad_ingredients } = result;

      // 4. Update State for "Red Alert" UI
      if (bad_ingredients && bad_ingredients.length > 0) {
        setBadIngredientsFound(bad_ingredients);
      }

      // 5. Draw Boxes (Best Effort)
      const newOverlays: any[] = [];
      if (bad_ingredients?.length > 0) {
        allWords.forEach((word: any) => {
          const w = word.text.toLowerCase().replace(/[^a-z]/g, "");
          const isMatch = bad_ingredients.some((bad: string) => {
            const b = bad.toLowerCase().replace(/[^a-z]/g, "");
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
      setOverlays(newOverlays);
      setStatus(
        bad_ingredients?.length > 0 ? "⚠️ WARNING DETECTED" : "Clean Label"
      );
    } catch (err: any) {
      console.error(err);
      setStatus("Error. Try Again.");
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setImgSrc(null);
    setOverlays([]);
    setBadIngredientsFound([]);
    setStatus("Ready to Scan");
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${
        badIngredientsFound.length > 0 ? "bg-red-950" : "bg-black"
      } text-white`}
    >
      <div className="flex items-center gap-2 mb-6">
        <ScanEye
          className={`w-8 h-8 ${
            badIngredientsFound.length > 0 ? "text-red-500" : "text-cyan-400"
          }`}
        />
        <h1 className="text-2xl font-bold tracking-widest">TRUTH LENS</h1>
      </div>

      {/* CAMERA CONTAINER */}
      <div
        className={`relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-xl overflow-hidden shadow-2xl transition-all duration-500 ${
          badIngredientsFound.length > 0
            ? "border-4 border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.5)]"
            : "border border-gray-800"
        }`}
      >
        {!imgSrc && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="w-full h-full object-cover"
          />
        )}

        {imgSrc && (
          <img
            src={imgSrc}
            alt="Captured"
            className="w-full h-full object-cover opacity-60"
          />
        )}

        {/* RED BOXES (Visuals) */}
        {imgSrc &&
          overlays.map((box, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                // Simplified "Safe" Math
                left: `${
                  (box.bbox.x0 / (imgSrc.includes("width") ? 1 : 350)) * 100
                }%`,
                top: `${
                  (box.bbox.y0 / (imgSrc.includes("height") ? 1 : 350)) * 100
                }%`,
                minWidth: "15%",
                minHeight: "5%",
                backgroundColor: "rgba(255, 0, 0, 0.3)",
                border: "2px solid red",
                boxShadow: "0 0 15px red",
                zIndex: 20,
              }}
            />
          ))}

        {/* SCANNING OVERLAY */}
        {scanning && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50">
            <ScanEye className="w-16 h-16 text-cyan-400 animate-pulse mb-4" />
            <p className="font-mono text-cyan-400 tracking-widest">{status}</p>
          </div>
        )}
      </div>

      {/* RESULT CARD (The "Viral" Payoff) */}
      {badIngredientsFound.length > 0 && (
        <div className="w-full max-w-md mt-6 bg-red-900/90 border-l-4 border-red-500 p-4 rounded-r-lg shadow-xl animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <h3 className="text-red-100 font-bold uppercase tracking-wider mb-1">
                Hidden Ingredients Found
              </h3>
              <div className="flex flex-wrap gap-2">
                {badIngredientsFound.map((item, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-red-950 border border-red-500/50 text-red-200 text-xs font-mono rounded"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS */}
      <div className="mt-8 flex gap-6">
        {!imgSrc ? (
          <button
            onClick={capture}
            className="w-20 h-20 bg-white rounded-full border-[6px] border-gray-300 flex items-center justify-center active:scale-90 transition-transform shadow-lg"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>
        ) : (
          <button
            onClick={reset}
            className="px-8 py-4 bg-gray-800 rounded-full flex items-center gap-2 hover:bg-gray-700 transition-colors font-bold tracking-wide"
          >
            <RefreshCw className="w-5 h-5" /> SCAN AGAIN
          </button>
        )}
      </div>

      <p className="mt-8 text-[10px] text-gray-600 font-mono">
        MVP v1.0 • Built with Next.js + GPT-4o
      </p>
    </div>
  );
}
