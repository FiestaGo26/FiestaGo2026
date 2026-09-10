#!/usr/bin/env python3
"""
Transcribe un audio/vídeo al español con faster-whisper y escupe JSON con
tiempos por palabra.

Corre en local y es gratis: el modelo se descarga una vez (~150 MB el
'small', que ya va sobrado para voz limpia grabada a propósito).

  python3 transcribe.py entrada.mp4 salida.json [modelo]
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: transcribe.py <entrada> <salida.json> [modelo]", file=sys.stderr)
        return 2

    src, dst = sys.argv[1], sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "small"

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Falta faster-whisper. Instálalo con:  pip install faster-whisper",
              file=sys.stderr)
        return 1

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        src,
        language="es",
        word_timestamps=True,
        vad_filter=True,          # ignora los silencios, menos alucinación
    )

    out = []
    for seg in segments:
        out.append({
            "start": round(seg.start, 3),
            "end":   round(seg.end, 3),
            "text":  seg.text.strip(),
            "words": [
                {"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word.strip()}
                for w in (seg.words or [])
            ],
        })
        print(f"  [{seg.start:6.2f}] {seg.text.strip()[:70]}", file=sys.stderr)

    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"language": info.language, "duration": info.duration, "segments": out},
                  f, ensure_ascii=False, indent=2)

    print(f"✓ {len(out)} segmentos → {dst}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
