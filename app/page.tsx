// app/page.tsx
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

  // 1. Capture Image
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      processImage(imageSrc);
    }
  }, [webcamRef]);

  // 2. The Core Logic (OCR + AI)
  const processImage = async (image: string) => {
    setScanning(true);
    setOverlays([]); // Clear previous
    setStatus("Reading Text (OCR)...");

    try {
      // Step A: Tesseract finds text AND coordinates
      const { data } = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setStatus(`Scanning... ${Math.floor(m.progress * 100)}%`);
          }
        },
      });

      setStatus("Analyzing Ingredients...");

      // FIX FOR TESSERACT V6: Manually extract words if data.words is missing
      // We cast 'data' to 'any' to bypass the TypeScript build error
      const textData = data as any;
      let allWords = textData.words || [];

      // If V6 structure (blocks -> paragraphs -> lines -> words)
      if (allWords.length === 0 && textData.blocks) {
        allWords = textData.blocks.flatMap((block: any) =>
          block.paragraphs.flatMap((para: any) =>
            para.lines.flatMap((line: any) => line.words)
          )
        );
      }

      // Step B: Send text to OpenAI to find "Bad Words"
      const fullText = textData.text;
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      const { bad_ingredients } = await response.json();

      // Step C: Match "Bad Words" to Coordinates (Visual Overlay)
      const newOverlays: any[] = [];

      // We loop through every word found
      allWords.forEach((word: any) => {
        // Check if this word is part of a "bad ingredient" identified by GPT
        const isBad = bad_ingredients?.some(
          (bad: string) =>
            bad.toLowerCase().includes(word.text.toLowerCase()) ||
            word.text.toLowerCase().includes(bad.toLowerCase())
        );

        if (isBad && word.confidence > 60) {
          newOverlays.push({
            text: word.text,
            bbox: word.bbox, // {x0, y0, x1, y1}
            color: "rgba(255, 0, 0, 0.5)", // Red Overlay
          });
        }
      });

      setOverlays(newOverlays);
      setStatus(
        newOverlays.length > 0
          ? `Found ${newOverlays.length} hidden items!`
          : "Clean Label!"
      );
    } catch (err) {
      console.error(err);
      setStatus("Error processing image.");
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
      <h1 className="text-2xl font-bold mb-4 text-red-500 tracking-wider">
        TRUTH LENS
      </h1>

      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
        {/* Camera View */}
        {!imgSrc && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="w-full h-full object-cover"
          />
        )}

        {/* Captured Image View */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt="Captured"
            className="w-full h-full object-cover opacity-80"
          />
        )}

        {/* THE VISUAL OVERLAYS (Red Boxes) */}
        {imgSrc &&
          overlays.map((box, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                // Simple scaling for MVP (Assuming standard aspect ratio)
                left: `${(box.bbox.x0 / 640) * 100}%`,
                top: `${(box.bbox.y0 / 480) * 100}%`,
                width: `${((box.bbox.x1 - box.bbox.x0) / 640) * 100}%`,
                height: `${((box.bbox.y1 - box.bbox.y0) / 480) * 100}%`,
                backgroundColor: "rgba(220, 38, 38, 0.4)",
                border: "2px solid red",
                boxShadow: "0 0 10px red",
              }}
            />
          ))}

        {/* Scanning Animation */}
        {scanning && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-center">
              <ScanEye className="w-12 h-12 text-red-500 animate-pulse mx-auto mb-2" />
              <p className="font-mono text-green-400">{status}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-8 flex gap-6">
        {!imgSrc ? (
          <button
            onClick={capture}
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 active:scale-95 transition-transform flex items-center justify-center"
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

      <p className="mt-4 text-xs text-gray-500 font-mono text-center max-w-xs">
        {status === "Ready to Scan"
          ? "Point at ingredients list and tap Capture"
          : status}
      </p>
    </div>
  );
}
