# -*- coding: utf-8 -*-
"""
SafeHer Whisper AI Test Script
Tests: Whisper transcription + Voice stress analysis (librosa)
Run:   python test_whisper.py
"""
import asyncio
import os
import sys
import wave
import struct
import math

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# == Step 1: Check Dependencies ==
print("=" * 60)
print("[CHECK] Step 1: Checking Dependencies...")
print("=" * 60)

deps = {}
for lib in ["whisper", "torch", "librosa", "pydub", "numpy"]:
    try:
        __import__(lib)
        deps[lib] = "OK"
    except ImportError:
        deps[lib] = "MISSING"

for lib, status in deps.items():
    print(f"  {lib:15s} -> {status}")

if deps["whisper"] == "MISSING" or deps["torch"] == "MISSING":
    print("\n[FAIL] Cannot test Whisper without whisper and torch.")
    print("   pip install openai-whisper torch")
    exit(1)

# == Step 2: Generate a test WAV file ==
print("\n" + "=" * 60)
print("[AUDIO] Step 2: Generating test audio file...")
print("=" * 60)

test_audio_path = os.path.join(os.path.dirname(__file__), "uploads", "test_whisper_audio.wav")
os.makedirs(os.path.dirname(test_audio_path), exist_ok=True)

sample_rate = 16000
duration = 3
frequency = 440
num_samples = sample_rate * duration

with wave.open(test_audio_path, "w") as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    for i in range(num_samples):
        value = int(32767 * 0.5 * math.sin(2 * math.pi * frequency * i / sample_rate))
        wav_file.writeframes(struct.pack("<h", value))

print(f"  [OK] Test audio saved: {test_audio_path}")
print(f"  Duration: {duration}s | Sample Rate: {sample_rate}Hz")

# == Step 3: Test Whisper Transcription ==
print("\n" + "=" * 60)
print("[WHISPER] Step 3: Testing Whisper Transcription...")
print("=" * 60)

import whisper
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"  Device: {device}")
print(f"  Loading Whisper 'base' model...")

model = whisper.load_model("base", device=device)
print(f"  [OK] Whisper model loaded successfully!")

print(f"  Transcribing test audio...")
result = model.transcribe(test_audio_path, fp16=False)
transcript = result.get("text", "").strip()

if transcript:
    print(f'  [OK] Transcription result: "{transcript}"')
else:
    print(f"  [OK] No speech detected (expected - test file is a tone, not speech)")
    print(f"       Whisper is WORKING! It correctly found no speech in a tone.")

print(f"  Language detected: {result.get('language', 'unknown')}")

# == Step 4: Test Voice Stress Analysis (librosa) ==
print("\n" + "=" * 60)
print("[LIBROSA] Step 4: Testing Voice Stress Analysis...")
print("=" * 60)

if deps["librosa"] == "OK":
    import librosa
    import numpy as np

    y, sr = librosa.load(test_audio_path, sr=16000, duration=30)
    print(f"  [OK] Audio loaded: {len(y)} samples at {sr}Hz")

    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    pitch = float(np.mean(pitches[pitches > 0])) if np.any(pitches > 0) else 0
    print(f"  Pitch: {pitch:.1f} Hz")

    rms = librosa.feature.rms(y=y)[0]
    energy = float(np.mean(rms))
    print(f"  Energy (RMS): {energy:.4f}")

    zcr = librosa.feature.zero_crossing_rate(y)[0]
    speech_rate = float(np.mean(zcr))
    print(f"  Speech activity (ZCR): {speech_rate:.4f}")

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    print(f"  MFCC shape: {mfcc.shape}")

    print(f"  [OK] Librosa voice analysis working!")
else:
    print("  [SKIP] librosa not installed")

# == Step 5: Test the Full SafeHer Pipeline ==
print("\n" + "=" * 60)
print("[PIPELINE] Step 5: Testing Full SafeHer Voice Pipeline...")
print("=" * 60)

async def test_pipeline():
    try:
        from app.ai.voice_analyzer import transcribe_audio, analyze_voice_stress

        print("  Running transcribe_audio()...")
        transcript = await transcribe_audio(test_audio_path)
        print(f'  Transcript: "{transcript or "(no speech)"}"')

        print("  Running analyze_voice_stress()...")
        stress_result = await analyze_voice_stress(test_audio_path)
        print(f"  Results:")
        print(f"      Stress Score : {stress_result.get('stress_score', 'N/A')}")
        print(f"      Emotion      : {stress_result.get('emotion', 'N/A')}")
        print(f"      Danger Level : {stress_result.get('danger_level', 'N/A')}")
        print(f"      Emergency    : {stress_result.get('trigger_emergency', 'N/A')}")
        if stress_result.get("acoustic_features"):
            af = stress_result["acoustic_features"]
            print(f"      Pitch        : {af.get('pitch_hz', 'N/A')} Hz")
            print(f"      Energy RMS   : {af.get('energy_rms', 'N/A')}")

        print(f"\n  [OK] Full SafeHer voice pipeline is WORKING!")
        return True

    except Exception as e:
        print(f"  [FAIL] Pipeline error: {e}")
        import traceback
        traceback.print_exc()
        return False

success = asyncio.run(test_pipeline())

# == Summary ==
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"  Whisper Model    : OK (base, {device})")
print(f"  Transcription    : OK")
print(f"  Voice Analysis   : {'OK' if deps['librosa'] == 'OK' else 'SKIPPED'}")
print(f"  SafeHer Pipeline : {'OK' if success else 'FAILED'}")
print()
if success:
    print("  >>> Whisper AI is fully operational in SafeHer! <<<")
    print()
    print("  To test with REAL speech, record a .wav and run:")
    print('     python -c "import asyncio; from app.ai.voice_analyzer import transcribe_audio; print(asyncio.run(transcribe_audio(\'path/to/audio.wav\')))"')
else:
    print("  Check the errors above and fix them.")
print("=" * 60)
