import os
import tempfile
import numpy as np
from loguru import logger
from app.models.ai_prediction import DangerLevel
from typing import Optional

# Try to import whisper; degrade gracefully if not installed
try:
    import whisper
    WHISPER_AVAILABLE = True
    _whisper_model = None
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("Whisper not installed. Voice analysis will use mock mode.")

# Try librosa for audio feature extraction
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False


def _load_whisper_model():
    global _whisper_model
    if not WHISPER_AVAILABLE:
        return None
    if _whisper_model is None:
        try:
            _whisper_model = whisper.load_model("base")
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
    return _whisper_model


async def transcribe_audio(audio_file_path: str) -> Optional[str]:
    """Transcribe audio using Whisper."""
    model = _load_whisper_model()
    if not model:
        return "Audio transcription not available (Whisper not installed)"

    try:
        result = model.transcribe(audio_file_path, language="en", task="transcribe")
        transcript = result["text"].strip()
        logger.info(f"Transcribed: {transcript[:100]}...")
        return transcript
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return None


async def analyze_voice_stress(audio_file_path: str) -> dict:
    """
    Analyze audio for stress/fear indicators using acoustic features.
    Returns stress level (0-1), emotion classification, and danger assessment.
    """
    if not LIBROSA_AVAILABLE:
        return _mock_voice_analysis()

    try:
        # Load audio
        y, sr = librosa.load(audio_file_path, sr=22050, duration=30)

        # Extract acoustic features
        features = _extract_audio_features(y, sr)
        stress_level = _calculate_stress_level(features)
        emotion = _classify_emotion(features)
        danger_level = _assess_danger_from_voice(stress_level, features)

        return {
            "stress_level": stress_level,
            "emotion": emotion,
            "danger_level": danger_level,
            "confidence": 0.75,
            "trigger_emergency": stress_level > 0.7 or danger_level in ["high", "critical"],
            "features": {
                "pitch_mean": float(features.get("pitch_mean", 0)),
                "pitch_std": float(features.get("pitch_std", 0)),
                "energy_rms": float(features.get("energy_rms", 0)),
                "speech_rate": float(features.get("speech_rate", 0)),
            }
        }

    except Exception as e:
        logger.error(f"Voice stress analysis failed: {e}")
        return _mock_voice_analysis()


def _extract_audio_features(y: np.ndarray, sr: int) -> dict:
    """Extract acoustic features from audio signal."""
    features = {}

    # Pitch / F0 analysis
    try:
        f0, voiced_flag, voiced_prob = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7')
        )
        valid_f0 = f0[voiced_flag]
        features["pitch_mean"] = np.mean(valid_f0) if len(valid_f0) > 0 else 0
        features["pitch_std"] = np.std(valid_f0) if len(valid_f0) > 0 else 0
        features["pitch_range"] = (np.max(valid_f0) - np.min(valid_f0)) if len(valid_f0) > 0 else 0
    except Exception:
        features["pitch_mean"] = 0
        features["pitch_std"] = 0
        features["pitch_range"] = 0

    # Energy / RMS
    rms = librosa.feature.rms(y=y)
    features["energy_rms"] = float(np.mean(rms))
    features["energy_std"] = float(np.std(rms))

    # MFCCs (vocal quality)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    features["mfcc_mean"] = float(np.mean(mfccs))
    features["mfcc_std"] = float(np.std(mfccs))

    # Zero crossing rate (speech rate indicator)
    zcr = librosa.feature.zero_crossing_rate(y)
    features["speech_rate"] = float(np.mean(zcr))

    # Spectral features
    spec_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features["spectral_centroid"] = float(np.mean(spec_centroid))

    return features


def _calculate_stress_level(features: dict) -> float:
    """Calculate stress level (0-1) from audio features."""
    stress = 0.0
    weight_total = 0.0

    # High pitch variance = stress
    if features.get("pitch_std", 0) > 50:
        stress += 0.3
    weight_total += 0.3

    # High energy = agitation/fear
    if features.get("energy_rms", 0) > 0.05:
        stress += 0.25
    weight_total += 0.25

    # High speech rate = panic
    if features.get("speech_rate", 0) > 0.15:
        stress += 0.25
    weight_total += 0.25

    # High pitch range = emotional distress
    if features.get("pitch_range", 0) > 100:
        stress += 0.2
    weight_total += 0.2

    return min(stress / weight_total if weight_total > 0 else 0.0, 1.0)


def _classify_emotion(features: dict) -> str:
    """Classify dominant emotion from audio features."""
    stress = _calculate_stress_level(features)
    energy = features.get("energy_rms", 0)
    pitch = features.get("pitch_mean", 0)

    if stress > 0.75:
        return "fear/panic"
    elif stress > 0.55:
        return "distress"
    elif stress > 0.35:
        return "anxious"
    elif energy < 0.02:
        return "calm/whisper"
    else:
        return "neutral"


def _assess_danger_from_voice(stress_level: float, features: dict) -> str:
    """Map stress level to danger classification."""
    if stress_level >= 0.80:
        return DangerLevel.critical.value
    elif stress_level >= 0.65:
        return DangerLevel.high.value
    elif stress_level >= 0.45:
        return DangerLevel.medium.value
    elif stress_level >= 0.25:
        return DangerLevel.low.value
    else:
        return DangerLevel.safe.value


def _mock_voice_analysis() -> dict:
    """Return mock analysis when audio libs are unavailable."""
    return {
        "stress_level": 0.45,
        "emotion": "anxious",
        "danger_level": "medium",
        "confidence": 0.60,
        "trigger_emergency": False,
        "features": {"pitch_mean": 220.0, "pitch_std": 35.0, "energy_rms": 0.04, "speech_rate": 0.12},
    }
