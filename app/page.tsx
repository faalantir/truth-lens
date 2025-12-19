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
  const [debugInfo, setDebugInfo] = useState(""); // Silent debug for you

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
    setStatus("Reading Text (OCR)...");
    setDebugInfo("");

    try {
      // 1. Tesseract (Standard Config)
      const { data } = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setStatus(`Scanning... ${Math.floor(m.progress * 100)}%`);
          }
        },
      });

      // 2. Fix for Tesseract v6 Structure
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
      setDebugInfo(`OCR Read: ${fullText.substring(0, 30)}...`); // Show first 30 chars

      // 3. Send to API
      setStatus("Analyzing Ingredients...");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      if (!response.ok) throw new Error("API Failed");

      const result = await response.json();
      const { bad_ingredients } = result;
      setDebugInfo(
        (prev) => `${prev} | AI Found: ${bad_ingredients?.length || 0}`
      );

      // 4. Match Words (Fuzzy Logic)
      const newOverlays: any[] = [];
      allWords.forEach((word: any) => {
        const isBad = bad_ingredients?.some((bad: string) => {
          const cleanBad = bad.toLowerCase().replace(/[^a-z0-9]/g, "");
          const cleanWord = word.text.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            cleanWord.length > 2 &&
            (cleanBad.includes(cleanWord) || cleanWord.includes(cleanBad))
          );
        });

        if (isBad && word.confidence > 60) {
          newOverlays.push({
            text: word.text,
            bbox: word.bbox,
            color: "rgba(255, 0, 0, 0.5)",
          });
        }
      });

      setOverlays(newOverlays);
      setStatus(
        newOverlays.length > 0
          ? `Found ${newOverlays.length} items!`
          : "Clean Label!"
      );
    } catch (err: any) {
      console.error(err);
      setStatus("Error. Check Debug.");
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setImgSrc(null);
    setOverlays([]);
    setStatus("Ready to Scan");
    setDebugInfo("");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4 text-red-500 tracking-wider">
        TRUTH LENS
      </h1>

      {/* CAMERA CONTAINER */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
        {!imgSrc && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            // FORCE HD RESOLUTION (The "Viral" Setting)
            videoConstraints={{
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }}
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

        {/* RED BOX OVERLAYS */}
        {imgSrc &&
          overlays.map((box, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                // HD Scaling Math (Assuming 1920x1080 source)
                left: `${(box.bbox.x0 / 1920) * 100}%`,
                top: `${(box.bbox.y0 / 1080) * 100}%`,
                width: `${((box.bbox.x1 - box.bbox.x0) / 1920) * 100}%`,
                height: `${((box.bbox.y1 - box.bbox.y0) / 1080) * 100}%`,
                backgroundColor: "rgba(220, 38, 38, 0.4)",
                border: "2px solid red",
                boxShadow: "0 0 10px red",
                zIndex: 10,
              }}
            />
          ))}

        {scanning && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-center">
              <ScanEye className="w-12 h-12 text-red-500 animate-pulse mx-auto mb-2" />
              <p className="font-mono text-green-400">{status}</p>
            </div>
          </div>
        )}
      </div>

      {/* WARNING LIST (The "Safety Net" for the Demo) */}
      {overlays.length > 0 && (
        <div className="w-full max-w-md mt-4 bg-red-900/20 border border-red-500 rounded-lg p-4 animate-bounce">
          <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2 uppercase tracking-widest text-sm">
            ⚠️ Warning Detected
          </h3>
          <div className="flex flex-wrap gap-2">
            {overlays.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full shadow-lg"
              >
                {item.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CONTROLS */}
      <div className="mt-8 flex gap-6">
        {!imgSrc ? (
          <button
            onClick={capture}
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>
        ) : (
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 rounded-full flex items-center gap-2 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" /> Retake
          </button>
        )}
      </div>

      {/* SILENT DEBUG INFO (Visible to you, doesn't ruin video) */}
      <div className="mt-4 text-[10px] text-gray-600 font-mono text-center max-w-xs break-all">
        {debugInfo}
      </div>
    </div>
  );
}
