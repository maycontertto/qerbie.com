"use client";

import { useEffect, useRef, useState } from "react";
import { verifyGymFaceAccess } from "@/lib/gym/actions";

export function FaceAccessScanner({ students }: { students: Array<{ id: string; name: string; login: string }> }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id ?? "");
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

  const closeCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Este navegador não suporta câmera.");
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
        // tenta o próximo fallback de câmera do dispositivo
      }
    }

    setError("Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.");
  };

  const handleSelectedFile = (file: File | null | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        setError("Não foi possível ler a imagem selecionada.");
        return;
      }
      setPreview(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
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
    const [header, payload] = dataUrl.split(",");
    if (!payload) {
      setError("Imagem inválida.");
      return;
    }

    const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const file = new File([bytes], `face-${Date.now()}.png`, { type: mime });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }

    setPreview(dataUrl);
    closeCamera();
  };

  return (
    <form action={verifyGymFaceAccess} encType="multipart/form-data" className="mt-4 space-y-3">
      <input type="hidden" name="return_to" value="/dashboard/modulos/academia_presenca" />
      <select
        name="student_id"
        value={selectedStudent}
        onChange={(e) => setSelectedStudent(e.target.value)}
        required
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Selecione o aluno</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name} • {student.login}
          </option>
        ))}
      </select>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
        {preview ? (
          <img src={preview} alt="Preview da face" className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 items-center justify-center text-center text-xs text-zinc-500 dark:text-zinc-400">
            {cameraOpen ? "Preview da câmera" : "Foto do rosto do aluno"}
          </div>
        )}
      </div>

      {cameraOpen ? <video ref={videoRef} autoPlay playsInline muted className="h-48 w-full rounded-xl object-cover" /> : null}

      <input
        ref={fileInputRef}
        name="image"
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => handleSelectedFile(event.target.files?.[0])}
      />
      <input name="device_name" placeholder="Dispositivo / celular / terminal" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
      <input name="notes" placeholder="Observação (opcional)" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={cameraOpen ? closeCamera : openCamera}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {cameraOpen ? "Fechar câmera" : "Abrir câmera"}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Enviar foto
        </button>
      </div>

      <button
        type="button"
        onClick={capturePhoto}
        disabled={!cameraOpen}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        Capturar rosto
      </button>

      {error ? <p className="text-xs text-red-600 dark:text-red-300">{error}</p> : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Liberar acesso por rosto
      </button>
    </form>
  );
}
