"use client";

import { useEffect, useRef, useState } from "react";

export function FaceCaptureField() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Este navegador não suporta acesso à câmera.");
      return;
    }

    if (!window.isSecureContext && location.hostname !== "localhost") {
      setError("A câmera só funciona em HTTPS ou localhost. Abra o site em https://www.qerbie.com.");
      return;
    }

    const constraintsList = [
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];

    for (const constraints of constraintsList) {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        streamRef.current = stream;
        setCameraOpen(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
        }
        return;
      } catch {
        // tenta outro modo de câmera do celular
      }
    }

    setError("Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.");
  }

  function updateFileFromDataUrl(dataUrl: string, filename: string) {
    const [header, payload] = dataUrl.split(",");
    if (!payload) return;

    const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const file = new File([bytes], filename, { type: mime });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) {
      setError("Câmera ainda não está pronta.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Não foi possível capturar a imagem.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const fileName = `face-${Date.now()}.png`;

    updateFileFromDataUrl(dataUrl, fileName);
    setPreview(dataUrl);
    stopCamera();
  }

  function handleSelectedFile(file: File | null | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        setError("Não foi possível ler a imagem selecionada.");
        return;
      }
      setPreview(dataUrl);
      updateFileFromDataUrl(dataUrl, file.name || `face-${Date.now()}.png`);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rosto</p>

      <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
        {preview ? (
          <img src={preview} alt="Preview da foto do rosto" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-zinc-100 text-center text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {cameraOpen ? "Preview da câmera" : "Sem foto capturada"}
          </div>
        )}
      </div>

      {cameraOpen ? (
        <video ref={videoRef} autoPlay playsInline muted className="mt-2 h-40 w-full rounded-xl object-cover" />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => handleSelectedFile(event.target.files?.[0])}
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={cameraOpen ? stopCamera : openCamera}
          className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {cameraOpen ? "Fechar câmera" : "Abrir câmera"}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Enviar foto
        </button>
      </div>

      <button
        type="button"
        onClick={capturePhoto}
        disabled={!cameraOpen}
        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        Capturar foto
      </button>

      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
