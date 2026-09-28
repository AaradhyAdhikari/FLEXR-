"use client";

import { useEffect, useRef, useState } from "react";
import { isBarcode } from "@/lib/off";

type Stopper = () => void;

type BarcodeDetectorLike = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/**
 * Camera barcode scanner. Uses the browser's BarcodeDetector when it can read
 * product barcodes (Android Chrome), otherwise the ZXing library (iPhone Safari, desktop).
 * Always offers a box to type the digits instead.
 */
export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<Stopper | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [message, setMessage] = useState("");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const found = (raw: string) => {
      const code = raw.replace(/\D/g, "");
      if (doneRef.current || !isBarcode(code)) return;
      doneRef.current = true;
      try {
        navigator.vibrate?.(80);
      } catch {
        /* not supported */
      }
      stopRef.current?.();
      onDetected(code);
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("This browser can't use the camera here. Type the barcode below instead.");
        return;
      }
      const constraints: MediaStreamConstraints = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
      try {
        const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        const nativeOk = Native && (await Native.getSupportedFormats?.())?.some((f) => FORMATS.includes(f));
        if (Native && nativeOk) {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();
          const detector = new Native({ formats: FORMATS });
          let timer: ReturnType<typeof setInterval> | null = setInterval(async () => {
            if (video.readyState < 2) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]) found(codes[0].rawValue);
            } catch {
              /* keep trying */
            }
          }, 200);
          stopRef.current = () => {
            if (timer) clearInterval(timer);
            timer = null;
            stream.getTracks().forEach((t) => t.stop());
          };
          if (cancelled || doneRef.current) return stopRef.current();
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
          // Light settings: decoding every frame at full effort can freeze slower phones.
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1000 });
          const controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
            if (result) found(result.getText());
          });
          stopRef.current = () => controls.stop();
          // The barcode may be found before the camera call returns; stop right away in that case.
          if (cancelled || doneRef.current) return controls.stop();
        }
        if (!cancelled) setStatus("scanning");
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        setStatus("error");
        setMessage(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the barcode below."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found. Type the barcode below instead."
              : "Couldn't start the camera. Type the barcode below instead."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopRef.current?.();
    };
  }, [onDetected]);

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const code = typed.replace(/\D/g, "");
    if (!isBarcode(code)) return setTypedError("Barcodes have 8, 12 or 13 digits. Check the numbers under the bars.");
    setTypedError("");
    doneRef.current = true;
    stopRef.current?.();
    onDetected(code);
  }

  return (
    <div className="rounded-[10px] border p-3 flex flex-col gap-2.5" style={{ borderColor: "var(--accent)" }}>
      <div className="flex items-center justify-between gap-2">
        <b className="text-sm">Scan a barcode</b>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { stopRef.current?.(); onClose(); }}>Close</button>
      </div>
      {status !== "error" && (
        <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "4 / 3" }}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline aria-label="Camera preview" />
          <div className="absolute left-[10%] right-[10%] top-[38%] bottom-[38%] border-2 rounded-md pointer-events-none" style={{ borderColor: "rgba(255,255,255,.85)", boxShadow: "0 0 0 999px rgba(0,0,0,.25)" }} />
          <div className="absolute bottom-2 left-0 right-0 text-center text-xs font-semibold" style={{ color: "#fff", textShadow: "0 1px 2px #000" }}>
            {status === "starting" ? "Starting camera…" : "Hold the barcode inside the box"}
          </div>
        </div>
      )}
      {status === "error" && <p className="text-sm m-0 rounded-lg px-3 py-2" style={{ background: "var(--warn-bg)", color: "var(--warn)" }} role="alert">{message}</p>}
      <form className="flex gap-2" onSubmit={submitTyped}>
        <input className="input num" inputMode="numeric" autoComplete="off" placeholder="Or type the barcode digits" maxLength={16} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Barcode number" />
        <button className="btn" type="submit">Look up</button>
      </form>
      {typedError && <p className="text-xs m-0" style={{ color: "var(--bad)" }}>{typedError}</p>}
    </div>
  );
}
