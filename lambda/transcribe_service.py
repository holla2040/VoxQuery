"""
Transcribe service for voice input processing.
Handles audio upload to S3 and transcription via AWS Transcribe.
"""

import os
import time
import uuid
import base64
import boto3
from botocore.exceptions import ClientError

# Configuration
AUDIO_BUCKET = os.environ.get("AUDIO_BUCKET", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
AUDIO_PREFIX = "voice-input/"

# Transcription settings
MAX_POLL_ATTEMPTS = 60  # 60 seconds max wait
POLL_INTERVAL = 1  # 1 second between polls


class TranscriptionError(Exception):
    """Custom exception for transcription errors."""
    pass


def get_s3_client():
    """Get S3 client."""
    return boto3.client("s3", region_name=AWS_REGION)


def get_transcribe_client():
    """Get Transcribe client."""
    return boto3.client("transcribe", region_name=AWS_REGION)


def transcribe_audio(audio_base64: str, audio_format: str = "audio/webm") -> str:
    """
    Transcribe audio from base64 encoded data.

    Process:
    1. Decode base64 audio
    2. Upload to S3
    3. Start Transcribe job
    4. Poll for completion
    5. Extract and return transcript

    Args:
        audio_base64: Base64 encoded audio data
        audio_format: MIME type of audio (e.g., 'audio/webm', 'audio/ogg')

    Returns:
        Transcribed text
    """
    if not AUDIO_BUCKET:
        raise TranscriptionError("AUDIO_BUCKET environment variable not set")

    # Map MIME types to file extensions and Transcribe formats
    format_map = {
        'audio/webm': ('webm', 'webm'),
        'audio/webm;codecs=opus': ('webm', 'webm'),
        'audio/ogg': ('ogg', 'ogg'),
        'audio/ogg;codecs=opus': ('ogg', 'ogg'),
        'audio/mp4': ('mp4', 'mp4'),
        'audio/wav': ('wav', 'wav'),
        'audio/mpeg': ('mp3', 'mp3'),
        'audio/mp3': ('mp3', 'mp3'),
    }

    # Get file extension and transcribe format
    ext, transcribe_format = format_map.get(audio_format, ('webm', 'webm'))

    # Generate unique job ID
    job_id = f"voxquery-{uuid.uuid4().hex[:8]}"
    s3_key = f"{AUDIO_PREFIX}{job_id}.{ext}"

    # Decode audio
    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception as e:
        raise TranscriptionError(f"Failed to decode audio: {e}")

    # Upload to S3
    s3 = get_s3_client()
    try:
        s3.put_object(
            Bucket=AUDIO_BUCKET,
            Key=s3_key,
            Body=audio_bytes,
            ContentType=audio_format.split(';')[0]  # Remove codec info
        )
    except ClientError as e:
        raise TranscriptionError(f"Failed to upload audio to S3: {e}")

    # Start transcription job
    transcribe = get_transcribe_client()
    s3_uri = f"s3://{AUDIO_BUCKET}/{s3_key}"

    print(f"Starting transcription: format={transcribe_format}, s3_uri={s3_uri}")

    try:
        transcribe.start_transcription_job(
            TranscriptionJobName=job_id,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=transcribe_format,
            LanguageCode="en-US",
            Settings={
                "ShowSpeakerLabels": False,
                "ChannelIdentification": False
            }
        )
    except ClientError as e:
        cleanup_audio(s3, s3_key)
        raise TranscriptionError(f"Failed to start transcription job: {e}")

    # Poll for completion
    transcript = None
    for attempt in range(MAX_POLL_ATTEMPTS):
        try:
            response = transcribe.get_transcription_job(
                TranscriptionJobName=job_id
            )
            status = response["TranscriptionJob"]["TranscriptionJobStatus"]

            if status == "COMPLETED":
                # Get transcript from results
                transcript_uri = response["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                transcript = fetch_transcript(transcript_uri)
                break
            elif status == "FAILED":
                reason = response["TranscriptionJob"].get("FailureReason", "Unknown")
                raise TranscriptionError(f"Transcription failed: {reason}")

            time.sleep(POLL_INTERVAL)

        except ClientError as e:
            raise TranscriptionError(f"Failed to get transcription status: {e}")

    # Cleanup
    cleanup_audio(s3, s3_key)
    cleanup_transcription_job(transcribe, job_id)

    if transcript is None:
        raise TranscriptionError("Transcription timed out")

    return transcript


def fetch_transcript(transcript_uri: str) -> str:
    """
    Fetch transcript text from Transcribe result URI.

    Args:
        transcript_uri: S3 URI to transcript JSON

    Returns:
        Extracted transcript text
    """
    import urllib.request
    import json

    try:
        with urllib.request.urlopen(transcript_uri) as response:
            data = json.loads(response.read().decode())
            transcripts = data.get("results", {}).get("transcripts", [])
            if transcripts:
                return transcripts[0].get("transcript", "")
            return ""
    except Exception as e:
        raise TranscriptionError(f"Failed to fetch transcript: {e}")


def cleanup_audio(s3_client, s3_key: str):
    """Delete audio file from S3."""
    try:
        s3_client.delete_object(Bucket=AUDIO_BUCKET, Key=s3_key)
    except Exception:
        pass  # Best effort cleanup


def cleanup_transcription_job(transcribe_client, job_name: str):
    """Delete transcription job."""
    try:
        transcribe_client.delete_transcription_job(TranscriptionJobName=job_name)
    except Exception:
        pass  # Best effort cleanup


def get_supported_formats() -> list:
    """Return list of supported audio formats."""
    return ["webm", "mp3", "mp4", "wav", "flac", "ogg", "amr"]
