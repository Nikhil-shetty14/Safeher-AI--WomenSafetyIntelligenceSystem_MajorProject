import os
import tempfile
import numpy as np
from loguru import logger
from app.models.ai_prediction import DangerLevel
from typing import Optional, Dict, Any
from pydub import AudioSegment

# 🛡️ Fully lazy dependency loading to avoid WinError 1455 memory crashes
# torch, whisper, and librosa are imported inside functions on first use.

_ai_available = None  # None = not yet checked
_librosa_available = None
_whisper_model = None


def _check_ai():
    """Lazily check if torch + whisper are importable."""
    global _ai_available
    if _ai_available is not None:
        return _ai_available
    try:
        import torch  # noqa: F401
        import whisper  # noqa: F401
        _ai_available = True
        logger.info("AI Dependencies (Torch/Whisper) loaded successfully.")
    except (ImportError, OSError) as e:
        _ai_available = False
        logger.error(f"PyTorch/Whisper unavailable – voice analysis disabled: {e}")
    return _ai_available


def _check_librosa():
    """Lazily check if librosa is importable."""
    global _librosa_available
    if _librosa_available is not None:
        return _librosa_available
    try:
        import librosa  # noqa: F401
        _librosa_available = True
    except (ImportError, OSError) as e:
        _librosa_available = False
        logger.warning(f"Librosa not available – advanced acoustic analysis disabled: {e}")
    return _librosa_available


def get_whisper_model():
    global _whisper_model
    if not _check_ai():
        return None
    if _whisper_model is None:
        try:
            import torch
            import whisper
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Using 'base' model for speed/accuracy balance
            _whisper_model = whisper.load_model("base", device=device)
            logger.info(f"Whisper model loaded on {device}")
        except Exception as e:
            logger.error(f"Whisper initialization failed: {e}")
    return _whisper_model


async def transcribe_audio(audio_file_path: str) -> Optional[str]:
    """Transcribe audio using OpenAI Whisper."""
    if not _check_ai():
        return "Audio transcription service disabled (missing dependencies)."
    
    model = get_whisper_model()
    if not model:
        return "Audio transcription service unavailable."

    try:
        # Convert to WAV if needed (Whisper handles many formats but pydub can normalize)
        if not audio_file_path.endswith(".wav"):
            audio = AudioSegment.from_file(audio_file_path)
            temp_wav = audio_file_path + ".normalized.wav"
            audio.export(temp_wav, format="wav")
            audio_file_path = temp_wav

        result = model.transcribe(audio_file_path, fp16=False)
        transcript = result.get("text", "").strip()
        
        # Cleanup temp file if created
        if ".normalized.wav" in audio_file_path:
            os.remove(audio_file_path)
            
        logger.info(f"Audio Transcribed: {len(transcript)} chars")
        return transcript
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return None


async def analyze_voice_stress(audio_file_path: str) -> Dict[str, Any]:
    """
    Perform deep acoustic analysis to detect panic, stress, and environmental danger.
    """
    if not _check_librosa():
        return _get_default_analysis()

    try:
        import librosa
        # Load audio (downsample for analysis speed)
        y, sr = librosa.load(audio_file_path, sr=16000, duration=30)
        
        # 1. Pitch & Jitter (Emotional Distress)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0
        
        # 2. Energy/Volume (Aggression/Screams)
        rms = librosa.feature.rms(y=y)[0]
        energy = np.mean(rms)
        energy_max = np.max(rms)
        
        # 3. Speech Rate (Panic)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        speech_rate = np.mean(zcr)
        
        # 4. Mel-Frequency Cepstral Coefficients (Tone/Timbre)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)

        # Classification logic
        stress_score = 0.0
        emotion = "neutral"
        
        # Normalize and weight features
        # High pitch + High energy = Fear/Scream
        if pitch > 250 and energy > 0.05:
            stress_score = 0.9
            emotion = "fear/scream"
        elif speech_rate > 0.2:
            stress_score = 0.75
            emotion = "panic/rapid_speech"
        elif energy > 0.08:
            stress_score = 0.8
            emotion = "aggression/loud_noise"
        elif energy < 0.005:
            stress_score = 0.2
            emotion = "whispering/muffled"
        else:
            stress_score = 0.4
            emotion = "agitated"

        danger_level = "low"
        if stress_score > 0.85: danger_level = "critical"
        elif stress_score > 0.7: danger_level = "high"
        elif stress_score > 0.4: danger_level = "medium"

        return {
            "stress_score": float(stress_score),
            "emotion": emotion,
            "danger_level": danger_level,
            "acoustic_features": {
                "pitch_hz": float(pitch),
                "energy_rms": float(energy),
                "peak_energy": float(energy_max),
                "speech_activity": float(speech_rate)
            },
            "trigger_emergency": stress_score > 0.75
        }

    except Exception as e:
        logger.error(f"Acoustic analysis failed: {e}")
        return _get_default_analysis()


def _get_default_analysis() -> Dict[str, Any]:
    return {
        "stress_score": 0.5,
        "emotion": "undetermined",
        "danger_level": "medium",
        "acoustic_features": {},
        "trigger_emergency": False
    }
